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
            Uint8Array,
            URL,
            setImmediate: () => {},
            ...globals,
        },
        { filename }
    );
    return exports;
}

function createNextResponseMock() {
    class MockNextResponse {
        constructor(body, init = {}) {
            this.body = body;
            this.status = init.status || 200;
            this.headers = new Map(
                Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
            );
        }
        static json(body, opts = {}) {
            return {
                body,
                status: opts.status || 200,
                headers: new Map(
                    Object.entries(opts.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
                ),
            };
        }
    }
    return MockNextResponse;
}

test('MAX_UPLOAD_SIZE_BYTES is 50MB and POST /api/analyze allows 15MB while rejecting 51MB', async () => {
    const uploadConstants = loadTs('src/lib/upload-constants.ts');
    assert.equal(uploadConstants.MAX_UPLOAD_SIZE_BYTES, 50 * 1024 * 1024);

    const writtenFiles = [];
    const NextResponse = createNextResponseMock();
    const errorHandler = loadTs('src/lib/error-handler.ts');

    const analyzeRoute = loadTs('src/app/api/analyze/route.ts', {
        'next/server': { NextResponse },
        '@/lib/agents/gatekeeper': {},
        '@/lib/agents/auditor': {},
        '@/lib/agents/radar': {},
        '@/lib/agents/debate': {},
        '@/lib/agents/guidance_counselor': {},
        '@/lib/file-parser': {
            extractTextFromFile: async () => ({
                text: '第一章 招标公告\n\n　　本项目依法开展招标采购活动。',
                html: '<h2>第一章 招标公告</h2><p>本项目依法开展招标采购活动。</p>',
            }),
        },
        '@/lib/prisma': {
            prisma: {
                reviewRecord: {
                    create: async ({ data }) => ({ id: 'rec_pdf_15mb', ...data }),
                },
            },
        },
        '@/lib/text-utils': { TextChunker: {} },
        '@/lib/audit-logger': { logSuccess: async () => {}, logFailure: async () => {} },
        '@/lib/error-handler': errorHandler,
        '@/lib/auth': {
            AuthError: class extends Error {},
            getCurrentUser: async () => ({ id: 1, username: 'tester', role: 'user' }),
            requireAuth: async () => ({ id: 1, username: 'tester', role: 'user' }),
            handleAuthError: err => ({ body: { error: err.message }, status: 401 }),
        },
        '@/lib/rate-limit': {
            applyRateLimit: async () => ({ success: true }),
            llmAnalysisRateLimiter: {},
            getTrustedClientIp: () => '127.0.0.1',
        },
        '@/lib/caliber-sanitizer': {},
        '@/lib/upload-constants': uploadConstants,
        'fs/promises': {
            mkdir: async () => {},
            writeFile: async (target, buf) => {
                writtenFiles.push({ target, size: buf.length });
            },
        },
        path,
    });

    // 1. 15MB 电子文字版 PDF 正常进入异步审查并落盘 .pdf 原件
    const pdf15MbHeader = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n', 'latin1');
    const mock15MbFile = {
        name: '某工程招标文件.pdf',
        type: 'application/pdf',
        size: 15 * 1024 * 1024,
        arrayBuffer: async () =>
            pdf15MbHeader.buffer.slice(
                pdf15MbHeader.byteOffset,
                pdf15MbHeader.byteOffset + pdf15MbHeader.byteLength
            ),
    };
    const res15Mb = await analyzeRoute.POST({
        headers: { get: name => (name.toLowerCase() === 'content-length' ? String(15 * 1024 * 1024 + 1024) : null) },
        formData: async () => ({ get: key => (key === 'file' ? mock15MbFile : null) }),
    });
    assert.equal(res15Mb.status, 200);
    assert.equal(res15Mb.body.id, 'rec_pdf_15mb');
    assert.equal(writtenFiles.length, 1);
    assert.match(writtenFiles[0].target, /rec_pdf_15mb\.pdf$/);

    // 2. 51MB 文件被拒绝（返回 400 且提示 50MB）
    const mock51MbFile = {
        name: '超大标书.pdf',
        type: 'application/pdf',
        size: 51 * 1024 * 1024,
        arrayBuffer: async () => new ArrayBuffer(8),
    };
    const res51Mb = await analyzeRoute.POST({
        headers: { get: () => null },
        formData: async () => ({ get: key => (key === 'file' ? mock51MbFile : null) }),
    });
    assert.equal(res51Mb.status, 400);
    assert.match(res51Mb.body.message, /50MB/);
});

test('extractTextFromFile extracts structured paragraphs & safe HTML from electronic text PDF and merges wrapped lines', async () => {
    const longParagraphPart1 = '本项目要求所有潜在投标人在递交投标文件前必须在本地政务服务大厅完成现场登记，';
    const longParagraphPart2 = '并在本地设立独立法人分支机构或全资子公司，且近三年内不得有跨区域行政处罚记录，';
    const longParagraphPart3 = '否则资格审查委员会将直接否决其投标资格并没收投标保证金。<script>alert("xss")</script>';
    const fillerBody = '为规范招标投标市场秩序，维护公平竞争环境，现就工程建设项目的资格条件、评标办法及合同条款作如下补充说明与技术规范要求，请各投标人严格遵照执行。'.repeat(12);

    const mockRawText = [
        '第一章 招标公告',
        longParagraphPart1,
        longParagraphPart2,
        longParagraphPart3,
        '1.1 投标人资格条件',
        fillerBody,
        '- 1 -',
        '1 / 5',
    ].join('\n');

    const { extractTextFromFile } = loadTs('src/lib/file-parser.ts', {
        mammoth: { convertToHtml: async () => ({ value: '' }) },
        dompurify: createDOMPurify,
        jsdom: { JSDOM },
        'pdf-parse-fork': async () => ({
            numpages: 5,
            text: mockRawText,
        }),
    });

    const pdfBuf = Buffer.from('%PDF-1.7\n%mock electronic pdf content\n', 'latin1');
    const parsed = await extractTextFromFile(
        {
            name: '电子文字版招标文件.pdf',
            type: 'application/pdf',
            arrayBuffer: async () => pdfBuf,
        },
        pdfBuf
    );

    // 断行中文无缝合并（不留多余空格或换行）
    assert.ok(
        parsed.text.includes('完成现场登记，并在本地设立独立法人分支机构'),
        'Wrapped Chinese lines should join seamlessly without artificial spaces or line breaks'
    );
    // 生成结构化安全 HTML，且 XSS 脚本已被剥离
    assert.ok(parsed.html.includes('<h2>第一章 招标公告</h2>'));
    assert.ok(parsed.html.includes('<h4>1.1 投标人资格条件</h4>'));
    assert.ok(parsed.html.includes('<p>'));
    assert.ok(!parsed.html.includes('<script>'));
});

test('extractTextFromFile rejects scanned image-only PDF with friendly Chinese guidance', async () => {
    const { extractTextFromFile } = loadTs('src/lib/file-parser.ts', {
        mammoth: { convertToHtml: async () => ({ value: '' }) },
        dompurify: createDOMPurify,
        jsdom: { JSDOM },
        'pdf-parse-fork': async () => ({
            numpages: 12,
            text: '  - 1 - \n - 2 - \n 3 / 12 \n',
        }),
    });

    const pdfBuf = Buffer.from('%PDF-1.5\n%scanned pdf bytes\n', 'latin1');
    await assert.rejects(
        () =>
            extractTextFromFile(
                {
                    name: '纯图片扫描件.pdf',
                    type: 'application/pdf',
                    arrayBuffer: async () => pdfBuf,
                },
                pdfBuf
            ),
        /图片扫描件/
    );
});

test('extractTextFromFile rejects spoofed .pdf without %PDF- magic header and preserves 50MB docx media allowance', async () => {
    let pdfParseCalled = 0;
    const { validatePdfBufferSafety, validateDocxArchiveSafety, extractTextFromFile } = loadTs(
        'src/lib/file-parser.ts',
        {
            mammoth: { convertToHtml: async () => ({ value: '<p>ok</p>' }) },
            dompurify: createDOMPurify,
            jsdom: { JSDOM },
            'pdf-parse-fork': async () => {
                pdfParseCalled += 1;
                return { numpages: 1, text: 'x'.repeat(100) };
            },
        }
    );

    const fakePdf = Buffer.from('<html>not a pdf file</html>', 'utf8');
    assert.throws(() => validatePdfBufferSafety(fakePdf), /文件头格式校验失败/);
    await assert.rejects(
        () =>
            extractTextFromFile(
                { name: 'spoof.pdf', type: 'application/pdf', arrayBuffer: async () => fakePdf },
                fakePdf
            ),
        /文件头格式校验失败/
    );
    assert.equal(pdfParseCalled, 0);

    // 验证 50MB 多图工程招标书（含 80MB 媒体图片条目，总未压缩 160MB）可通过 docx 安全校验，而 60MB XML 仍被拦截
    const zip = new JSZip();
    zip.file('word/document.xml', '<w:document><w:body/></w:document>');
    zip.file('word/media/image1.png', 'png-placeholder');
    const baseDocx = await zip.generateAsync({ type: 'nodebuffer' });

    const mediaHeavyBuf = Buffer.from(baseDocx);
    const pngNameIdx = mediaHeavyBuf.lastIndexOf(Buffer.from('word/media/image1.png'));
    const pngCdIdx = mediaHeavyBuf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), pngNameIdx);
    assert.ok(pngCdIdx > 0);
    mediaHeavyBuf.writeUInt32LE(80 * 1024 * 1024, pngCdIdx + 24);
    assert.doesNotThrow(() => validateDocxArchiveSafety(mediaHeavyBuf));

    const xmlBombBuf = Buffer.from(baseDocx);
    const xmlNameIdx = xmlBombBuf.lastIndexOf(Buffer.from('word/document.xml'));
    const xmlCdIdx = xmlBombBuf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), xmlNameIdx);
    assert.ok(xmlCdIdx > 0);
    xmlBombBuf.writeUInt32LE(60 * 1024 * 1024, xmlCdIdx + 24);
    assert.throws(() => validateDocxArchiveSafety(xmlBombBuf), /体积异常|压缩炸弹/);
});

test('GET/HEAD /api/reviews/[id]/file serves PDF inline safely and DELETE /api/reviews/[id] removes .pdf', async () => {
    const NextResponse = createNextResponseMock();
    const pdfBytes = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n', 'latin1');

    const fileRoute = loadTs('src/app/api/reviews/[id]/file/route.ts', {
        'next/server': { NextResponse },
        'fs/promises': {
            readFile: async target => {
                if (target.endsWith('.pdf')) return pdfBytes;
                const err = new Error('ENOENT');
                err.code = 'ENOENT';
                throw err;
            },
            stat: async target => {
                if (target.endsWith('.pdf')) return { size: pdfBytes.length };
                const err = new Error('ENOENT');
                err.code = 'ENOENT';
                throw err;
            },
            open: async target => {
                if (!target.endsWith('.pdf')) {
                    const err = new Error('ENOENT');
                    err.code = 'ENOENT';
                    throw err;
                }
                return {
                    read: async (buf, offset, length) => {
                        pdfBytes.copy(buf, offset, 0, Math.min(length, pdfBytes.length));
                        return { bytesRead: Math.min(length, pdfBytes.length), buffer: buf };
                    },
                    close: async () => {},
                };
            },
        },
        path,
        '@/lib/prisma': {
            prisma: {
                reviewRecord: {
                    findUnique: async () => ({ userId: 7 }),
                },
            },
        },
        '@/lib/auth': {
            getCurrentUser: async () => ({ id: 7, role: 'user' }),
        },
    });

    const headRes = await fileRoute.HEAD(
        { url: 'http://localhost/api/reviews/rev_pdf_9/file' },
        { params: Promise.resolve({ id: 'rev_pdf_9' }) }
    );
    assert.equal(headRes.status, 200);
    assert.equal(headRes.headers.get('content-type'), 'application/pdf');
    assert.equal(headRes.headers.get('x-content-type-options'), 'nosniff');

    const inlineGetRes = await fileRoute.GET(
        {
            url: 'http://localhost/api/reviews/rev_pdf_9/file?inline=1',
            nextUrl: new URL('http://localhost/api/reviews/rev_pdf_9/file?inline=1'),
        },
        { params: Promise.resolve({ id: 'rev_pdf_9' }) }
    );
    assert.equal(inlineGetRes.status, 200);
    assert.equal(inlineGetRes.headers.get('content-type'), 'application/pdf');
    assert.equal(inlineGetRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(inlineGetRes.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(inlineGetRes.headers.get('content-disposition'), 'inline; filename="rev_pdf_9.pdf"');

    // DELETE /api/reviews/[id] 同步清理 .docx 与 .pdf
    const unlinked = [];
    const caliberSanitizer = loadTs('src/lib/caliber-sanitizer.ts');
    const reviewRoute = loadTs('src/app/api/reviews/[id]/route.ts', {
        'next/server': { NextResponse },
        'fs/promises': {
            unlink: async target => {
                unlinked.push(target);
            },
        },
        path,
        '@/lib/auth': { getCurrentUser: async () => ({ id: 7, role: 'user' }) },
        '@/lib/caliber-sanitizer': caliberSanitizer,
        '@/lib/prisma': {
            prisma: {
                reviewRecord: {
                    findUnique: async () => ({ id: 'rev_pdf_9', userId: 7 }),
                    delete: ({ where }) => ({ op: 'deleteRecord', where }),
                },
                reviewRisk: {
                    deleteMany: ({ where }) => ({ op: 'deleteRisks', where }),
                },
                $transaction: async ops => ops,
            },
        },
    });

    const delRes = await reviewRoute.DELETE({}, { params: Promise.resolve({ id: 'rev_pdf_9' }) });
    assert.equal(delRes.status, 200);
    assert.ok(unlinked.some(p => p.endsWith('rev_pdf_9.docx')));
    assert.ok(unlinked.some(p => p.endsWith('rev_pdf_9.pdf')));
});
