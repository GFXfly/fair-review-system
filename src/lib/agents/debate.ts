
import { callLLM, QWEN_MODEL, PRO_MODEL } from '@/lib/llm';
import { TextChunker } from '@/lib/text-utils';
import { AuditIssue } from './auditor';
import { APP_CONFIG } from '@/lib/config';
import { BIDDING_COMPLIANCE_SAFE_HARBOR_PROMPT } from '@/lib/bidding-precision';
import { getApprovedFalsePositivePrompt } from '@/lib/feedback-learning';

/**
 * Builds a context window around risk.location so the Defender sees the
 * actual clause in situ rather than only the first 5000 chars of the doc.
 * Returns the raw doc (truncated) when no match is found.
 */
function buildDebateContext(risk: AuditIssue, docText: string): string {
    const MAX_CONTEXT = TextChunker.DEBATE_CHUNK;
    if (!risk.location || docText.length <= MAX_CONTEXT) {
        return TextChunker.getChunkForAgent(docText, 'debate');
    }

    // Try direct substring match first (cheap path).
    let matchIdx = docText.indexOf(risk.location);

    // Fallback: match on a cleaned prefix of the location to tolerate minor
    // quoting / whitespace differences introduced by the auditor.
    if (matchIdx < 0) {
        const probe = risk.location.replace(/\s+/g, '').slice(0, 40);
        if (probe.length >= 10) {
            const cleanedDoc = docText.replace(/\s+/g, '');
            const probeIdx = cleanedDoc.indexOf(probe);
            if (probeIdx >= 0) {
                // Map the cleaned-doc index back to the raw doc.
                let rawIdx = 0;
                let cleanCount = 0;
                while (rawIdx < docText.length && cleanCount < probeIdx) {
                    if (!/\s/.test(docText[rawIdx])) cleanCount++;
                    rawIdx++;
                }
                matchIdx = rawIdx;
            }
        }
    }

    if (matchIdx < 0) {
        return TextChunker.getChunkForAgent(docText, 'debate');
    }

    const half = Math.floor((MAX_CONTEXT - risk.location.length) / 2);
    const start = Math.max(0, matchIdx - Math.max(half, 500));
    const end = Math.min(docText.length, matchIdx + risk.location.length + Math.max(half, 500));
    const window = docText.substring(start, end);

    const prefix = start > 0 ? '...(省略前文)\n' : '';
    const suffix = end < docText.length ? '\n...(省略后文)' : '';
    return `${prefix}${window}${suffix}`;
}

// ==========================================
// 🔥 优化2：模型配置（能力对等的多样性）
// ==========================================
export const DEBATE_MODEL = QWEN_MODEL;   // Defender: Qwen3.8-27B（跨厂商对抗，刻意不与 Judge 同源）
export const JUDGE_MODEL = PRO_MODEL;      // Judge: DeepSeek V4 Pro 思考模式（强力裁决）

/**
 * Agent B: The Defender
 * Tries to find exculpatory evidence or exceptions for a given risk.
 */
export async function runDefender(risk: AuditIssue, docText: string, category: string = ''): Promise<string> {
    const prompt = `
你是一名资深的公平竞争审查政策顾问，通过仔细研究文件上下文、法定例外条款和招投标法定合规边界，为被指控“违规”的条款寻找合法辩护理由。

【背景】
当前文件审查类别：${category || '未指定'}
审查员认为文件中的以下内容存在公平竞争风险：
- 风险描述：${risk.description}
- 风险等级：${risk.risk_level}
- 所在位置：${risk.location}

【任务】
请阅读以下文件上下文与合规白名单，尝试针对上述指控进行辩护。
重点思考方向：
1. 该条款是否直接落入下方【招投标法定合规白名单】中的合法情形（如政府采购不允许进口产品、泛指 CMA/CNAS 通用检测标识、不限地域且分值合理的同类项目履约业绩、国家法定最低资质与人员资格、支持多元保函的保证金要求、≥3个参考品牌且已明确注明“或相当于”等）？若属于白名单情形，请果断、有力地援引《政府采购法》《招标投标法》及对应合规边界予以抗辩！
2. 该条款是否属于公平竞争审查相关法规（如《公平竞争审查条例》、地方审查细则）规定的例外情形？
3. 上下文中是否有其他前置条件减免了其违规性？

${BIDDING_COMPLIANCE_SAFE_HARBOR_PROMPT}

【文件内容（已定位到风险条款附近）】
${buildDebateContext(risk, docText)}

【输出要求】
请直接输出一段简练有力的“辩护词”。
注意：辩护词面向外部公开反馈，只能引用公开颁布的法律法规与审查细则，严禁出现“集中答疑口径”“总局答疑”等内部资料字样。
如果确实触犯禁止性红线且无法找到合法合规解释，请直接回答：“无有效辩护理由。”
`;

    try {
        const response = await callLLM(
            "你是一名专业的政策合规辩护律师。请进行深度思考，精准识别法定合规白名单与真实违规红线，寻找合法的辩护切入点。",
            prompt,
            { jsonMode: false, model: DEBATE_MODEL } // Qwen，跨厂商对抗
        );
        return response || "无有效辩护理由";
    } catch (e) {
        console.error("Defender failed:", e);
        return "辩护服务暂时不可用";
    }
}

/**
 * Agent C: The Judge
 * Decides whether the risk stands after hearing the prosecution and defense.
 */
export async function runJudge(
    risk: AuditIssue,
    defense: string,
    guidance: string = '',
    category: string = ''
): Promise<AuditIssue | null> {
    // If no defense, the risk stands automatically
    if (defense.includes("无有效辩护理由") || defense.includes("辩护服务暂时不可用")) {
        return risk;
    }

    const learnedFalsePositives = await getApprovedFalsePositivePrompt();
    const guidanceSnippet = guidance ? guidance.substring(0, 6000) : '';

    const prompt = `
你是一名公正严谨的公平竞争审查主审官。请根据审查员的指控、起草人的辩护、核心细则与实务口径以及法定合规白名单，对该风险点进行最终双刃裁决。

【审查背景】
- 文件类别：${category || '未指定'}
- 描述：${risk.description}
- 原始判定等级：${risk.risk_level}
- 违反条款：${risk.violated_law}
- 原文位置：${risk.location}

【起草人辩护】
${defense}

${guidanceSnippet ? `【核心细则与实务口径准绳（⚠️ 内部参考，对外严禁泄露“集中答疑口径/总局答疑”等内部名称）】：\n${guidanceSnippet}\n` : ''}
${BIDDING_COMPLIANCE_SAFE_HARBOR_PROMPT}

${learnedFalsePositives ? `${learnedFalsePositives}\n` : ''}
// ==========================================
// 🔥 双刃裁决准绳（严守真违规底线 + 果断剔除假阳性误报）
// ==========================================

【裁决标准】（⚠️ 请严格遵守）

1. **MAINTAIN（铁面维持）** - 凡触犯以下禁止性红线，一律维持违规：
   ✓ 触犯《浙江省招标投标领域公平竞争审查细则》（21条）、《公平竞争审查条例实施办法》或上方实务口径明确禁止的红线（如：要求本地注册/设立分支机构/当地纳税社保、特定行政区域业绩或奖项加分、商业保险连续投保年限或保额分档加分、慈善公益/捐赠加分、高企/专精特新/AAA信用等级加分、注册资本/营收/纳税规模门槛、原厂授权书或厂家鲜章检测报告、限定现金排斥电子保函、推荐品牌未注明“或相当于”等）；
   ✓ 即使起草人辩称“为了保障工程质量/售后服务/方便管理”，只要实质构成排除或限制竞争且无明确法定例外依据，**一律 MAINTAIN**。

2. **DISMISS（果断驳回误报）** - 置信度给 90~95%，以下情况必须果断驳回并剔除：
   ✓ 确属【招投标法定合规白名单】中的合法常规条款（如：政府采购明确不允许采购进口产品、仅要求第三方检测报告带 CMA 或 CNAS 通用法定标识、不限地域且分值合理的同类项目履约业绩、法定最低行业资质及人员执业资格、允许银行/保险/电子保函的保证金条款、列举 ≥3 个参考品牌且已明确注明“或相当于”）；
   ✓ 确属【本系统历史人工复核确认的合规豁免反例】中的本质相同合法条款；
   ✓ 辩护明确引用了《公平竞争审查条例》等法定例外情形且上下文证据充分。

3. **DOWNGRADE（降级）** - 以下情况可降级：
   ✓ 辩护指出了合理的减轻情节（如限制范围较小、措辞存在解释空间、可通过轻微修改消除风险）。

【裁决原则】
- **真违规绝不放过，合法合规条款绝不误伤**：对照上方双刃准绳精准区分“真违规红线”与“法定合规白名单”；
- **置信度要求**：决定 DISMISS 时，若确属白名单/合规反例或充分法定例外，置信度应给出 90~95；否则若置信度 < 85% 将自动转为 DOWNGRADE；
- **理由清晰**：ruling_reason 必须说明具体公开法律法规或合规边界依据；
- **对外合规脱敏铁律**：ruling_reason 与 revised_risk 面向外部公开反馈，只能引用公开颁布的法律法规与审查细则，**严禁出现“集中答疑口径”“总局答疑”“业务口径”“内部口径”或 [总局答疑XX] 等任何内部资料字样**。

【输出格式 (JSON)】
{
    "final_decision": "MAINTAIN" | "DOWNGRADE" | "DISMISS",
    "confidence": 0-100, // 你对该决定的置信度
    "ruling_reason": "详细说明裁决理由，包括：\n1. 是否触犯禁止性红线或属于法定合规白名单\n2. 辩护理由是否成立及公开法律依据\n3. 做出该决定的具体依据",
    "revised_risk": {  // 仅在 MAINTAIN 或 DOWNGRADE 时需要
        "risk_level": "High" | "Medium" | "Low",
        "description": "如需修正风险描述，在此填写",
        "suggestion": "如需修正整改建议，在此填写"
    }
}
`;

    try {
        const responseCtx = await callLLM(
            "你是一名公正严谨的公平竞争审查主审官。请严格按照双刃裁决准绳进行裁决，输出 JSON 格式结果。",
            prompt,
            { jsonMode: true, model: JUDGE_MODEL, thinking: true, effort: 'high' } // V4 Pro 思考裁决
        );

        if (!responseCtx) return risk; // Fallback

        const ruling = JSON.parse(responseCtx);

        // ==========================================
        // 🔥 置信度检查机制
        // ==========================================

        if (ruling.final_decision === 'DISMISS') {
            const confidenceThreshold = APP_CONFIG.debate.dismissConfidenceThreshold;

            if (ruling.confidence < confidenceThreshold) {
                console.warn(`[Judge] DISMISS置信度不足（${ruling.confidence}%），自动转为DOWNGRADE`);
                ruling.final_decision = 'DOWNGRADE';
                ruling.revised_risk = {
                    ...risk,
                    risk_level: 'Low',
                    description: risk.description + '\n\n【裁决意见】：' + ruling.ruling_reason
                };
            } else {
                console.log(`[Judge] DISMISS（置信度：${ruling.confidence}%）：${ruling.ruling_reason.substring(0, 50)}...`);
            }
        }

        if (ruling.final_decision === 'DISMISS') {
            return null; // Remove this risk
        }

        // Return revised risk with additional debate info
        return {
            ...risk,
            risk_level: ruling.revised_risk?.risk_level || risk.risk_level,
            description: ruling.revised_risk?.description || risk.description,
            suggestion: ruling.revised_risk?.suggestion || risk.suggestion,
            internal_caliber_ref: risk.internal_caliber_ref,
            defense: defense,
            rulingReason: ruling.ruling_reason,
            confidence: ruling.confidence
        };

    } catch (e) {
        console.error("Judge failed:", e);
        return risk; // Fallback: 保留原风险
    }
}
