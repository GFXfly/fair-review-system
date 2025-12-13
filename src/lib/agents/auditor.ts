import { callLLM } from '@/lib/llm';
import { searchSimilarCases, searchSimilarRegulations } from '@/lib/rag';
import { TextChunker } from '@/lib/text-utils';

export interface AuditIssue {
    id: string;
    risk_level: 'High' | 'Medium' | 'Low';
    description: string;
    location: string; // Quote from the text
    suggestion: string;
    reference?: string; // Reference to similar case or regulation
    violated_law: string; // Specific article, e.g., "《公平竞争审查条例》第十条第一款"
}

export async function runAuditor(category: string, text: string, guidance: string = ""): Promise<AuditIssue[]> {
    console.log('Running Auditor on category:', category);

    // 1. Sliding Window RAG Retrieval: Scan full text for relevant knowledge
    const collectedCases = new Map<number, any>();
    const collectedRegs = new Map<number, any>();

    // Use sliding window from TextChunker
    let chunksProcessed = 0;
    const maxChunks = 5; // Limit to 5 chunks for performance

    for (const chunk of TextChunker.slidingWindow(text, 1000, 200)) {
        if (chunksProcessed >= maxChunks) break;

        const [cases, regs] = await Promise.all([
            searchSimilarCases(chunk, 2), // Top 2 per chunk
            searchSimilarRegulations(chunk, 1) // Top 1 per chunk
        ]);

        cases.forEach((c: any) => collectedCases.set(c.id, c));
        regs.forEach((r: any) => collectedRegs.set(r.id, r));

        chunksProcessed++;
    }

    // Convert Maps to Arrays and limit total context
    const uniqueCases = Array.from(collectedCases.values()).slice(0, 5); // Max 5 unique cases
    const uniqueRegs = Array.from(collectedRegs.values()).slice(0, 3);   // Max 3 unique regs

    let ragContext = "";

    if (uniqueCases.length > 0) {
        ragContext += "\n参考历史违规案例（请仔细比对违规**本质**，而非表面文字）：\n";
        ragContext += "【重要】匹配案例时，请关注：\n";
        ragContext += "1. 违规的核心性质（地域限制？资质限制？给予特定企业优惠？）\n";
        ragContext += "2. 限制的主体对象（本地vs外地？特定企业vs一般企业？）\n";
        ragContext += "3. 违规的程度（强制性要求？鼓励性条款？）\n\n";

        uniqueCases.forEach((c, idx) => {
            // 提供更完整的案例信息
            ragContext += `${idx + 1}. 【${c.violationType}】${c.title}\n`;
            ragContext += `   案情：${c.content.substring(0, 300)}...\n`;

            // 重点标注违规要点
            if (c.violationDetail) {
                ragContext += `   ⚠️ 违规要点：${c.violationDetail}\n`;
            }

            if (c.result) {
                ragContext += `   处理结果：${c.result}\n`;
            }

            // 添加违规类型标签
            if (c.violationType) {
                ragContext += `   违规类型标签：${c.violationType}\n`;
            }

            ragContext += `\n`;
        });
    }

    if (uniqueRegs.length > 0) {
        ragContext += "\n相关法律法规依据（请在 violated_law 字段中完整引用具体条款）：\n";
        uniqueRegs.forEach((r, idx) => {
            // 提供更完整的法规内容，以便 AI 能够引用具体条款
            ragContext += `${idx + 1}. 《${r.title}》\n`;
            ragContext += `   内容：${r.content ? r.content.substring(0, 1000) : '暂无'}...\n\n`;
        });
    }

    const systemPrompt = `
    你是一个资深的"公平竞争审查"审计员（Auditor）。你的任务是根据《公平竞争审查条例》及相关法律法规，审查政府文件是否存在排除、限制竞争的内容。

    当前的审查类别是：${category}。

    审查重点：
    1. **市场准入和退出**: 是否设置不合理的准入壁垒？是否设置不合理的审批前置条件？
    2. **商品和要素自由流动**: 是否限制外地商品、服务进入本地市场？是否排斥外地经营者参与本地招标投标？
    3. **影响生产经营成本**: 是否给予特定经营者税收优惠、财政补贴（除非法律规定）？是否要求企业缴纳不合理的保证金？
    4. **影响生产经营行为**: 是否强制企业从事《反垄断法》禁止的垄断行为？是否干预实行市场调节价的商品价格？

    参考知识库信息：
    ${guidance}

    ${ragContext}

    请仔细阅读文件内容，找出所有潜在的风险点。
    
    **违规类型分类体系**（用于准确匹配相似案例）：
    
    1️⃣ **地域性限制**
       - 本质：基于地理位置、注册地、纳税地的区别对待
       - 关键词：本地/外地、本省/外省、本市注册、在本地纳税
       - 表现形式：限制外地企业、要求本地注册、限制跨区域经营
    
    2️⃣ **所有制歧视**
       - 本质：基于企业所有制性质的区别对待
       - 关键词：国有企业、民营企业、外资企业
       - 表现形式：优先国企、限制民企、排斥外资
    
    3️⃣ **规模/业绩限制**
       - 本质：基于企业规模、营收、纳税额的门槛设置
       - 关键词：年营收XX万以上、纳税额、注册资本、企业规模
       - 表现形式：设置过高的规模门槛、与业绩挂钩的奖励
    
    4️⃣ **资质/荣誉限制**
       - 本质：基于特定资质、称号、认证的准入或优惠
       - 关键词：示范企业、龙头企业、高新技术企业、特定资质
       - 表现形式：要求特定荣誉称号、限定资质等级
    
    5️⃣ **指定交易/排他性**
       - 本质：指定特定企业或排除其他竞争者
       - 关键词：指定、独家、唯一、排他
       - 表现形式：指定供应商、限定品牌、强制交易
    
    6️⃣ **财政优惠/补贴**
       - 本质：给予特定企业选择性的财政支持
       - 关键词：税收返还、财政奖励、专项补贴、优惠政策
       - 表现形式：选择性奖励、差异化补贴、定向优惠
    
    7️⃣ **不合理的准入/退出条件**
       - 本质：设置不合理的市场进入或退出障碍
       - 关键词：前置条件、审批要求、强制承诺、退出限制
       - 表现形式：不必要的审批、承诺X年不迁出
    
    **案例匹配原则**（普遍适用）：
    ✅ 匹配标准：
       - 违规类型相同（同属上述7类中的同一类）
       - 限制对象相同（都是限制外地/都是限制某类企业）
       - 违规程度相近（都是强制要求/都是鼓励性）
    
    ❌ 不匹配情况：
       - 类型1（地域限制）≠ 类型4（资质限制）
       - 类型3（规模限制）≠ 类型2（所有制歧视）
       - 强制性要求 ≠ 鼓励性条款
    
    ⚠️ **引用案例时**：
       - 必须先判断当前风险属于哪一类型
       - 只引用**同类型**的案例
       - 如果检索到的案例与当前风险类型不一致，reference留空
       - 在reference中明确说明"违规类型：XXX"

    **重要要求**：
    1. violated_law 字段必须包含完整的法条内容
    2. reference 字段**只在违规类型完全一致时**才引用，格式：
       "【案例标题】违规类型：[1-7中的哪一类]。违规要点：XXX。处理结果：XXX。"
    3. 如果没有同类型案例，reference留空或填"暂无完全匹配的相似案例"

    请以 JSON 数组格式返回结果，每个风险点包含以下字段：
    [
        {
            "id": "risk_1",
            "risk_level": "High" | "Medium" | "Low",
            "description": "详细描述风险点，解释为什么违规。首先说明属于哪种违规类型。",
            "violated_law": "《法规名称》第X条第X款：【完整法条原文内容】",
            "location": "原文引用（20字左右），用于定位。",
            "suggestion": "具体的修改建议。",
            "reference": "【仅在违规类型一致时填写】格式：【案例标题】违规类型：XXX。违规要点：XXX。"
        }
    ]

    如果未发现风险，请返回空数组 []。
    `;

    // Use TextChunker for consistent truncation
    const truncatedText = TextChunker.getChunkForAgent(text, 'auditor');

    const userPrompt = `
    文件内容：
    ${truncatedText}
    `;

    const resultStr = await callLLM(systemPrompt, userPrompt, true, 'deepseek-chat');

    if (!resultStr) {
        return [];
    }

    try {
        const issues = JSON.parse(resultStr) as AuditIssue[];
        // Ensure IDs are unique
        return issues.map((issue, index) => ({ ...issue, id: `risk_${Date.now()}_${index}` }));
    } catch (e) {
        console.error('Failed to parse Auditor JSON:', resultStr);
        return [];
    }
}
