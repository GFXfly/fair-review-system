
import { callLLM, DEEPSEEK_MODEL, DEEPSEEK_REASONER_MODEL, QWEN_MODEL, GLM_MODEL } from '@/lib/llm';
import { TextChunker } from '@/lib/text-utils';
import { AuditIssue } from './auditor';
import { APP_CONFIG } from '@/lib/config';

// ==========================================
// 🔥 优化2：模型配置（能力对等的多样性）
// ==========================================
export const DEBATE_MODEL = QWEN_MODEL;      // Defender: Qwen3-235B-A22B（最强辩护能力）
export const JUDGE_MODEL = DEEPSEEK_REASONER_MODEL;   // Judge: DeepSeek V3.2 思考模式（强力裁决）

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
1. 该条款是否属于公平竞争审查相关法规（如《公平竞争审查条例》、地方审查细则）规定的例外情形？
2. 该条款的“限制”是否具有必要性、合理性（如为了实现特定的社会公共利益，且没有更好替代方案）？
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
你是一名公正严谨的公平竞争审查主审官。请根据审查员的指控和起草人的辩护，对该风险点进行最终裁决。

【审查员指控】
- 描述：${risk.description}
- 原始判定等级：${risk.risk_level}
- 违反条款：${risk.violated_law}

【起草人辩护】
${defense}

// ==========================================
// 🔥 裁决标准（从严把握）
// ==========================================

【裁决标准】（⚠️ 请严格遵守）

1. **DISMISS（驳回风险）** - 仅在以下情况才可选择：
   必要条件（全部满足）：
   ✓ 辩护明确引用了公平竞争审查相关法规（如《公平竞争审查条例》第五条等）所规定的例外情形
   ✓ 文件内容确实符合该例外情形，且有充分证据支持
   ✓ 例外适用范围明确、限期清晰，不存在滥用可能

   排除情况（有以下任一情况不得DISMISS）：
   ✗ 辩护理由含糊不清，未明确指出具体法律依据
   ✗ 辩护仅提出"可能性"、"或许"等模糊表述
   ✗ 辩护引用了非公平竞争审查领域的法规（如地方自主权、产业政策等）
   ✗ 辩护理由是"普遍做法"、"参考其他地区"（这不构成合法性）

2. **DOWNGRADE（降级）** - 以下情况可降级：
   ✓ 辩护指出了合理的减轻情节（如限制范围较小、影响有限）
   ✓ 文件措辞不够明确，存在解释空间
   ✓ 可通过轻微修改消除风险

3. **MAINTAIN（维持）** - 默认选择，以下情况必须维持：
   ✓ 辩护理由不足以推翻原判
   ✓ 辩护未提供有效法律依据
   ✓ 风险明确且严重

【裁决原则】
- **宁可维持，不轻易驳回**：如有疑问，默认选择 MAINTAIN
- **从严把握DISMISS**：只有辩护理由完全成立且有明确法律依据时才可DISMISS
- **置信度要求**：DISMISS决定要求置信度≥85%，否则改为DOWNGRADE
- **理由清晰**：ruling_reason 必须说明具体依据，不能含糊其辞

【输出格式 (JSON)】
{
    "final_decision": "MAINTAIN" | "DOWNGRADE" | "DISMISS",
    "confidence": 0-100, // 你对该决定的置信度
    "ruling_reason": "详细说明裁决理由，包括：\n1. 辩护理由是否成立\n2. 法律依据是否充分\n3. 做出该决定的具体依据",
    "revised_risk": {  // 仅在 MAINTAIN 或 DOWNGRADE 时需要
        "risk_level": "High" | "Medium" | "Low",
        "description": "如需修正风险描述，在此填写",
        "suggestion": "如需修正整改建议，在此填写"
    }
}

⚠️ 特别提醒：本系统用于政府文件合规审查，宁可谨慎（维持风险），不可疏漏（错误驳回）。
`;

    try {
        const responseCtx = await callLLM(
            "你是一名公正严谨的法官。请严格按照标准进行裁决，输出 JSON 格式结果。",
            prompt,
            true, // JSON mode
            JUDGE_MODEL // Use DeepSeek V3 for judging
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
            defense: defense,
            rulingReason: ruling.ruling_reason,
            confidence: ruling.confidence
        };

    } catch (e) {
        console.error("Judge failed:", e);
        return risk; // Fallback: 保留原风险
    }
}
