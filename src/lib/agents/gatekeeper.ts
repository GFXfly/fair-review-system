import { callLLM } from '@/lib/llm';

interface GatekeeperResult {
    needs_review: boolean;
    category: 'POLICY' | 'BIDDING' | 'AGREEMENT' | 'IGNORE';
    reason: string;
}

export async function runGatekeeper(fileName: string, textSummary: string, _keywordStats: Record<string, number>): Promise<GatekeeperResult> {
    console.log('Running Gatekeeper on:', fileName);

    const systemPrompt = `
    你是一个“公平竞争审查系统”的守门员（Gatekeeper）。你的任务是判断一份政府文件是否属于审查范畴。
    
    【核心原则】：只有涉及“市场主体经济活动”（如市场准入、产业发展、招商引资、招标采购、经营行为规范、资质标准等）的文件才需要审查。

    【分类指南】：
    1. **需要审查 (needs_review: true)**
       - **POLICY (政策措施)**: 涉及产业扶持、奖补资金、行业标准、市场准入、特许经营、价格干预等。
       - **BIDDING (招标采购)**: 招标文件、采购公告、评分办法。（关键词：招标、比选、磋商、采购文件）
       - **AGREEMENT (政企协议)**: 政府与特定企业签订的投资协议、合作框架协议。（关键词：投资协议、入驻协议）

    2. **无需审查 (needs_review: false)** -> 必须归类为 **IGNORE**
       - **内部行政管理**: 人事任免、三公经费、内部会议纪要、值班安排、党建学习。
       - **纯技术标准**: 仅涉及工程技术参数、操作规范，不涉及资质限制或市场准入的。
       - **宏观宣誓性文件**: 仅表达原则性立场，不包含具体政策措施的讲话稿、工作方案。
       - **表彰通报**: 仅对已发生事项进行表彰，不承诺后续物质奖励的。
       - **个案执法**: 针对特定违法行为的行政处罚决定书（这是执法结果，不是政策制定）。

    请仔细读取文件名和前2000字摘要，尤其是文件名中的关键词。

    请以 JSON 格式返回结果：
    {
        "needs_review": boolean,
        "category": "POLICY" | "BIDDING" | "AGREEMENT" | "IGNORE",
        "reason": "请明确说明理由。例如：'这是内部人事任免文件，不涉及市场主体' 或 '涉及产业奖补，属于审查对象'。"
    }

    `;

    const userPrompt = `
    文件名: ${fileName}
    文件内容摘要:
    ${textSummary}
    `;

    const resultStr = await callLLM(systemPrompt, userPrompt, true, 'deepseek-chat');

    if (!resultStr) {
        // Fallback if LLM fails
        return {
            needs_review: true,
            category: 'POLICY', // Default to POLICY to be safe
            reason: 'AI分析失败，默认建议人工审查。'
        };
    }

    try {
        const result = JSON.parse(resultStr) as GatekeeperResult;
        return result;
    } catch (e) {
        console.error('Failed to parse Gatekeeper JSON:', resultStr);
        return {
            needs_review: true,
            category: 'POLICY',
            reason: 'AI返回格式错误，默认建议人工审查。'
        };
    }
}
