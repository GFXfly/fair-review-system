import { callLLM } from '@/lib/llm';

interface GatekeeperResult {
    needs_review: boolean;
    category: 'POLICY' | 'BIDDING' | 'AGREEMENT' | 'IGNORE';
    reason: string;
}

export async function runGatekeeper(fileName: string, textSummary: string, _keywordStats: Record<string, number>): Promise<GatekeeperResult> {
    console.log('Running Gatekeeper on:', fileName);

    const systemPrompt = `
    你是一个严谨的"公平竞争审查系统"守门员。你的核心任务是精准判断文件是否属于审查范畴。

    【⚠️ 特别重要：招标/采购文件必须审查】
    根据《浙江省招标投标领域公平竞争审查细则》，**招标文件、采购文件、资格预审文件**等属于重点审查对象！
    - 招标文件虽然是针对具体项目，但其**资格条件、评分标准、技术要求**可能含有排除或限制竞争的条款
    - 不要将招标/采购文件误判为"个案行政执法"或"过程性文件"
    - 只要是招标/采购/政府购买服务类文件，一律 needs_review = true，category = "BIDDING"

    【判断核心原则】：
    **只有同时满足以下两个条件的文件，才属于审查对象：**
    1. **主体条件**：文件的约束对象或影响对象不仅仅是机关内部，必须包含**外部经营者**（企业、个体工商户、行业协会、投标人等）。
    2. **行为条件**：文件内容实质性影响了经营者的**经济活动利益**（如设定市场准入、干预定价、指定交易、发放补贴、增减成本、设定投标资格条件等）。

    【类别判定标准】：
    - **BIDDING**（招标采购类）：招标文件、采购文件、资格预审文件、询价文件、竞争性谈判文件、政府购买服务文件等。这类文件**必须审查**！
    - **POLICY**（政策文件类）：产业政策、扶持办法、补贴政策、管理办法等规范性文件
    - **AGREEMENT**（协议合同类）：政府与企业签订的投资协议、合作框架协议等
    - **IGNORE**（无需审查类）：纯内部管理文件、事务性文件等

    【三步判别法】（请按此逻辑进行内部推理）：
    1. **第一步：看对象**。是写给谁看的？
       - 如果是：机关内部处室、党员干部、事业单位人员 -> **无需审查 (IGNORE)**
       - 如果是：辖区企业、投标人、社会公众、行业协会 -> 进入下一步

    2. **第二步：看内容**。是否涉及经济权利义务？
       - 是否涉及：市场准入/退出、投标资格条件、评分标准、商品自由流动、生产经营成本（奖补/收费）、生产经营行为（指定交易/强制要求）。
       - 如果全无（如仅是号召口号、文明城市创建倡议、工作总结） -> **无需审查 (IGNORE)**
       - 如果有 -> 进入下一步

    3. **第三步：排除例外**。是否属于以下豁免类别？
       - (1) 内部管理性文件（人事/财务/三公/保密）
       - (2) 一般事务性文件（会议通知/工作报告/领导讲话）
       - (3) 过程性文件（请示/函/征求意见稿本身）【注意：招标文件不属于此类！】
       - (4) 个案行政执法结果（行政处罚决定书、许可批复）【注意：招标文件不属于此类！】
       - (5) 党务文件
       - (6) 纯技术标准（不涉市场准入）
       -> 如果是 -> **无需审查 (IGNORE)**

    【特别提醒】：
    - 文件名或内容包含"招标"、"采购"、"投标人"、"资格条件"、"评审标准"等关键词时，大概率是 BIDDING 类，需要审查
    - 招标文件设定的投标资格条件（注册资本、业绩要求、地域限制等）是重点审查内容

    请以 JSON 格式返回结果（字段说明）：
    {
        "needs_review": boolean, // 只有通过上述三步筛选才为 true
        "category": "POLICY" | "BIDDING" | "AGREEMENT" | "IGNORE",
        "reason": "请用一句话总结你的三步判断逻辑。例如：'虽然涉及企业，但这只是个案行政处罚，不属于政策制定，故不需审查' 或 '这是政府采购招标文件，设定了投标人资格条件，属于招标类文件，需要审查'。"
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
