import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function load(relativePath, mocks = {}, globals = {}) {
    const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', relativePath);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const exports = {};
    vm.runInNewContext(code, {
        exports,
        require: id => {
            if (!(id in mocks)) throw new Error(`Unexpected dependency: ${id}`);
            return mocks[id];
        },
        console: { log() {}, warn() {}, error() {} },
        process,
        ...globals,
    }, { filename });
    return exports;
}

const sanitizer = load('src/lib/caliber-sanitizer.ts');

test('isInternalCaliberRegulation distinguishes public regulations from internal calibers', () => {
    // 公开正式法规应返回 false
    assert.equal(sanitizer.isInternalCaliberRegulation({
        title: '公平竞争审查条例',
        category: '行政法规',
        level: '行政法规',
    }), false);
    assert.equal(sanitizer.isInternalCaliberRegulation({
        title: '浙江省招标投标领域公平竞争审查细则',
        category: '地方细则',
        level: '地方规范性文件',
    }), false);

    // 两批集中答疑口径与碎片问答应返回 true
    assert.equal(sanitizer.isInternalCaliberRegulation({
        title: '公平竞争审查实践问题集中答疑口径（第一批）',
        category: '集中答疑口径',
        level: '业务口径',
    }), true);
    assert.equal(sanitizer.isInternalCaliberRegulation({
        title: '公平竞争审查实践问题集中答疑口径（第二批）',
        category: '业务口径',
        level: '总局指导/业务口径',
    }), true);
    assert.equal(sanitizer.isInternalCaliberRegulation({
        title: '[总局答疑41] 投标文件中规定，供应商需提供连续投保食品安全责任险记录的期限',
        category: 'QA_Fragment',
        level: '业务指导',
    }), true);
    assert.equal(sanitizer.isInternalCaliberRegulation({
        title: '  【总局答疑12】关于本地业绩加分的认定',
        category: null,
        level: '指导文件',
    }), true);
});

test('sanitizePublicText strips internal caliber names while preserving substantive legal reasoning', () => {
    const sample1 = '[总局答疑41] 根据《公平竞争审查实践问题集中答疑口径（第二批）》，要求供应商提供连续投保食品安全责任险记录的期限，属于变相提高市场准入门槛，建议删除该连续投保年限要求。';
    const cleaned1 = sanitizer.sanitizePublicText(sample1);
    assert.equal(/总局答疑|集中答疑口径|答疑口径/.test(cleaned1), false);
    assert.match(cleaned1, /根据公平竞争审查相关规定/);
    assert.match(cleaned1, /要求供应商提供连续投保食品安全责任险记录的期限/);
    assert.match(cleaned1, /建议删除该连续投保年限要求/);

    const sample2 = '根据总局答疑口径规定，不得将本地注册或设立分支机构作为加分条件，违反《公平竞争审查条例》第十条。';
    const cleaned2 = sanitizer.sanitizePublicText(sample2);
    assert.equal(/总局答疑|答疑口径/.test(cleaned2), false);
    assert.match(cleaned2, /根据公平竞争审查相关规定/);
    assert.match(cleaned2, /《公平竞争审查条例》第十条/);

    const sample3 = '<!--INTERNAL_CALIBER:{"ref":"[总局答疑41] 连续投保年限限制"}-->\n【某市招标案例】违规要点：限定投保期限。';
    const cleaned3 = sanitizer.sanitizePublicText(sample3);
    assert.equal(cleaned3.includes('INTERNAL_CALIBER'), false);
    assert.equal(cleaned3.includes('总局答疑41'), false);
    assert.match(cleaned3, /【某市招标案例】违规要点：限定投保期限。/);
});

test('encodeRelatedCaseWithCaliber and formatRiskForViewer isolate internalCaliber by viewer role', () => {
    const encoded = sanitizer.encodeRelatedCaseWithCaliber(
        '【某县餐饮配送项目案例】\n违规要点：要求连续投保三年以上。',
        '[总局答疑41] 投标文件中规定，供应商需提供连续投保食品安全责任险记录的期限'
    );
    assert.match(encoded, /^<!--INTERNAL_CALIBER:/);
    assert.match(encoded, /【某县餐饮配送项目案例】/);

    const rawNewRisk = {
        id: '10',
        level: 'High',
        title: '[总局答疑41] 连续投保年限构成准入限制',
        description: '依据《公平竞争审查实践问题集中答疑口径（第二批）》，要求连续投保三年限制外地新进入经营者参与竞争。',
        location: '投标人须提供连续三年投保食品安全责任险证明',
        suggestion: '根据总局权威答疑口径，建议取消连续投保年限要求，仅要求承诺中标后按规定投保即可。',
        law: '《公平竞争审查实践问题集中答疑口径（第二批）》',
        relatedCase: encoded,
        defense: '无有效辩护理由。',
        rulingReason: '符合总局实践答疑认定逻辑，应维持高风险判定。',
    };

    // 非管理员：物理剥离 internalCaliber 属性，且所有常规字段无内部口径字样
    const publicView = sanitizer.formatRiskForViewer(rawNewRisk, false);
    assert.equal('internalCaliber' in publicView, false);
    for (const field of ['title', 'description', 'location', 'suggestion', 'law', 'relatedCase', 'defense', 'rulingReason']) {
        assert.equal(/总局答疑|集中答疑口径|答疑口径|INTERNAL_CALIBER/.test(String(publicView[field] || '')), false, `leak in ${field}: ${publicView[field]}`);
    }
    assert.equal(publicView.law, '《公平竞争审查条例》及相关招投标公平竞争审查规定');
    assert.match(publicView.relatedCase, /【某县餐饮配送项目案例】/);
    assert.match(publicView.description, /要求连续投保三年限制外地新进入经营者参与竞争/);

    // 管理员（新编码记录）：含准确 internalCaliber，且常规字段同样已脱敏
    const adminViewNew = sanitizer.formatRiskForViewer(rawNewRisk, true);
    assert.equal(
        adminViewNew.internalCaliber,
        '[总局答疑41] 投标文件中规定，供应商需提供连续投保食品安全责任险记录的期限'
    );
    assert.equal(/总局答疑|集中答疑口径|INTERNAL_CALIBER/.test(adminViewNew.description), false);
    assert.equal(adminViewNew.law, '《公平竞争审查条例》及相关招投标公平竞争审查规定');

    // 管理员（历史未编码旧记录）：自动嗅探历史口径引用
    const legacyRisk = {
        id: '11',
        level: 'Medium',
        title: '本地业绩加分限制',
        description: '参照[总局答疑18] 评审标准设置本地区类似业绩加分，排斥外地投标人。',
        location: '具有本市类似项目业绩的得 3 分',
        suggestion: '建议删除本市地域限制。',
        law: '《浙江省招标投标领域公平竞争审查细则》第三条',
        relatedCase: '《公平竞争审查实践问题集中答疑口径（第一批）》相关案例',
        defense: null,
        rulingReason: null,
    };
    const adminViewLegacy = sanitizer.formatRiskForViewer(legacyRisk, true);
    assert.match(adminViewLegacy.internalCaliber || '', /\[总局答疑18\]/);
    assert.match(adminViewLegacy.internalCaliber || '', /《公平竞争审查实践问题集中答疑口径（第一批）》/);
    assert.equal(/总局答疑|答疑口径/.test(adminViewLegacy.description), false);
    assert.equal(adminViewLegacy.law, '《浙江省招标投标领域公平竞争审查细则》第三条');

    const userViewLegacy = sanitizer.formatRiskForViewer(legacyRisk, false);
    assert.equal('internalCaliber' in userViewLegacy, false);
});

test('GET /api/regulations enforces role isolation for list, search, and detail by ID', async () => {
    let currentUser = { id: 2, role: 'user' };
    const capturedFindManyArgs = [];
    const dbRows = {
        64: {
            id: 64,
            title: '公平竞争审查实践问题集中答疑口径（第二批）',
            content: '内部口径全文',
            level: '业务口径',
            category: '集中答疑口径',
        },
        1: {
            id: 1,
            title: '公平竞争审查条例',
            content: '公开条例全文',
            level: '行政法规',
            category: '行政法规',
        },
    };

    const route = load('src/app/api/regulations/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        '@/lib/auth': {
            requireAuth: async () => currentUser,
            handleAuthError: err => ({ body: { error: err.message }, status: err.statusCode || 500 }),
        },
        '@/lib/caliber-sanitizer': sanitizer,
        '@/lib/prisma': {
            prisma: {
                regulation: {
                    findUnique: async ({ where }) => dbRows[where.id] || null,
                    findMany: async args => {
                        capturedFindManyArgs.push(args);
                        return [];
                    },
                },
            },
        },
    }, { URL });

    // 1. 普通用户访问列表（无 query）
    const userListRes = await route.GET({ url: 'http://localhost/api/regulations' });
    assert.equal(userListRes.status, 200);
    assert.deepEqual(capturedFindManyArgs[0].where, sanitizer.PUBLIC_REGULATION_WHERE);

    // 2. 普通用户搜索 ?q=投标（甚至恶意带上 ?category=QA_Fragment）
    const userSearchRes = await route.GET({ url: 'http://localhost/api/regulations?q=%E6%8A%95%E6%A0%87&category=QA_Fragment' });
    assert.equal(userSearchRes.status, 200);
    assert.ok(Array.isArray(capturedFindManyArgs[1].where.AND));
    assert.deepEqual(capturedFindManyArgs[1].where.AND[0], sanitizer.PUBLIC_REGULATION_WHERE);

    // 3. 普通用户按 ID 访问内部口径（id=64）返回 403，访问公开法规（id=1）返回 200
    const userInternalRes = await route.GET({ url: 'http://localhost/api/regulations?id=64' });
    assert.equal(userInternalRes.status, 403);
    assert.match(userInternalRes.body.error, /仅限管理员/);

    const userPublicRes = await route.GET({ url: 'http://localhost/api/regulations?id=1' });
    assert.equal(userPublicRes.status, 200);
    assert.equal(userPublicRes.body.title, '公平竞争审查条例');

    // 4. 管理员可访问内部口径详情、且搜索不会被 PUBLIC_REGULATION_WHERE 过滤
    currentUser = { id: 1, role: 'admin' };
    const adminInternalRes = await route.GET({ url: 'http://localhost/api/regulations?id=64' });
    assert.equal(adminInternalRes.status, 200);
    assert.equal(adminInternalRes.body.id, 64);

    const adminSearchRes = await route.GET({ url: 'http://localhost/api/regulations?q=%E6%8A%95%E6%A0%87' });
    assert.equal(adminSearchRes.status, 200);
    assert.equal(capturedFindManyArgs[2].where.AND, undefined);
    assert.ok(Array.isArray(capturedFindManyArgs[2].where.OR));
});

test('GET /api/reviews/[id] sanitizes risks and exposes internalCaliber only to admins', async () => {
    let currentUser = { id: 2, role: 'user' };
    const mockReview = {
        id: 'rev_1',
        userId: 2,
        fileName: 'bidding.docx',
        originalText: '正文',
        originalHtml: '<p>正文</p>',
        summary: '文件类型：BIDDING。AI 判定理由：存在地域限制',
        status: 'completed',
        risks: [
            {
                id: 5,
                level: 'High',
                title: '[总局答疑41] 连续投保限制',
                description: '根据《公平竞争审查实践问题集中答疑口径（第二批）》，限定投保三年排斥竞争。',
                location: '须连续投保三年',
                suggestion: '建议删除连续投保年限限制。',
                law: '《公平竞争审查实践问题集中答疑口径（第二批）》',
                relatedCase: sanitizer.encodeRelatedCaseWithCaliber('【公开案例】违规案例内容', '[总局答疑41] 投保期限'),
                defense: null,
                rulingReason: null,
                confidence: 92,
            },
        ],
    };

    const route = load('src/app/api/reviews/[id]/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        'fs/promises': { unlink: async () => {} },
        path,
        '@/lib/auth': { getCurrentUser: async () => currentUser },
        '@/lib/caliber-sanitizer': sanitizer,
        '@/lib/prisma': {
            prisma: {
                reviewRecord: { findUnique: async () => mockReview },
            },
        },
    });

    const userRes = await route.GET({}, { params: Promise.resolve({ id: 'rev_1' }) });
    assert.equal(userRes.status, 200);
    assert.equal('internalCaliber' in userRes.body.risks[0], false);
    assert.equal(userRes.body.risks[0].law, '《公平竞争审查条例》及相关招投标公平竞争审查规定');
    assert.equal(userRes.body.risks[0].relatedCase, '【公开案例】违规案例内容');

    currentUser = { id: 1, role: 'admin' };
    const adminRes = await route.GET({}, { params: Promise.resolve({ id: 'rev_1' }) });
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.body.risks[0].internalCaliber, '[总局答疑41] 投保期限');
    assert.equal(/总局答疑|集中答疑口径/.test(adminRes.body.risks[0].description), false);
});

test('useReviewSubmit handles ignored status with noticeModal instead of alert or reload', async () => {
    const states = [];
    const alerts = [];
    let refreshed = false;
    let index = 0;
    let calls = 0;

    const { useReviewSubmit } = load('src/app/dashboard/use-review-submit.ts', {
        react: {
            useState: initial => {
                const slot = index++;
                states[slot] = slot === 1 ? { name: 'meeting.docx', size: 100 } : initial;
                return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }];
            },
        },
        'next/navigation': { useRouter: () => ({ push: () => {} }) },
    }, {
        FormData: class { append() {} },
        alert: msg => alerts.push(msg),
        setTimeout: cb => { cb(); return 1; },
        fetch: async url => {
            calls++;
            if (calls === 1) return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ id: 'rev_ign' }) };
            if (url.endsWith('/status')) {
                return {
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ status: 'ignored', progress: 100, progressMessage: '审查完成（无需审查）' }),
                };
            }
            return {
                ok: true,
                headers: { get: () => 'application/json' },
                json: async () => ({ gatekeeper: { reason: '【无需审查】该文件为内部会议纪要，不涉及市场主体经济活动。' } }),
            };
        },
    });

    const hook = useReviewSubmit({ onRefreshRecords: () => { refreshed = true; } });
    await hook.startReview();

    assert.equal(alerts.length, 0);
    assert.equal(states[1], null); // selectedFile cleared
    assert.equal(states[4], false); // isAnalyzing cleared
    assert.equal(refreshed, true);
    assert.equal(states[7]?.open, true);
    assert.equal(states[7]?.mode, 'ignored');
    assert.equal(states[7]?.recordId, 'rev_ign');
    assert.match(states[7]?.message || '', /内部会议纪要/);
});
