import { callLLM } from '@/lib/llm';
import { searchSimilarCases, searchSimilarRegulations } from '@/lib/rag';
import { TextChunker } from '@/lib/text-utils';
import { APP_CONFIG } from '@/lib/config';

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

    // ==========================================
    // 🔥 优化：改用单次全文摘要检索
    // ==========================================

    // 使用配置文件中的参数
    const { rag } = APP_CONFIG;

    // 使用前5000字作为检索摘要
    const summaryForRAG = TextChunker.truncate(text, rag.ragInputLength);

    console.log(`[RAG] 使用 ${summaryForRAG.length} 字进行知识库检索`);

    // 单次检索，应用相似度阈值
    const [allCases, allRegs] = await Promise.all([
        searchSimilarCases(summaryForRAG, rag.maxCasesPerQuery, rag.caseSimilarityThreshold),
        searchSimilarRegulations(summaryForRAG, rag.maxRegulationsPerQuery, rag.regulationSimilarityThreshold)
    ]);

    // 最终取配置数量的案例和法规
    const uniqueCases = allCases.slice(0, rag.finalCasesCount);
    const uniqueRegs = allRegs.slice(0, rag.finalRegulationsCount);

    // ==========================================
    // 🔥 检索质量日志
    // ==========================================

    console.log(`[RAG] 检索结果统计：`);
    console.log(`  - 案例数：${uniqueCases.length}/${rag.finalCasesCount}`);
    if (uniqueCases.length > 0) {
        const similarities = uniqueCases.map(c => c.similarity);
        console.log(`  - 案例相似度范围：${(Math.min(...similarities) * 100).toFixed(1)}% ~ ${(Math.max(...similarities) * 100).toFixed(1)}%`);
    }
    console.log(`  - 法规数：${uniqueRegs.length}/${rag.finalRegulationsCount}`);
    if (uniqueRegs.length > 0) {
        const similarities = uniqueRegs.map(r => r.similarity);
        console.log(`  - 法规相似度范围：${(Math.min(...similarities) * 100).toFixed(1)}% ~ ${(Math.max(...similarities) * 100).toFixed(1)}%`);
    }

    // 警告：高质量案例不足
    const highQualityCases = uniqueCases.filter(c => c.similarity > rag.highQualityThreshold);
    if (highQualityCases.length < rag.minHighQualityCases) {
        console.warn(`[RAG] ⚠️  高相关性案例不足（>75%：${highQualityCases.length}个），可能影响判断准确性`);
    }

    // ==========================================
    // 🔥 构建RAG上下文（标注相似度）
    // ==========================================

    let ragContext = "";

    if (uniqueCases.length > 0) {
        ragContext += "\n参考历史违规案例（请仔细比对违规**本质**，而非表面文字）：\n";
        ragContext += "【重要】匹配案例时，请关注：\n";
        ragContext += "1. 违规的核心性质（地域限制？资质限制？给予特定企业优惠？）\n";
        ragContext += "2. 限制的主体对象（本地vs外地？特定企业vs一般企业？）\n";
        ragContext += "3. 违规的程度（强制性要求？鼓励性条款？）\n";
        ragContext += "4. 相似度指标：>75%为高度相似，60-75%为中度相似，<60%为参考\n\n";

        uniqueCases.forEach((c, idx) => {
            const similarityPercent = (c.similarity * 100).toFixed(1);
            const similarityLabel = c.similarity > 0.75 ? '【高度相似】' :
                                   c.similarity > 0.65 ? '【中度相似】' : '【参考】';

            ragContext += `案例${idx + 1} ${similarityLabel}（相似度：${similarityPercent}%）\n`;
            ragContext += `   标题：【${c.violationType}】${c.title}\n`;
            ragContext += `   案情：${c.content.substring(0, 300)}...\n`;

            // 重点标注违规要点
            if (c.violationDetail) {
                ragContext += `   ⚠️ 违规要点：${c.violationDetail}\n`;
            }

            if (c.result) {
                ragContext += `   处理结果：${c.result}\n`;
            }

            ragContext += `\n`;
        });
    } else {
        // 如果没有检索到案例，提示AI
        ragContext += "\n⚠️ 未检索到高相关性历史案例（相似度<65%），请仅依据法规进行独立判断。\n\n";
    }

    if (uniqueRegs.length > 0) {
        ragContext += "\n相关法律法规依据（请在 violated_law 字段中完整引用具体条款）：\n";
        uniqueRegs.forEach((r, idx) => {
            const similarityPercent = (r.similarity * 100).toFixed(1);
            ragContext += `法规${idx + 1}（相似度：${similarityPercent}%）：《${r.title}》\n`;
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

    // ==========================================
    // 🔥 Few-shot示例教学
    // ==========================================

    **示例教学**（请严格参照以下示例的判定逻辑）：

    【示例1：明确违规 - High风险】
    原文引用："投标人须为本市注册企业，外地企业不得参与本项目投标。"

    AI判定过程：
    1. 识别违规类型：地域性限制（类型1）
    2. 判定核心要素：
       - 限制对象：外地企业（明确排斥）
       - 限制手段："不得参与"（强制性禁止）
       - 限制范围：所有外地企业（无例外）
    3. 检索案例：假设有案例相似度82%
    4. 风险等级：High（明确违反《条例》第十条，有相似案例）

    输出JSON：
    {
        "id": "risk_1",
        "risk_level": "High",
        "description": "【地域性限制】文件明确要求投标人必须为本市注册企业，直接排斥外地企业参与投标，违反了《公平竞争审查条例》第十条关于'不得设置不合理的条件排斥或者限制外地经营者参加本地招标投标活动'的规定。这是典型的地域性市场分割，限制手段直接、强制，且无合理例外。",
        "violated_law": "《公平竞争审查条例》第十条第一款：不得设置不合理的条件排斥或者限制外地经营者参加本地招标投标活动，或者排斥、限制、强制外地经营者在本地投资或者设立分支机构。",
        "location": "投标人须为本市注册企业，外地企业不得参与本项目投标",
        "suggestion": "建议删除'本市注册企业'的要求，改为'依法注册的企业'，不限制注册地域。",
        "reference": "【某市政府采购限制外地企业案】违规类型：地域性限制（类型1）。相似度：82%。违规要点：招标文件要求投标人必须在本市注册，排斥外地企业。处理结果：责令改正，废止违规条款。"
    }

    【示例2：灰色地带 - Medium风险】
    原文引用："优先支持年纳税额1000万元以上的企业申报项目。"

    AI判定过程：
    1. 识别违规类型：规模/业绩限制（类型3）+ 财政优惠（类型6）
    2. 判定核心要素：
       - 限制对象：小规模企业（间接排斥）
       - 限制手段："优先支持"（非强制，但有差别待遇）
       - 限制范围：年纳税额<1000万的企业（受影响面中等）
    3. 检索案例：假设有案例相似度68%
    4. 风险等级：Medium（属于选择性支持，但可能有产业政策依据）

    输出JSON：
    {
        "id": "risk_2",
        "risk_level": "Medium",
        "description": "【规模/业绩限制 + 财政优惠】文件设置年纳税额1000万元的门槛，并给予'优先支持'，这属于选择性支持政策，可能对中小企业构成不公平竞争。虽然使用的是'优先'而非'限制'的表述，但实质上形成了基于企业规模的差别待遇。需注意是否有明确的产业政策或法律依据支撑该门槛设置。",
        "violated_law": "《公平竞争审查条例》第十二条：除法律、行政法规另有规定外，不得给予特定经营者优惠政策。",
        "location": "优先支持年纳税额1000万元以上的企业申报项目",
        "suggestion": "建议取消纳税额门槛，或说明该政策的法律依据（如《产业结构调整指导目录》等）。如确需支持大企业，建议改为按行业分类、技术水平等市场化标准，而非简单的规模标准。",
        "reference": "【某市大企业奖励政策案】违规类型：规模/业绩限制（类型3）。相似度：68%。违规要点：对年营收5000万以上的企业给予财政奖励。处理结果：要求调整标准，改为技术创新等市场化指标。"
    }

    【示例3：合理要求 - 不构成风险】
    原文引用："投标人须具备建筑工程施工总承包二级及以上资质，且近三年无重大安全事故。"

    AI判定过程：
    1. 初步怀疑：资质/荣誉限制（类型4）？
    2. 深入分析：
       - 资质要求：行业准入必要条件（《建筑法》规定）
       - 安全记录：合规管理需要，非歧视性条件
       - 检索案例：无相似违规案例
    3. 结论：不构成公平竞争风险

    输出：不在JSON数组中包含该条

    // ==========================================
    // 🔥 风险等级量化标准
    // ==========================================

    **风险等级判定流程**（请严格执行）：

    判定维度打分：

    维度1：限制手段
      - 强制性（"必须"、"不得"、"禁止"） → +3分
      - 鼓励性（"优先"、"支持"） → +2分
      - 建议性（"鼓励"、"倡导"） → +1分

    维度2：限制范围
      - 所有/大多数经营者 → +3分
      - 特定行业/领域 → +2分
      - 个别情形 → +1分

    维度3：案例支撑
      - 有完全匹配案例（相似度>75%） → +3分
      - 有中度相似案例（60-75%） → +2分
      - 无相似案例（<60%） → +1分

    维度4：法律明确性
      - 明确违反《条例》禁止性规定 → +3分
      - 与《条例》精神不符 → +2分
      - 灰色地带 → +1分

    总分判定：
    - 10-12分 → High
    - 7-9分 → Medium
    - 4-6分 → Low
    - <4分 → 不构成风险

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

    // ==========================================
    // 🔥 案例引用自检机制
    // ==========================================

    **案例引用检查清单**（每次引用前必须完成）：

    □ 步骤1：确认当前风险属于哪一类（1-7）
    □ 步骤2：检查案例是否属于同一类
    □ 步骤3：检查相似度是否≥60%
    □ 步骤4：如果上述任一不满足 → reference留空 ""

    reference格式模板：
    "【\${案例标题}】违规类型：\${类型名称}（类型\${1-7}）。相似度：\${XX}%。违规要点：\${核心违规内容}。处理结果：\${处理方式}。"

    错误示例（禁止）：
    ❌ "参考类似案例..." （未明确指出案例标题）
    ❌ "根据某市案例..." （未标注相似度）
    ❌ 引用不同类型的案例

    // ==========================================
    // 🔥 输出质量要求
    // ==========================================

    【输出质量要求】

    1. description字段（150-300字）：
       ✓ 第一句：明确说明违规类型（如"【地域性限制】"）
       ✓ 第二句：描述具体违规内容
       ✓ 第三句：说明为什么违规（法律依据）
       ✓ 第四句：补充说明（如限制程度、影响范围等）

    2. violated_law字段：
       ✓ 必须包含完整法条：《XX法/条例》第X条第X款：【法条原文】
       ✗ 禁止：只写"违反公平竞争审查条例"（不具体）

    3. location字段（15-30字）：
       ✓ 从原文中精确摘抄
       ✓ 选择最能体现违规本质的句子

    4. suggestion字段（100-200字）：
       ✓ 提供具体的修改建议
       ✓ 说明修改后的表述示例

    5. reference字段：
       ✓ 完全按照模板格式输出
       ✓ 如果无匹配案例，留空：""或"暂无完全匹配的案例"

    请以 JSON 数组格式返回结果，每个风险点包含以下字段：
    [
        {
            "id": "risk_1",
            "risk_level": "High" | "Medium" | "Low",
            "description": "详细描述风险点，解释为什么违规。首先说明属于哪种违规类型。",
            "violated_law": "《法规名称》第X条第X款：【完整法条原文内容】",
            "location": "原文引用（20字左右），用于定位。",
            "suggestion": "具体的修改建议。",
            "reference": "【仅在违规类型一致时填写】格式：【案例标题】违规类型：XXX。相似度：XX%。违规要点：XXX。"
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
