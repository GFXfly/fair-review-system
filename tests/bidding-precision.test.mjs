import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function loadTs(relativePath, mocks = {}) {
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
    }, { filename });
    return exports;
}

test('scanDeterministicSignals captures 15 high-frequency violations and skips compliant safe harbors', () => {
    const { scanDeterministicSignals } = loadTs('src/lib/bidding-precision.ts');

    const violationsText = [
        '1. 外地企业中标后必须在本地设立分公司并在当地纳税及缴纳社保。',
        '2. 投标人具备浙江省内类似工程业绩的每项加2分，最高加6分。',
        '3. 投标人注册资本金不低于2000万元且近三年营业收入达到5000万元以上。',
        '4. 获评高新技术企业、专精特新“小巨人”或守合同重信用企业的加3分。',
        '5. 投标人提供AAA级企业信用等级证书的得2分。',
        '6. 投标人连续投保食品安全责任险年限每满1年得0.5分，累计赔偿限额越高分越高。',
        '7. 积极参与社会公益活动、慈善捐赠并提供证明材料的加2分。',
        '8. 获得鲁班奖或钱江杯优质工程奖的加3分。',
        '9. 本项目投标保证金仅限银行转账或现金缴纳，不接受电子保函和保险保单。',
        '10. 投标人须提供生产厂家针对本项目的授权书及加盖厂家鲜章的检测报告。',
        '11. 核心设备推荐品牌：西门子、施耐德、ABB。',
        '12. 投标人须成立满3年及以上方可参与本项目投标。',
        '13. 仅限已纳入本区预选库的企业参加投标，国有企业优先考虑。',
        '14. 评标结束后采取摇号方式确定中标人。',
        '15. 对在本地纳统并贡献地方留存的企业采取一事一议方式给予财政奖补和税收返还。',
    ].join('\n');

    const signals = scanDeterministicSignals(violationsText, 'BIDDING');
    const hitRuleIds = new Set(signals.map(s => s.ruleId));

    const expectedRules = [
        'local_presence',
        'regional_track_record',
        'scale_financial_threshold',
        'enterprise_title_honor',
        'credit_rating_abuse',
        'commercial_insurance_tenure',
        'charity_public_welfare',
        'award_scoring_abuse',
        'deposit_guarantee_restriction',
        'manufacturer_auth_seal',
        'brand_lock_without_equivalent',
        'operating_years_limit',
        'ownership_or_roster_barrier',
        'lottery_bid_determination',
        'selective_fiscal_subsidy',
    ];

    for (const ruleId of expectedRules) {
        assert.ok(hitRuleIds.has(ruleId), `expected rule ${ruleId} to be captured`);
    }

    for (const sig of signals) {
        assert.ok(sig.snippet.length > 0 && sig.snippet.length <= 160);
        assert.ok(sig.lawHint.length > 0);
    }

    const compliantText = [
        '1. 近五年承担过市政道路业绩（不限行政区域），每项得1分，最高2分。',
        '2. 投标人须提供具有CMA或CNAS标识的第三方检测机构出具的检测报告。',
        '3. 推荐品牌：A品牌、B品牌、C品牌（或相当于同等档次及以上品牌）。',
        '4. 本项目不允许采购进口产品，投标人须提供本国货物。',
        '5. 投标人可自由选择现金、银行保函、保险保函或电子保函形式提交保证金。',
    ].join('\n');

    const safeSignals = scanDeterministicSignals(compliantText, 'BIDDING');
    assert.equal(safeSignals.length, 0, `expected zero false positives, got ${JSON.stringify(safeSignals)}`);
});

test('prepareDocumentForAudit dehydrates boilerplate and preserves 88k-char tail brand restriction', () => {
    const { prepareDocumentForAudit } = loadTs('src/lib/bidding-precision.ts');

    const headPart = '第一章 招标公告与投标人须知前附表\n本项目为市政道路工程。\n' + '招标要求说明条款内容。\n'.repeat(400);
    const boilerplateBody = '第1条 一般约定：发包人、承包人、监理人应遵守本通用合同条款的约定。\n'.repeat(1050);
    assert.ok(boilerplateBody.length >= 35000);
    const generalSection = `第二部分 通用合同条款\n${boilerplateBody}`;
    const specialPart = '第三部分 专用合同条款\n工期为180日历天。\n' + '专用合同详细条款内容描述。\n'.repeat(4300);
    const tailBrandSection = '第五章 材料品牌表：指定采用××单一品牌，不得更换其他品牌。';

    const doc = `${headPart}${generalSection}${specialPart}${tailBrandSection}`;
    assert.ok(doc.length >= 95000, `expected >= 95000 chars, got ${doc.length}`);
    const tailOffset = doc.indexOf('第五章 材料品牌表');
    assert.ok(tailOffset >= 88000, `expected tail offset >= 88000, got ${tailOffset}`);

    const prepared = prepareDocumentForAudit(doc, 'BIDDING');

    assert.ok(prepared.removedBoilerplateChars >= 30000, `expected boilerplate >= 30000 removed, got ${prepared.removedBoilerplateChars}`);
    assert.ok(prepared.dehydratedText.includes('已略去国家标准《通用合同条款》'));
    assert.ok(prepared.dehydratedText.includes('第三部分 专用合同条款'));
    assert.ok(prepared.auditChunks.some(chunk => chunk.includes('第五章 材料品牌表：指定采用××单一品牌')));
    assert.ok(prepared.summaryForGuidance.length <= 4500);
    assert.ok(prepared.summaryForGuidance.includes('第五章 材料品牌表'));
    assert.ok(prepared.signals.some(s => s.ruleId === 'brand_lock_without_equivalent'));
});

test('runAuditor audits multi-chunk long document concurrently and still throws on invalid chunk response', async () => {
    const { APP_CONFIG } = loadTs('src/lib/config.ts');
    const { TextChunker } = loadTs('src/lib/text-utils.ts');
    const biddingPrecision = loadTs('src/lib/bidding-precision.ts');
    const feedbackLearning = loadTs('src/lib/feedback-learning.ts', { '@/lib/prisma': { prisma: {} } });

    const tailViolation = '核心材料设备指定采用星辰单一品牌，不接受其他同等档次品牌。';
    const longDoc = ('常规招标工程技术规范与施工组织描述内容。\n'.repeat(1600))
        + ('评标办法通用步骤与开标流程记录说明。\n'.repeat(1500))
        + tailViolation;
    assert.ok(longDoc.length > 60000, `expected > 60000 chars, got ${longDoc.length}`);

    const chunkPromptsSeen = [];
    const { runAuditor } = loadTs('src/lib/agents/auditor.ts', {
        '@/lib/llm': {
            callLLM: async (_sys, userPrompt) => {
                if (userPrompt.includes('提取风险关键片段')) {
                    return '[]';
                }
                chunkPromptsSeen.push(userPrompt);
                if (userPrompt.includes(tailViolation)) {
                    return JSON.stringify({
                        risks: [{
                            id: 'risk_tail',
                            risk_level: 'High',
                            description: '【指定品牌】材料设备指定单一品牌且未注明“或相当于”，排斥其他潜在投标人。',
                            location: tailViolation,
                            suggestion: '建议删除单一品牌限定，改为通用技术参数或列举至少3个品牌并注明“或相当于”。',
                            violated_law: '《招标投标领域公平竞争审查规则》',
                            reference: '',
                        }],
                    });
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
        '@/lib/bidding-precision': biddingPrecision,
        '@/lib/feedback-learning': feedbackLearning,
        './retrieval': {
            RetrievalAgent: class {
                async batchRetrievalForRisks() { return []; }
                async rewriteQuery() { return []; }
                async fusionSearch() { return []; }
            },
        },
    });

    const detected = await runAuditor('BIDDING', longDoc, '');
    assert.equal(chunkPromptsSeen.length, 2);
    assert.equal(detected.length, 1);
    assert.equal(detected[0].location, tailViolation);

    // 任一分块全部重试返回非法 JSON 时，必须严格抛错失败而非静默吞错
    let chunkCallIdx = 0;
    const { runAuditor: runAuditorWithFailChunk } = loadTs('src/lib/agents/auditor.ts', {
        '@/lib/llm': {
            callLLM: async (_sys, userPrompt) => {
                if (userPrompt.includes('提取风险关键片段')) return '[]';
                // 第 1 块成功返回空数组，第 2 块连续返回非法格式
                if (userPrompt.includes('第 1/2 区块')) {
                    return '{"risks":[]}';
                }
                chunkCallIdx++;
                return '{"not_risks":[]}';
            },
            firstArray: value => (Array.isArray(value) ? value : Object.values(value || {}).find(Array.isArray) || null),
            FLASH_MODEL: 'flash',
            PRO_MODEL: 'pro',
        },
        '@/lib/rag': { searchSimilarCases: async () => [], searchSimilarRegulations: async () => [] },
        '@/lib/text-utils': { TextChunker },
        '@/lib/config': { APP_CONFIG },
        '@/lib/bidding-precision': biddingPrecision,
        '@/lib/feedback-learning': feedbackLearning,
        './retrieval': {
            RetrievalAgent: class {
                async batchRetrievalForRisks() { return []; }
                async rewriteQuery() { return []; }
                async fusionSearch() { return []; }
            },
        },
    });

    await assert.rejects(runAuditorWithFailChunk('BIDDING', longDoc, ''), /有效|审查/);
    assert.equal(chunkCallIdx, 3);
});

test('feedback-learning caches approved false positives and invalidates cache on admin review', async () => {
    let queryCount = 0;
    let mockRows = [
        {
            adminComment: '限制进口产品符合政府采购法第十条规定，不构成排除限制竞争',
            risk: {
                title: '政府采购限制进口产品',
                location: '本项目不允许采购进口产品，投标人须提供本国货物。',
                description: '限制进口',
            },
        },
    ];

    const { getApprovedFalsePositivePrompt, invalidateFeedbackLearningCache } = loadTs('src/lib/feedback-learning.ts', {
        '@/lib/prisma': {
            prisma: {
                riskFeedback: {
                    findMany: async ({ where }) => {
                        queryCount++;
                        assert.equal(where.isAccurate, false);
                        assert.equal(where.adminStatus, 'approved');
                        return mockRows;
                    },
                },
            },
        },
    });

    const first = await getApprovedFalsePositivePrompt();
    assert.match(first, /合规豁免反例/);
    assert.match(first, /不允许采购进口产品/);
    assert.match(first, /政府采购法第十条/);
    assert.equal(queryCount, 1);

    // 命中 5 分钟缓存，不再查库
    const second = await getApprovedFalsePositivePrompt();
    assert.equal(second, first);
    assert.equal(queryCount, 1);

    // 管理员审核新反馈后调用 invalidateFeedbackLearningCache() 立即刷新
    mockRows = [
        ...mockRows,
        {
            adminComment: '泛指CMA第三方检测报告属于通用法定要求，未指定特定机构',
            risk: {
                title: 'CMA检测要求',
                location: '须提供具有CMA标识的第三方检测机构出具的报告。',
                description: '检测资质',
            },
        },
    ];
    invalidateFeedbackLearningCache();

    const third = await getApprovedFalsePositivePrompt();
    assert.equal(queryCount, 2);
    assert.match(third, /CMA/);
});

test('runGuidanceCounselor receives tail signals and runJudge dismisses safe-harbor false positives', async () => {
    const biddingPrecision = loadTs('src/lib/bidding-precision.ts');

    let capturedGuidancePrompt = '';
    const { runGuidanceCounselor } = loadTs('src/lib/agents/guidance_counselor.ts', {
        '@/lib/llm': {
            callLLM: async (_sys, userPrompt) => {
                capturedGuidancePrompt = userPrompt;
                return '{"ids":[]}';
            },
            firstArray: value => (Array.isArray(value) ? value : Object.values(value || {}).find(Array.isArray) || null),
            FLASH_MODEL: 'flash',
        },
        '@/lib/bidding-precision': biddingPrecision,
        '@/lib/prisma': {
            prisma: {
                regulation: {
                    findFirst: async () => ({ content: '浙江省21条细则正文' }),
                    findMany: async () => [{ id: 41, title: '[总局答疑41] 连续投保商业险年限问题' }],
                },
            },
        },
    });

    const longBidding = '第一章 招标公告\n'.padEnd(10000, '常规内容。')
        + '\n第四章 评分标准\n投标人连续投保食品安全责任险年限每满1年加1分。';
    await runGuidanceCounselor(longBidding, 'BIDDING');
    assert.match(capturedGuidancePrompt, /连续投保食品安全责任险/);

    // 测试 Judge 注入 guidance、白名单和历史反例，并能驳回白名单误报
    const { APP_CONFIG } = loadTs('src/lib/config.ts');
    const { TextChunker } = loadTs('src/lib/text-utils.ts');
    const feedbackLearning = loadTs('src/lib/feedback-learning.ts', {
        '@/lib/prisma': {
            prisma: {
                riskFeedback: {
                    findMany: async () => [{
                        adminComment: 'CMA属于通用法定检测资质标识',
                        risk: { title: 'CMA检测', location: '提供具有CMA标识的检测报告', description: '检测' },
                    }],
                },
            },
        },
    });

    let judgePromptSeen = '';
    const { runJudge } = loadTs('src/lib/agents/debate.ts', {
        '@/lib/llm': {
            callLLM: async (_sys, prompt) => {
                judgePromptSeen = prompt;
                return JSON.stringify({
                    final_decision: 'DISMISS',
                    confidence: 94,
                    ruling_reason: '该条款仅要求提供带有CMA国家通用法定认证标识的第三方检测报告，未指定特定机构，属于合法通用质量证明要求。',
                });
            },
            QWEN_MODEL: 'qwen',
            PRO_MODEL: 'pro',
        },
        '@/lib/text-utils': { TextChunker },
        '@/lib/config': { APP_CONFIG },
        '@/lib/bidding-precision': biddingPrecision,
        '@/lib/feedback-learning': feedbackLearning,
    });

    const verdict = await runJudge(
        {
            id: 'r1',
            risk_level: 'Medium',
            description: '怀疑限定检测机构',
            location: '须提供具有CMA标识的第三方检测报告',
            suggestion: '修改',
            violated_law: '《公平竞争审查条例》',
        },
        'CMA是国家通用计量认证标识，全国数千家机构具备，不构成限定特定机构。',
        '★【浙江省招标投标领域公平竞争审查细则】...',
        'BIDDING'
    );

    assert.equal(verdict, null);
    assert.match(judgePromptSeen, /招投标法定合规白名单/);
    assert.match(judgePromptSeen, /浙江省招标投标领域公平竞争审查细则/);
    assert.match(judgePromptSeen, /合规豁免反例/);
});
