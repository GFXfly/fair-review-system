import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Execute production TypeScript with isolated I/O; no database or paid API calls.
function load(relativePath, mocks = {}, globals = {}) {
    const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', relativePath);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const exports = {};
    vm.runInNewContext(code, {
        exports, require: id => {
            if (!(id in mocks)) throw new Error(`Unexpected dependency: ${id}`);
            return mocks[id];
        },
        console: { log() {}, warn() {}, error() {} }, process, ...globals,
    }, { filename });
    return exports;
}

function auditor(responses) {
    let calls = 0;
    const { APP_CONFIG } = load('src/lib/config.ts');
    const { TextChunker } = load('src/lib/text-utils.ts');
    return load('src/lib/agents/auditor.ts', {
        '@/lib/llm': {
            callLLM: async () => responses[Math.min(calls++, responses.length - 1)],
            firstArray: value => Array.isArray(value) ? value : Object.values(value || {}).find(Array.isArray) || null,
            FLASH_MODEL: 'flash', PRO_MODEL: 'pro',
        },
        '@/lib/rag': { searchSimilarCases: async () => [], searchSimilarRegulations: async () => [] },
        '@/lib/text-utils': { TextChunker }, '@/lib/config': { APP_CONFIG },
        './retrieval': {},
    });
}

test('invalid auditor responses fail instead of returning no risks', async () => {
    await assert.rejects(auditor(['invalid']).runAuditor('POLICY', 'text'), /有效|审查/);
});

test('valid empty risk result remains successful', async () => {
    const result = await auditor(['[]', '{"risks":[]}']).runAuditor('POLICY', 'text');
    assert.equal(result.length, 0);
});

test('malformed risk fields fail instead of reaching saved results', async () => {
    await assert.rejects(auditor(['[]', '{"risks":[{"description":123}]}']).runAuditor('POLICY', 'text'), /有效|审查/);
});

test('unrelated JSON arrays cannot stand in for an empty risk result', async () => {
    await assert.rejects(auditor(['[]', '{"warnings":[]}']).runAuditor('POLICY', 'text'), /有效|审查/);
});

function feedback(user, ownerId) {
    const writes = [];
    const route = load('src/app/api/feedback/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        '@/lib/auth': { requireAuth: async () => user, handleAuthError: () => ({ status: 401 }) },
        '@/lib/prisma': { prisma: {
            reviewRecord: { findUnique: async () => ({ userId: ownerId }) },
            reviewRisk: { findFirst: async () => ({ id: 7, reviewId: 'review', review: { userId: ownerId } }) },
            riskFeedback: { findFirst: async () => null, create: async ({ data }) => { writes.push(data); return data; } },
        } },
    });
    return { route, writes };
}

test('another user cannot submit feedback on a private review', async () => {
    const { route, writes } = feedback({ id: 2, role: 'user' }, 1);
    const result = await route.POST({ json: async () => ({ reviewId: 'review', riskId: 7, isAccurate: false }) });
    assert.equal(result.status, 403);
    assert.equal(writes.length, 0);
});

test('owner can submit feedback with a numeric string risk ID', async () => {
    const { route, writes } = feedback({ id: 1, role: 'user' }, 1);
    const result = await route.POST({ json: async () => ({ reviewId: 'review', riskId: '7', isAccurate: true }) });
    assert.equal(result.status, 200);
    assert.equal(writes[0].riskId, 7);
});

test('administrator can submit feedback on another user review', async () => {
    const { route, writes } = feedback({ id: 2, role: 'admin' }, 1);
    const result = await route.POST({ json: async () => ({ reviewId: 'review', riskId: 7, isAccurate: true }) });
    assert.equal(result.status, 200);
    assert.equal(writes.length, 1);
});

test('invalid risk IDs are rejected without creating feedback', async () => {
    for (const riskId of ['7junk', '', 0, -1, 1.5, '9007199254740993']) {
        const { route, writes } = feedback({ id: 1, role: 'user' }, 1);
        const result = await route.POST({ json: async () => ({ reviewId: 'review', riskId, isAccurate: true }) });
        assert.equal(result.status, 400, String(riskId));
        assert.equal(writes.length, 0);
    }
});

async function pollScenario(terminalStatus) {
    const states = [];
    const alerts = [];
    const timers = [];
    const navigation = [];
    const stored = [];
    let index = 0;
    let calls = 0;
    const { useReviewSubmit: createHookHarness } = load('src/app/dashboard/use-review-submit.ts', {
        react: { useState: initial => {
            const slot = index++;
            states[slot] = slot === 1 ? { name: 'sample.docx', size: 10 } : initial;
            return [states[slot], value => { states[slot] = value; }];
        } },
        'next/navigation': { useRouter: () => ({ push: value => navigation.push(value) }) },
    }, {
        FormData: class { append() {} }, alert: value => alerts.push(value),
        sessionStorage: { setItem: (...args) => stored.push(args) },
        setTimeout: callback => { timers.push(callback); return 1; },
        fetch: async () => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => {
            calls++;
            if (calls === 1) return { id: 'review' };
            if (calls === 2) return { status: 'processing', progress: 5 };
            return calls === 3 ? terminalStatus : { id: 'review', risks: [] };
        } }),
    });
    const completion = createHookHarness().startReview();
    for (let attempt = 0; attempt < 20 && timers.length === 0; attempt++) await Promise.resolve();
    assert.equal(timers.length, 1);
    await Promise.resolve(timers.shift()()).catch(() => undefined);
    await completion;
    for (const timer of timers) await timer();
    return { states, alerts, navigation, stored };
}

test('failure after the first status poll clears loading and shows the error', async () => {
    const { states, alerts } = await pollScenario({ status: 'failed', progressMessage: '审查失败：模型异常' });
    assert.equal(states[4], false);
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /模型异常/);
});

test('successful later poll stores the result and navigates to the review', async () => {
    const { alerts, navigation, stored } = await pollScenario({ status: 'completed', progress: 100 });
    assert.equal(alerts.length, 0);
    assert.deepEqual(navigation, ['/review/review']);
    assert.equal(JSON.parse(stored[0][1]).id, 'review');
});

test('guidance counselor preserves core regulation text when no QA matches', async () => {
    const { runGuidanceCounselor } = load('src/lib/agents/guidance_counselor.ts', {
        '@/lib/llm': {
            callLLM: async () => '{"ids":[]}',
            firstArray: value => Array.isArray(value) ? value : Object.values(value || {}).find(Array.isArray) || null,
            FLASH_MODEL: 'flash',
        },
        '@/lib/prisma': {
            prisma: {
                regulation: {
                    findFirst: async () => ({ content: '核心审查细则全文内容' }),
                    findMany: async () => [{ id: 101, title: '[总局答疑] 测试问题' }],
                },
            },
        },
    });
    const guidance = await runGuidanceCounselor('测试待审文本', 'BIDDING');
    assert.match(guidance, /核心审查细则全文内容/);
});

test('GET /api/users enforces admin permission instead of plain login', async () => {
    let adminChecked = false;
    const orgConstants = load('src/lib/org-constants.ts');
    const route = load('src/app/api/users/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        bcryptjs: {},
        '@/lib/org-constants': orgConstants,
        '@/lib/prisma': { prisma: { user: { findMany: async () => [] } } },
        '@/lib/audit-logger': { logSuccess: async () => {}, logFailure: async () => {} },
        '@/lib/auth': {
            requireAdmin: async () => { adminChecked = true; throw Object.assign(new Error('Forbidden'), { statusCode: 403 }); },
            handleAuthError: err => ({ status: err.statusCode || 500 }),
            validatePassword: () => true,
            PASSWORD_REQUIREMENTS_MSG: '',
        },
    });
    const res = await route.GET({});
    assert.equal(adminChecked, true);
    assert.equal(res.status, 403);
});

test('DELETE /api/reviews/[id] removes uploaded docx file and tolerates ENOENT', async () => {
    const unlinked = [];
    const route = load('src/app/api/reviews/[id]/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        'fs/promises': {
            unlink: async target => {
                unlinked.push(target);
                const err = new Error('missing');
                err.code = 'ENOENT';
                throw err;
            },
        },
        path,
        '@/lib/auth': { getCurrentUser: async () => ({ id: 1, role: 'user' }) },
        '@/lib/prisma': {
            prisma: {
                reviewRecord: {
                    findUnique: async () => ({ id: 'rec_123', userId: 1 }),
                    delete: ({ where }) => ({ op: 'deleteRecord', where }),
                },
                reviewRisk: {
                    deleteMany: ({ where }) => ({ op: 'deleteRisks', where }),
                },
                $transaction: async ops => ops,
            },
        },
    });
    const res = await route.DELETE({}, { params: Promise.resolve({ id: 'rec_123' }) });
    assert.equal(res.status, 200);
    assert.equal(unlinked.length, 1);
    assert.match(unlinked[0], /rec_123\.docx$/);
});

test('POST /api/auth/change-password applies rate limit and validates missing fields', async () => {
    let limited = true;
    const route = load('src/app/api/auth/change-password/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        bcryptjs: { compare: async () => true, hash: async () => 'hashed' },
        '@/lib/prisma': { prisma: { user: { findUnique: async () => null, update: async () => ({}) } } },
        '@/lib/audit-logger': { logSuccess: async () => {}, logFailure: async () => {} },
        '@/lib/error-handler': { createErrorResponse: () => ({ error: 'err' }) },
        '@/lib/auth': {
            getCurrentUser: async () => ({ id: 5, username: 'tester' }),
            validatePassword: () => true,
            PASSWORD_REQUIREMENTS_MSG: 'msg',
        },
        '@/lib/rate-limit': {
            passwordResetRateLimiter: {},
            getClientId: () => '127.0.0.1',
            applyRateLimit: async (_limiter, key) => {
                assert.equal(key, '5:127.0.0.1');
                return limited
                    ? { success: false, response: { status: 429 } }
                    : { success: true };
            },
        },
    });

    const blocked = await route.POST({ json: async () => ({ currentPassword: 'a', newPassword: 'Password1!' }) });
    assert.equal(blocked.status, 429);

    limited = false;
    const badInput = await route.POST({ json: async () => ({ currentPassword: '' }) });
    assert.equal(badInput.status, 400);
});

test('getSessionOptions enforces strong SESSION_SECRET in production runtime but allows build phase', () => {
    const prevEnv = {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PHASE: process.env.NEXT_PHASE,
        SESSION_SECRET: process.env.SESSION_SECRET,
    };
    const restoreEnv = () => {
        for (const [k, v] of Object.entries(prevEnv)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    };

    try {
        const { getSessionOptions } = load('src/lib/session.ts', { 'iron-session': {} });

        process.env.NODE_ENV = 'production';
        delete process.env.NEXT_PHASE;
        delete process.env.SESSION_SECRET;
        assert.throws(() => getSessionOptions(), /CRITICAL: Production SESSION_SECRET/);

        process.env.SESSION_SECRET = 'fair_competition_secret_please_change_this';
        assert.throws(() => getSessionOptions(), /CRITICAL: Production SESSION_SECRET/);

        process.env.SESSION_SECRET = 'too_short_secret';
        assert.throws(() => getSessionOptions(), /CRITICAL: Production SESSION_SECRET/);

        process.env.NEXT_PHASE = 'phase-production-build';
        delete process.env.SESSION_SECRET;
        const buildOpts = getSessionOptions();
        assert.equal(buildOpts.password, 'dev_secret_only_for_local_development_environment');

        delete process.env.NEXT_PHASE;
        process.env.SESSION_SECRET = 'a'.repeat(32);
        const prodOpts = getSessionOptions();
        assert.equal(prodOpts.password, 'a'.repeat(32));
        assert.equal(prodOpts.cookieOptions.secure, true);
    } finally {
        restoreEnv();
    }
});

test('DELETE /api/users/[id] cleans up foreign keys in a transaction before deleting user', async () => {
    const txOps = [];
    const orgConstants = load('src/lib/org-constants.ts');
    const route = load('src/app/api/users/[id]/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        '@/lib/org-constants': orgConstants,
        '@/lib/auth': {
            requireAdmin: async () => ({ id: 1, username: 'admin', role: 'admin' }),
            handleAuthError: err => ({ status: err.statusCode || 500 }),
        },
        '@/lib/audit-logger': { logSuccess: async () => {} },
        '@/lib/prisma': {
            prisma: {
                user: {
                    findUnique: async () => ({ id: 2, username: 'target' }),
                    delete: args => ({ op: 'user.delete', args }),
                },
                reviewRecord: {
                    count: async () => 0,
                    updateMany: args => ({ op: 'reviewRecord.updateMany', args }),
                },
                riskFeedback: {
                    updateMany: args => ({ op: 'riskFeedback.updateMany', args }),
                    deleteMany: args => ({ op: 'riskFeedback.deleteMany', args }),
                },
                auditLog: {
                    updateMany: args => ({ op: 'auditLog.updateMany', args }),
                },
                $transaction: async ops => {
                    txOps.push(...ops);
                    return ops;
                },
            },
        },
    });

    const res = await route.DELETE({}, { params: Promise.resolve({ id: '2' }) });
    assert.equal(res.status, 200);
    const ops = JSON.parse(JSON.stringify(txOps));
    assert.equal(ops.length, 5);
    assert.deepEqual(ops[0], { op: 'reviewRecord.updateMany', args: { where: { userId: 2 }, data: { userId: null } } });
    assert.deepEqual(ops[1], { op: 'riskFeedback.updateMany', args: { where: { adminUserId: 2 }, data: { adminUserId: null } } });
    assert.deepEqual(ops[2], { op: 'riskFeedback.deleteMany', args: { where: { userId: 2 } } });
    assert.deepEqual(ops[3], { op: 'auditLog.updateMany', args: { where: { userId: 2 }, data: { userId: null } } });
    assert.deepEqual(ops[4], { op: 'user.delete', args: { where: { id: 2 } } });
});

test('POST /api/cases maps department to documentOrg and invalidates case embedding cache', async () => {
    let inserted = null;
    const invalidated = [];
    const route = load('src/app/api/cases/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        '@/lib/auth': {
            requireAdmin: async () => ({ id: 1, username: 'admin', role: 'admin' }),
            requireAuth: async () => ({ id: 1, username: 'admin', role: 'admin' }),
            AuthError: class extends Error {},
            handleAuthError: err => ({ status: err.statusCode || 500 }),
        },
        '@/lib/audit-logger': { logSuccess: async () => {} },
        '@/lib/rag': { invalidateEmbeddingCache: target => invalidated.push(target) },
        '@/lib/prisma': {
            prisma: {
                case: {
                    createMany: async ({ data }) => {
                        inserted = data;
                        return { count: data.length };
                    },
                },
            },
        },
    });

    const res = await route.POST({
        json: async () => ({
            title: '案例1',
            content: '内容',
            violationType: '地域限制',
            result: '已废止',
            publishDate: '2026-01-01',
            department: '某县交通局',
            violationClause: '第十条',
            documentName: '某文件',
            violationDetail: '排斥外地企业',
            legalScope: '公平竞争审查条例',
        }),
    });

    assert.equal(res.status, 201);
    assert.equal(inserted.length, 1);
    assert.equal('department' in inserted[0], false);
    assert.equal(inserted[0].documentOrg, '某县交通局');
    assert.equal(inserted[0].violationClause, '第十条');
    assert.equal(inserted[0].documentName, '某文件');
    assert.equal(inserted[0].violationDetail, '排斥外地企业');
    assert.equal(inserted[0].legalScope, '公平竞争审查条例');
    assert.deepEqual(invalidated, ['case']);
});

test('GET /api/reviews/[id]/status recovers stale processing record before returning status', async () => {
    const staleDate = new Date(Date.now() - 20 * 60 * 1000);
    const record = {
        id: 'rev_stale',
        status: 'processing',
        progress: 40,
        progressMessage: '审查中',
        riskCount: 0,
        fileName: 'bidding.docx',
        userId: 1,
        updatedAt: staleDate,
    };
    const prismaMock = {
        reviewRecord: {
            updateMany: async ({ where, data }) => {
                if (
                    where.id === record.id &&
                    where.status === record.status &&
                    record.updatedAt < where.updatedAt.lt
                ) {
                    Object.assign(record, data);
                    return { count: 1 };
                }
                return { count: 0 };
            },
            findUnique: async ({ where }) => (where.id === record.id ? { ...record } : null),
        },
    };
    const recovery = load('src/lib/review-recovery.ts', {
        '@/lib/prisma': { prisma: prismaMock },
    });
    const statusRoute = load('src/app/api/reviews/[id]/status/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        '@/lib/auth': { requireAuth: async () => ({ id: 1, role: 'user' }) },
        '@/lib/prisma': { prisma: prismaMock },
        '@/lib/review-recovery': recovery,
    });

    const res = await statusRoute.GET({}, { params: Promise.resolve({ id: 'rev_stale' }) });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'failed');
    assert.equal(res.body.progress, 0);
    assert.match(res.body.progressMessage, /超时/);
});

test('TextChunker.AUDITOR_CHUNK is 50000 and extractRiskKeywords scans tail of 45000-char document', async () => {
    const { TextChunker } = load('src/lib/text-utils.ts');
    assert.equal(TextChunker.AUDITOR_CHUNK, 50000);
    assert.equal(TextChunker.getChunkForAgent('x'.repeat(45000), 'auditor').length, 45000);

    const { APP_CONFIG } = load('src/lib/config.ts');
    const tailRisk = '本地企业优先中标，外地企业不得参与投标';
    const longText = '正文填充内容。'.repeat(6350) + tailRisk + '结尾条款。'.repeat(20);
    assert.ok(longText.length >= 44000 && longText.length <= 50000);

    const retrievedKeywords = [];
    const scannedWindows = [];
    const { runAuditor } = load('src/lib/agents/auditor.ts', {
        '@/lib/llm': {
            callLLM: async (_sys, userPrompt) => {
                if (userPrompt.includes('提取风险关键片段')) {
                    scannedWindows.push(userPrompt);
                    return userPrompt.includes(tailRisk) ? JSON.stringify([tailRisk]) : '[]';
                }
                return '{"risks":[]}';
            },
            firstArray: value => (Array.isArray(value) ? value : Object.values(value || {}).find(Array.isArray) || null),
            FLASH_MODEL: 'flash',
            PRO_MODEL: 'pro',
        },
        '@/lib/rag': { searchSimilarCases: async () => [], searchSimilarRegulations: async () => [] },
        '@/lib/text-utils': { TextChunker },
        '@/lib/config': { APP_CONFIG },
        './retrieval': {
            RetrievalAgent: class {
                async batchRetrievalForRisks(keywords) {
                    retrievedKeywords.push(...keywords);
                    return [];
                }
                async rewriteQuery() { return []; }
                async fusionSearch() { return []; }
            },
        },
    });

    const risks = await runAuditor('BIDDING', longText);
    assert.deepEqual(JSON.parse(JSON.stringify(risks)), []);
    assert.ok(scannedWindows.length >= 7, `expected >= 7 windows, got ${scannedWindows.length}`);
    assert.deepEqual(JSON.parse(JSON.stringify(retrievedKeywords)), [tailRisk]);
});

test('POST /api/auth/register validates town list, agency name, phone, and creates pending user', async () => {
    const createdUsers = [];
    const orgConstants = load('src/lib/org-constants.ts');
    const route = load('src/app/api/auth/register/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        bcryptjs: { hash: async pwd => `hashed_${pwd}` },
        '@/lib/org-constants': orgConstants,
        '@/lib/auth': {
            validatePassword: pwd => typeof pwd === 'string' && pwd.length >= 8,
            PASSWORD_REQUIREMENTS_MSG: '密码不符合要求',
        },
        '@/lib/audit-logger': { logSuccess: async () => {}, logFailure: async () => {} },
        '@/lib/error-handler': { createErrorResponse: () => ({ error: 'err' }) },
        '@/lib/rate-limit': {
            registerRateLimiter: {},
            getClientId: () => '127.0.0.1',
            applyRateLimit: async () => ({ success: true }),
        },
        '@/lib/prisma': {
            prisma: {
                user: {
                    count: async () => 0,
                    findUnique: async () => null,
                    create: async ({ data }) => {
                        createdUsers.push(data);
                        return { id: 10, username: data.username };
                    },
                },
            },
        },
    });

    // 非法镇街名称
    const badTown = await route.POST({
        json: async () => ({
            username: 'town_user1',
            password: 'Password123',
            name: '张三',
            orgType: 'town',
            department: '不存在街道',
            phone: '13800138000',
        }),
    });
    assert.equal(badTown.status, 400);

    // 非法手机号
    const badPhone = await route.POST({
        json: async () => ({
            username: 'town_user1',
            password: 'Password123',
            name: '张三',
            orgType: 'town',
            department: '锦城街道',
            phone: '12345',
        }),
    });
    assert.equal(badPhone.status, 400);

    // 代理公司名称过短
    const badAgency = await route.POST({
        json: async () => ({
            username: 'agency_user1',
            password: 'Password123',
            name: '李四',
            orgType: 'agency',
            department: '公司',
            phone: '13800138000',
        }),
    });
    assert.equal(badAgency.status, 400);

    // 合法镇街注册成功，status 固定为 pending
    const okTown = await route.POST({
        json: async () => ({
            username: 'town_user1',
            password: 'Password123',
            name: '张三',
            orgType: 'town',
            department: '锦城街道',
            phone: '13800138000',
        }),
    });
    assert.equal(okTown.status, 201);

    // 合法招标代理公司注册成功
    const okAgency = await route.POST({
        json: async () => ({
            username: 'agency_user2',
            password: 'Password123',
            name: '李四',
            orgType: 'agency',
            department: '杭州临安工程招标代理有限公司',
            phone: '13900139000',
        }),
    });
    assert.equal(okAgency.status, 201);

    assert.equal(createdUsers.length, 2);
    assert.equal(createdUsers[0].status, 'pending');
    assert.equal(createdUsers[0].role, 'user');
    assert.equal(createdUsers[1].status, 'pending');
    assert.equal(createdUsers[1].orgType, 'agency');
});

test('POST /api/auth/login blocks non-active statuses and saves sessionVersion for active user', async () => {
    let currentDbUser = null;
    const savedSession = { saveCalled: false };
    const route = load('src/app/api/auth/login/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        bcryptjs: { compare: async () => true },
        '@/lib/audit-logger': { logSuccess: async () => {}, logFailure: async () => {} },
        '@/lib/error-handler': { createErrorResponse: () => ({ error: 'err' }) },
        '@/lib/rate-limit': {
            loginRateLimiter: {},
            getClientId: () => '127.0.0.1',
            applyRateLimit: async () => ({ success: true }),
        },
        '@/lib/auth': {
            getSession: async () => ({
                ...savedSession,
                save: async function save() {
                    savedSession.userId = this.userId;
                    savedSession.username = this.username;
                    savedSession.role = this.role;
                    savedSession.sessionVersion = this.sessionVersion;
                    savedSession.isLoggedIn = this.isLoggedIn;
                    savedSession.saveCalled = true;
                },
            }),
        },
        '@/lib/prisma': {
            prisma: {
                user: {
                    findUnique: async () => currentDbUser,
                },
            },
        },
    });

    currentDbUser = { id: 1, username: 'u1', password: 'h', role: 'user', status: 'pending', sessionVersion: 1 };
    const pendingRes = await route.POST({ json: async () => ({ username: 'u1', password: 'p' }) });
    assert.equal(pendingRes.status, 403);
    assert.match(pendingRes.body.error, /待审批/);

    currentDbUser = { id: 1, username: 'u1', password: 'h', role: 'user', status: 'disabled', sessionVersion: 2 };
    const disabledRes = await route.POST({ json: async () => ({ username: 'u1', password: 'p' }) });
    assert.equal(disabledRes.status, 403);
    assert.match(disabledRes.body.error, /禁用/);

    currentDbUser = { id: 1, username: 'u1', password: 'h', role: 'user', status: 'rejected', sessionVersion: 2 };
    const rejectedRes = await route.POST({ json: async () => ({ username: 'u1', password: 'p' }) });
    assert.equal(rejectedRes.status, 403);
    assert.match(rejectedRes.body.error, /未通过审批/);

    currentDbUser = { id: 1, username: 'u1', password: 'h', role: 'user', status: 'active', sessionVersion: 3, department: '锦城街道' };
    const activeRes = await route.POST({ json: async () => ({ username: 'u1', password: 'p' }) });
    assert.equal(activeRes.status, 200);
    assert.equal(savedSession.saveCalled, true);
    assert.equal(savedSession.sessionVersion, 3);
});

test('getCurrentUser revokes session immediately when disabled or sessionVersion mismatches', async () => {
    let sessionMock = { isLoggedIn: true, userId: 1 };
    let dbUserMock = { id: 1, username: 'u1', name: '张三', status: 'active', sessionVersion: 1 };

    const auth = load('src/lib/auth.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        'iron-session': { getIronSession: async () => sessionMock },
        'next/headers': { cookies: async () => ({}) },
        '@/lib/session': { getSessionOptions: () => ({}) },
        '@/lib/prisma': {
            prisma: {
                user: {
                    findUnique: async () => dbUserMock,
                },
            },
        },
    });

    // 存量老 Cookie（无 sessionVersion）且 DB sessionVersion === 1 时兼容有效
    assert.equal((await auth.getCurrentUser()).username, 'u1');

    // 账号被禁用后立即返回 null
    dbUserMock = { ...dbUserMock, status: 'disabled' };
    assert.equal(await auth.getCurrentUser(), null);

    // sessionVersion 自增后旧 Cookie 立即返回 null
    dbUserMock = { ...dbUserMock, status: 'active', sessionVersion: 2 };
    assert.equal(await auth.getCurrentUser(), null);

    // 携带匹配的最新 sessionVersion 时有效
    sessionMock = { isLoggedIn: true, userId: 1, sessionVersion: 2 };
    assert.equal((await auth.getCurrentUser()).username, 'u1');
});

test('PATCH /api/users/[id] enforces status transitions and DELETE protects users with reviews', async () => {
    let targetUser = {
        id: 2,
        username: 'u2',
        name: '王五',
        department: '锦城街道',
        orgType: 'town',
        phone: '13800138000',
        role: 'user',
        status: 'pending',
    };
    let reviewCount = 2;
    const updateCalls = [];
    const orgConstants = load('src/lib/org-constants.ts');

    const route = load('src/app/api/users/[id]/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        '@/lib/org-constants': orgConstants,
        '@/lib/auth': {
            requireAdmin: async () => ({ id: 1, username: 'admin', role: 'admin' }),
            handleAuthError: err => ({ status: err.statusCode || 500 }),
        },
        '@/lib/audit-logger': { logSuccess: async () => {} },
        '@/lib/prisma': {
            prisma: {
                user: {
                    findUnique: async () => targetUser,
                    update: async ({ data }) => {
                        updateCalls.push(data);
                        if (data.status) targetUser = { ...targetUser, status: data.status };
                        return targetUser;
                    },
                },
                reviewRecord: {
                    count: async () => reviewCount,
                },
            },
        },
    }, { URL });

    // pending -> active (approve)
    const approveRes = await route.PATCH(
        { json: async () => ({ action: 'approve' }) },
        { params: Promise.resolve({ id: '2' }) }
    );
    assert.equal(approveRes.status, 200);
    assert.equal(updateCalls[0].status, 'active');

    // active -> reject 非法流转返回 409
    const badReject = await route.PATCH(
        { json: async () => ({ action: 'reject' }) },
        { params: Promise.resolve({ id: '2' }) }
    );
    assert.equal(badReject.status, 409);

    // active -> disabled 且递增 sessionVersion
    const disableRes = await route.PATCH(
        { json: async () => ({ action: 'disable' }) },
        { params: Promise.resolve({ id: '2' }) }
    );
    assert.equal(disableRes.status, 200);
    assert.equal(updateCalls[1].status, 'disabled');
    assert.equal(updateCalls[1].sessionVersion.increment, 1);

    // 有审查记录默认 DELETE 返回 409 保护台账
    const deleteBlocked = await route.DELETE(
        { url: 'http://localhost/api/users/2' },
        { params: Promise.resolve({ id: '2' }) }
    );
    assert.equal(deleteBlocked.status, 409);
    assert.match(deleteBlocked.body.error, /2 条历史审查记录/);

    // 禁止修改 admin 状态
    targetUser = { ...targetUser, role: 'admin', status: 'active' };
    const adminRes = await route.PATCH(
        { json: async () => ({ action: 'disable' }) },
        { params: Promise.resolve({ id: '2' }) }
    );
    assert.equal(adminRes.status, 400);
});
