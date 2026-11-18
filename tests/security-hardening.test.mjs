import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');

function loadTs(relativePath, mocks = {}, globals = {}) {
    const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', relativePath);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            esModuleInterop: true,
        },
    }).outputText;
    const exports = {};
    vm.runInNewContext(
        code,
        {
            exports,
            require: id => {
                if (id in mocks) return mocks[id];
                throw new Error(`Unexpected dependency: ${id}`);
            },
            console: { log() {}, warn() {}, error() {} },
            process,
            Buffer,
            TextDecoder,
            setImmediate,
            URL,
            ...globals,
        },
        { filename }
    );
    return exports;
}

function makeMockRequest(headersMap = {}) {
    const lower = new Map();
    for (const [k, v] of Object.entries(headersMap)) {
        lower.set(k.toLowerCase(), v);
    }
    return {
        headers: {
            get(name) {
                return lower.get(String(name).toLowerCase()) ?? null;
            },
        },
    };
}

test('getTrustedClientIp prioritizes X-Real-IP and uses trailing X-Forwarded-For segment', () => {
    const { getTrustedClientIp, getClientId } = loadTs('src/lib/rate-limit.ts', {
        'rate-limiter-flexible': { RateLimiterMemory: class {} },
        'next/server': { NextRequest: class {}, NextResponse: { json: () => ({}) } },
    });

    const spoofedXffReq = makeMockRequest({
        'x-forwarded-for': '1.2.3.4, 5.6.7.8, 203.0.113.9',
    });
    assert.equal(getTrustedClientIp(spoofedXffReq), '203.0.113.9');
    assert.equal(getClientId(spoofedXffReq), '203.0.113.9');

    const realIpReq = makeMockRequest({
        'x-real-ip': '198.51.100.7',
        'x-forwarded-for': '1.2.3.4, 203.0.113.9',
    });
    assert.equal(getTrustedClientIp(realIpReq), '198.51.100.7');
    assert.equal(getClientId(realIpReq), '198.51.100.7');

    assert.equal(getTrustedClientIp(makeMockRequest({})), 'unknown');
});

test('validateDocxArchiveSafety rejects non-ZIP, zip bomb, and allows valid docx without invoking mammoth', async () => {
    let mammothCalled = 0;
    const { validateDocxArchiveSafety, extractTextFromFile } = loadTs('src/lib/file-parser.ts', {
        mammoth: {
            convertToHtml: async () => {
                mammothCalled += 1;
                return { value: '<p>正常文档 &lt;script&gt;alert(1)&lt;/script&gt;</p><a href="https://example.com" style="color:red" target="_blank">外链</a>' };
            },
        },
        dompurify: createDOMPurify,
        jsdom: { JSDOM },
    });

    // 1. 非 ZIP 魔数 Buffer
    const fakeHtmlDocx = Buffer.from('<html><body><script>alert(1)</script></body></html>', 'utf8');
    assert.throws(
        () => validateDocxArchiveSafety(fakeHtmlDocx),
        /文件头格式校验失败/
    );
    await assert.rejects(
        () => extractTextFromFile(
            { name: 'evil.docx', type: '', arrayBuffer: async () => fakeHtmlDocx },
            fakeHtmlDocx
        ),
        /文件头格式校验失败/
    );
    assert.equal(mammothCalled, 0);

    // 2. 构造合法基础 docx 后篡改中央目录 uncompressedSize 为 200MB（Zip Bomb）
    const zip = new JSZip();
    zip.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>test</w:t></w:r></w:p></w:body></w:document>');
    const validDocxBuf = await zip.generateAsync({ type: 'nodebuffer' });

    const bombBuf = Buffer.from(validDocxBuf);
    const cdSignatureOffset = bombBuf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    assert.ok(cdSignatureOffset > 0);
    bombBuf.writeUInt32LE(200 * 1024 * 1024, cdSignatureOffset + 24);

    assert.throws(
        () => validateDocxArchiveSafety(bombBuf),
        /体积异常|压缩炸弹/
    );
    await assert.rejects(
        () => extractTextFromFile(
            { name: 'bomb.docx', type: '', arrayBuffer: async () => bombBuf },
            bombBuf
        ),
        /体积异常|压缩炸弹/
    );
    assert.equal(mammothCalled, 0);

    // 3. 合法 docx 通过校验，并验证 HTML 净化（不反转义 &lt;，移除 style/target，补齐 rel）
    assert.doesNotThrow(() => validateDocxArchiveSafety(validDocxBuf));
    const parsed = await extractTextFromFile(
        { name: 'valid.docx', type: '', arrayBuffer: async () => validDocxBuf },
        validDocxBuf
    );
    assert.equal(mammothCalled, 1);
    assert.ok(!parsed.html.includes('<script>'));
    assert.ok(parsed.html.includes('&lt;script&gt;'));
    assert.ok(!parsed.html.includes('style='));
    assert.ok(!parsed.html.includes('target='));
    assert.ok(parsed.html.includes('rel="noopener noreferrer"'));
});

test('sanitizeRenderedDocxContainer strips active payloads while keeping safe content, anchors and images', () => {
    const dom = new JSDOM(`
        <div id="docx-container">
          <p id="safe-p" style="color: #222; position: fixed; top: 0;" onclick="alert(1)">正文条款</p>
          <a id="safe-anchor" href="#_Toc123">目录跳转</a>
          <a id="evil-link" href=" \u0001javascript:alert(1)">危险链接</a>
          <img id="safe-img" src="data:image/png;base64,AAAA" onerror="fetch('/steal')" />
          <div id="evil-style" style="width: expression(alert(1)); background: #fff;">样式测试</div>
          <script>window.__xss = true;</script>
          <iframe src="https://evil.example"></iframe>
        </div>
    `);
    const container = dom.window.document.getElementById('docx-container');
    const { sanitizeRenderedDocxContainer } = loadTs('src/app/review/[id]/docx-enhance.ts', {
        jszip: JSZip,
    });

    sanitizeRenderedDocxContainer(container);

    assert.equal(container.querySelectorAll('script, iframe').length, 0);
    const safeP = container.querySelector('#safe-p');
    assert.equal(safeP.getAttribute('onclick'), null);
    assert.ok(!safeP.getAttribute('style').includes('fixed'));
    assert.ok(safeP.getAttribute('style').includes('color'));
    assert.equal(safeP.textContent, '正文条款');

    assert.equal(container.querySelector('#safe-anchor').getAttribute('href'), '#_Toc123');
    assert.equal(container.querySelector('#evil-link').getAttribute('href'), null);

    const safeImg = container.querySelector('#safe-img');
    assert.equal(safeImg.getAttribute('onerror'), null);
    assert.equal(safeImg.getAttribute('src'), 'data:image/png;base64,AAAA');

    const evilStyleDiv = container.querySelector('#evil-style');
    assert.ok(!evilStyleDiv.getAttribute('style').includes('expression'));
    assert.ok(evilStyleDiv.getAttribute('style').includes('background'));
});

test('validatePassword rejects >72 byte passwords and change-password bumps sessionVersion', async () => {
    const { validatePassword } = loadTs('src/lib/auth.ts', {
        'next/server': { NextRequest: class {}, NextResponse: { json: () => ({}) } },
        'iron-session': {},
        'next/headers': {},
        '@/lib/prisma': { prisma: {} },
        '@/lib/session': { getSessionOptions: () => ({}), SessionData: {} },
    });

    assert.equal(validatePassword('Abc12345').valid, true);
    assert.equal(validatePassword('A1' + 'x'.repeat(71)).valid, false);
    assert.match(validatePassword('A1' + 'x'.repeat(71)).message, /72/);
    // 多字节中文字符同样受 72 字节上限约束
    assert.equal(validatePassword('Ab1' + '密'.repeat(24)).valid, false);
    assert.equal(validatePassword(12345678).valid, false);

    let updatedData = null;
    let savedSessionVersion = null;
    const changePasswordRoute = loadTs('src/app/api/auth/change-password/route.ts', {
        'next/server': { NextResponse: { json: (body, opts) => ({ body, status: opts?.status || 200 }) } },
        '@/lib/prisma': {
            prisma: {
                user: {
                    findUnique: async () => ({ id: 9, username: 'alice', password: 'old_hash', sessionVersion: 3 }),
                    update: async ({ data }) => {
                        updatedData = data;
                        return { sessionVersion: 4 };
                    },
                },
            },
        },
        bcryptjs: {
            compare: async () => true,
            hash: async () => 'new_hash',
        },
        '@/lib/audit-logger': { logSuccess: async () => {}, logFailure: async () => {} },
        '@/lib/error-handler': { createErrorResponse: () => ({ error: 'err' }) },
        '@/lib/auth': {
            getCurrentUser: async () => ({ id: 9, username: 'alice' }),
            getSession: async () => ({
                isLoggedIn: true,
                userId: 9,
                sessionVersion: 3,
                save: async function save() {
                    savedSessionVersion = this.sessionVersion;
                },
            }),
            validatePassword,
            PASSWORD_REQUIREMENTS_MSG: '密码不符合要求',
        },
        '@/lib/rate-limit': {
            passwordResetRateLimiter: {},
            getClientId: () => '127.0.0.1',
            applyRateLimit: async () => ({ success: true }),
        },
    });

    const tooLongRes = await changePasswordRoute.POST({
        json: async () => ({ currentPassword: 'OldPassword1!', newPassword: 'A1' + 'x'.repeat(71) }),
    });
    assert.equal(tooLongRes.status, 400);

    const okRes = await changePasswordRoute.POST({
        json: async () => ({ currentPassword: 'OldPassword1!', newPassword: 'NewPassword2!' }),
    });
    assert.equal(okRes.status, 200);
    assert.equal(updatedData.sessionVersion?.increment, 1);
    assert.equal(savedSessionVersion, 4);
});

test('POST /api/auth/login rejects oversized username/password before bcrypt.compare', async () => {
    let bcryptCalled = 0;
    const loginRoute = loadTs('src/app/api/auth/login/route.ts', {
        'next/server': { NextResponse: { json: (body, opts) => ({ body, status: opts?.status || 200 }) } },
        '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ id: 1, password: 'hash', status: 'active' }) } } },
        bcryptjs: {
            compare: async () => {
                bcryptCalled += 1;
                return false;
            },
        },
        '@/lib/audit-logger': { logSuccess: async () => {}, logFailure: async () => {} },
        '@/lib/error-handler': { createErrorResponse: () => ({ error: 'err' }) },
        '@/lib/auth': { getSession: async () => ({ save: async () => {} }) },
        '@/lib/rate-limit': {
            loginRateLimiter: {},
            getClientId: () => '127.0.0.1',
            applyRateLimit: async () => ({ success: true }),
        },
    });

    const longPwdRes = await loginRoute.POST({
        json: async () => ({ username: 'alice', password: 'x'.repeat(129) }),
    });
    assert.equal(longPwdRes.status, 401);
    assert.equal(bcryptCalled, 0);

    const longUserRes = await loginRoute.POST({
        json: async () => ({ username: 'u'.repeat(65), password: 'Password1!' }),
    });
    assert.equal(longUserRes.status, 401);
    assert.equal(bcryptCalled, 0);
});

test('POST /api/analyze rejects unauthenticated request with 401 before reading formData()', async () => {
    let formDataCalled = false;
    class MockAuthError extends Error {
        constructor(message, statusCode = 401) {
            super(message);
            this.name = 'AuthError';
            this.statusCode = statusCode;
        }
    }

    const analyzeRoute = loadTs('src/app/api/analyze/route.ts', {
        'next/server': { NextResponse: { json: (body, opts) => ({ body, status: opts?.status || 200 }) } },
        '@/lib/agents/gatekeeper': {},
        '@/lib/agents/auditor': {},
        '@/lib/agents/radar': {},
        '@/lib/agents/debate': {},
        '@/lib/agents/guidance_counselor': {},
        '@/lib/file-parser': {},
        '@/lib/prisma': { prisma: {} },
        '@/lib/text-utils': { TextChunker: {} },
        '@/lib/audit-logger': { logSuccess: async () => {}, logFailure: async () => {} },
        '@/lib/error-handler': { createErrorResponse: () => ({ error: 'err' }) },
        '@/lib/auth': {
            AuthError: MockAuthError,
            getCurrentUser: async () => null,
            requireAuth: async () => {
                throw new MockAuthError('未登录，请先登录', 401);
            },
            handleAuthError: err => ({ body: { error: err.message }, status: err.statusCode || 500 }),
        },
        '@/lib/rate-limit': {
            applyRateLimit: async () => ({ success: true }),
            llmAnalysisRateLimiter: {},
            getTrustedClientIp: () => '127.0.0.1',
        },
        '@/lib/caliber-sanitizer': {},
        '@/lib/upload-constants': { MAX_UPLOAD_SIZE_BYTES: 50 * 1024 * 1024 },
        'fs/promises': {},
        path,
    });

    const res = await analyzeRoute.POST({
        headers: { get: () => null },
        formData: async () => {
            formDataCalled = true;
            throw new Error('formData() must NOT be called for unauthenticated requests');
        },
    });

    assert.equal(res.status, 401);
    assert.equal(formDataCalled, false);
});

test('COOKIE_SECURE=false disables secure cookie flag in production and API status/validation codes are normalized', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevCookieSecure = process.env.COOKIE_SECURE;
    const prevSecret = process.env.SESSION_SECRET;
    try {
        process.env.NODE_ENV = 'production';
        process.env.SESSION_SECRET = 'b'.repeat(32);
        process.env.COOKIE_SECURE = 'false';
        const { getSessionOptions } = loadTs('src/lib/session.ts', { 'iron-session': {} });
        assert.equal(getSessionOptions().cookieOptions.secure, false);

        process.env.COOKIE_SECURE = 'true';
        assert.equal(getSessionOptions().cookieOptions.secure, true);
    } finally {
        if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = prevNodeEnv;
        if (prevCookieSecure === undefined) delete process.env.COOKIE_SECURE;
        else process.env.COOKIE_SECURE = prevCookieSecure;
        if (prevSecret === undefined) delete process.env.SESSION_SECRET;
        else process.env.SESSION_SECRET = prevSecret;
    }

    class MockAuthError extends Error {
        constructor(message, statusCode) {
            super(message);
            this.name = 'AuthError';
            this.statusCode = statusCode;
        }
    }
    const authMock = {
        AuthError: MockAuthError,
        requireAuth: async () => { throw new MockAuthError('未登录', 401); },
        requireAdmin: async () => { throw new MockAuthError('需要管理员权限', 403); },
        handleAuthError: err => ({ body: { error: err.message }, status: err instanceof MockAuthError ? err.statusCode : 500 }),
    };

    const statusRoute = loadTs('src/app/api/reviews/[id]/status/route.ts', {
        'next/server': { NextResponse: { json: (b, o) => ({ body: b, status: o?.status || 200 }) } },
        '@/lib/prisma': { prisma: {} },
        '@/lib/auth': authMock,
        '@/lib/review-recovery': { recoverStaleReviews: async () => {} },
    });
    assert.equal((await statusRoute.GET({}, { params: Promise.resolve({ id: '1' }) })).status, 401);

    const statsRoute = loadTs('src/app/api/reviews/stats/route.ts', {
        'next/server': { NextResponse: { json: (b, o) => ({ body: b, status: o?.status || 200 }) } },
        '@/lib/prisma': { prisma: {} },
        '@/lib/auth': authMock,
    });
    assert.equal((await statsRoute.GET({})).status, 403);

    const feedbackPatchRoute = loadTs('src/app/api/feedback/[id]/route.ts', {
        'next/server': { NextResponse: { json: (b, o) => ({ body: b, status: o?.status || 200 }) } },
        '@/lib/prisma': { prisma: {} },
        '@/lib/feedback-learning': { invalidateFeedbackLearningCache: () => {} },
        '@/lib/auth': {
            requireAdmin: async () => ({ id: 1, role: 'admin' }),
            handleAuthError: authMock.handleAuthError,
        },
    });
    const badFeedbackIdRes = await feedbackPatchRoute.PATCH(
        { json: async () => ({ adminStatus: 'approved' }) },
        { params: Promise.resolve({ id: 'abc' }) }
    );
    assert.equal(badFeedbackIdRes.status, 400);

    const casesRoute = loadTs('src/app/api/cases/route.ts', {
        'next/server': { NextResponse: { json: (b, o) => ({ body: b, status: o?.status || 200 }) } },
        '@/lib/prisma': { prisma: { case: { findUnique: async () => null } } },
        '@/lib/auth': {
            requireAdmin: async () => ({ id: 1, role: 'admin' }),
            requireAuth: async () => ({ id: 1, role: 'user' }),
            AuthError: MockAuthError,
            handleAuthError: authMock.handleAuthError,
        },
        '@/lib/audit-logger': { logSuccess: async () => {} },
        '@/lib/rag': { invalidateEmbeddingCache: () => {} },
    });
    assert.equal((await casesRoute.GET({ url: 'http://localhost/api/cases?id=bad' })).status, 400);
    assert.equal((await casesRoute.GET({ url: 'http://localhost/api/cases?id=999999' })).status, 404);
});
