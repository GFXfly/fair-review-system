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
    const route = load('src/app/api/users/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        bcryptjs: {},
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
