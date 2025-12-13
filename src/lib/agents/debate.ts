
import { callLLM, DEEPSEEK_REASONER_MODEL, QWEN_MODEL, GLM_MODEL } from '@/lib/llm';
import { TextChunker } from '@/lib/text-utils';
import { AuditIssue } from './auditor';

export const DEBATE_MODEL = QWEN_MODEL; // Defender uses Qwen (SiliconFlow)
export const JUDGE_MODEL = GLM_MODEL;   // Judge uses GLM (SiliconFlow)

/**
 * Agent B: The Defender
 * Tries to find exculpatory evidence or exceptions for a given risk.
 */
export async function runDefender(risk: AuditIssue, docText: string): Promise<string> {
    const prompt = `
你是一名资深的公平竞争审查政策顾问，通过仔细研究文件上下文和法律例外条款，为被指控“违规”的条款寻找辩护理由。

【背景】
审查员认为文件中的以下内容存在公平竞争风险：
- 风险描述：${risk.description}
- 风险等级：${risk.risk_level}
- 所在位置：${risk.location}

【任务】
请阅读以下文件全文片段（或全文），尝试针对上述指控进行辩护。
思考方向：
1. 该条款是否属于《公平竞争审查条例》规定的例外情形（如国家安全、扶贫开发、救灾抢险等）？
2. 该条款的“限制”是否具有合理性（如为了实现特定的社会公共利益，且没有更好替代方案）？
3. 上下文中是否有其他前置条件减免了其违规性？

【文件内容】
${TextChunker.getChunkForAgent(docText, 'debate')} ... (此处可能省略部分内容)

【输出要求】
请直接输出一段简练的“辩护词”。
如果确实无法找到合理解释，请直接回答：“无有效辩护理由。”
`;

    try {
        const response = await callLLM(
            "你是一名专业的政策合规辩护律师。请进行深度思考，使用逻辑推理寻找合法的辩护切入点。",
            prompt,
            false, // text mode
            DEBATE_MODEL // Use Qwen for defense
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
export async function runJudge(risk: AuditIssue, defense: string): Promise<AuditIssue | null> {
    // If no defense, the risk stands automatically
    if (defense.includes("无有效辩护理由") || defense.includes("辩护服务暂时不可用")) {
        return risk;
    }

    const prompt = `
你是一名公正的公平竞争审查主审官。请根据审查员的指控和起草人的辩护，对该风险点进行最终裁决。

【审查员指控】
- 描述：${risk.description}
- 原始判定等级：${risk.risk_level}

【起草人辩护】
${defense}

【任务】
1. 分析辩护理由是否成立。
2. 判定该风险点是否应该被保留、降级或驳回。

【输出格式 (JSON)】
{
    "final_decision": "MAINTAIN" | "DOWNGRADE" | "DISMISS",
    "confidence": 0-100, // 置信度
    "ruling_reason": "简要说明裁决理由",
    "revised_risk": {  // 仅在 MAINTAIN 或 DOWNGRADE 时需要
        "risk_level": "High" | "Medium" | "Low",
        "description": "修正后的风险描述（如果需要补充裁决观点）",
        "suggestion": "修正后的整改建议"
    }
}
`;

    try {
        const responseCtx = await callLLM(
            "你是一名公正的法官。请输出 JSON 格式的裁决结果。",
            prompt,
            true, // JSON mode
            JUDGE_MODEL // Use GLM for judging
        );

        if (!responseCtx) return risk; // Fallback

        const ruling = JSON.parse(responseCtx);

        if (ruling.final_decision === 'DISMISS') {
            return null; // Remove this risk
        }

        // Return revised risk
        return {
            ...risk,
            risk_level: ruling.revised_risk?.risk_level || risk.risk_level,
            description: ruling.revised_risk?.description || risk.description,
            suggestion: ruling.revised_risk?.suggestion || risk.suggestion
        };

    } catch (e) {
        console.error("Judge failed:", e);
        return risk; // Fallback to original risk
    }
}
