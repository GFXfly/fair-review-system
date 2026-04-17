import { callLLM } from '@/lib/llm';
import { searchSimilarCases, searchSimilarRegulations } from '@/lib/rag';
import { TextChunker } from '@/lib/text-utils';
import { APP_CONFIG } from '@/lib/config';
import { RetrievalAgent } from './retrieval';

export interface AuditIssue {
    id: string;
    risk_level: 'High' | 'Medium' | 'Low';
    description: string;
    location: string; // Quote from the text
    suggestion: string;
    reference?: string; // Reference to similar case or regulation
    violated_law: string; // Specific article, e.g., "《公平竞争审查条例》第十条第一款"

    // Optional debate fields
    defense?: string;
    rulingReason?: string;
    confidence?: number;
}

const KEYWORD_WINDOW_SIZE = 8000;
const KEYWORD_WINDOW_OVERLAP = 1000;
const KEYWORD_MAX_WINDOWS = 4;
const KEYWORD_WINDOW_CONCURRENCY = Math.max(
    1,
    parseInt(process.env.KEYWORD_WINDOW_CONCURRENCY || '2'),
);

function buildSlidingWindows(text: string): string[] {
    if (text.length <= KEYWORD_WINDOW_SIZE) return [text];
    const windows: string[] = [];
    const step = KEYWORD_WINDOW_SIZE - KEYWORD_WINDOW_OVERLAP;
    for (let start = 0; start < text.length; start += step) {
        windows.push(text.substring(start, start + KEYWORD_WINDOW_SIZE));
        if (windows.length >= KEYWORD_MAX_WINDOWS) break;
    }
    return windows;
}

/**
 * 🔥 风险片段提取
 * 用于在正式审查前，快速识别文档中可能涉及公平竞争问题的关键片段。
 * - 短文档直接扫描一次；长文档用滑动窗口覆盖全文后去重合并。
 */
async function extractRiskKeywords(text: string): Promise<string[]> {
    const windows = buildSlidingWindows(text);
    console.log(`[RAG] 风险片段扫描：文档长度=${text.length}, 窗口数=${windows.length}`);

    const systemPrompt = `
你是一个公平竞争审查专家。请快速扫描以下政府文件，提取出所有可能涉及公平竞争问题的"风险关键片段"。

**提取规则**：
1. 每个片段应该是一个完整的政策描述（20-100字）
2. 直接复制原文中的相关句子，不要改写
3. 最多提取8个最关键的片段

**重点关注以下四大维度的风险类型**：

【维度一：市场准入和退出】
- 地域限制："本地企业"、"外地企业不得参与"、"本市注册"、"在本地设立分支机构"
- 所有制歧视："国有企业优先"、"民营企业"、"国有控股"、"外资企业"
- 规模/业绩限制："规模以上企业"、"年产值XX万以上"、"纳税额达到"、"营业收入不低于"
- 资质限制："须具备XX资质"、"近三年业绩"、"中标经验"、"行业排名前XX"

【维度二：商品和要素自由流动】
- 指定品牌/产地："须使用XX品牌"、"本地产品优先"、"国产优先"、"进口产品"
- 指定供应商："须从XX单位采购"、"指定服务商"、"唯一供应商"
- 技术壁垒："须采用XX技术标准"、"持有XX专利"

【维度三：影响生产经营成本】
- 财政补贴/奖励："给予奖励"、"财政补贴"、"扶持资金"、"产业引导资金"
- 税收优惠："税收返还"、"税收减免"、"税收优惠"
- 土地/资源优惠："优惠供地"、"用地指标"、"水电气优惠"
- 收费/保证金："收取保证金"、"投标保证金"、"履约保证金比例"

【维度四：影响生产经营行为】
- 限制定标权："不得自行选择中标人"、"须由XX确定"、"摇号确定"、"抓阄"
- 强制交易："必须购买"、"强制使用"、"统一采购"
- 限制联合体："联合体成员须满足"、"牵头单位须为本地企业"

**输出格式**：
返回JSON数组，每个元素是一个风险片段字符串。
示例：["规模以上制造业企业给予0.3元/度的补贴", "本市注册企业优先", "联合体牵头单位须为本地企业"]

如果文档没有明显的风险片段，返回空数组：[]
`;

    const scanWindow = async (chunk: string, idx: number): Promise<string[]> => {
        try {
            const result = await callLLM(
                systemPrompt,
                `请分析以下文件内容（片段 ${idx + 1}/${windows.length}），提取风险关键片段：\n\n${chunk}`,
                true,
                'deepseek-chat',
            );
            if (!result) return [];
            const parsed = JSON.parse(result);
            return Array.isArray(parsed) ? parsed.filter((k: unknown) => typeof k === 'string') : [];
        } catch (e) {
            console.error(`[RAG] 窗口${idx + 1}风险片段提取失败:`, e);
            return [];
        }
    };

    // Concurrency-bounded fan-out across windows.
    const perWindow: string[][] = new Array(windows.length);
    let cursor = 0;
    const workers = Array.from(
        { length: Math.min(KEYWORD_WINDOW_CONCURRENCY, windows.length) },
        async () => {
            while (true) {
                const i = cursor++;
                if (i >= windows.length) return;
                perWindow[i] = await scanWindow(windows[i], i);
            }
        },
    );
    await Promise.all(workers);

    // Dedup keywords by normalized text (drop punctuation + whitespace).
    const normalize = (s: string) =>
        s.replace(/[\s\u3000,.，。、;；:：!！?？"""''（）()【】\-_]/g, '').toLowerCase();

    const seen = new Set<string>();
    const merged: string[] = [];
    for (const batch of perWindow) {
        if (!batch) continue;
        for (const k of batch) {
            const key = normalize(k);
            if (key.length < 4) continue;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(k);
        }
    }

    const final = merged.slice(0, 12);
    console.log(`[RAG] 🎯 合并后 ${final.length} 个风险关键片段（原始 ${merged.length}）`);
    final.forEach((k, i) => console.log(`  ${i + 1}. ${k.substring(0, 50)}...`));
    return final;
}

export async function runAuditor(category: string, text: string, guidance: string = ""): Promise<AuditIssue[]> {
    console.log('Running Auditor on category:', category);

    // ==========================================
    // 🔥 Agentic RAG：智能检索代理
    // ==========================================

    // 使用配置文件中的参数
    const { rag } = APP_CONFIG;

    // 🔥 初始化智能检索代理
    // 可以通过环境变量控制是否启用 Agentic RAG
    const useAgenticRAG = process.env.ENABLE_AGENTIC_RAG !== 'false'; // 默认启用

    console.log(`[RAG] 检索模式：${useAgenticRAG ? 'Agentic RAG（智能）' : 'Traditional RAG（传统）'}`);

    // 🔥 第一步：提取风险关键片段
    console.log(`[RAG] 🔍 第一步：提取风险关键片段...`);
    const riskKeywords = await extractRiskKeywords(text);

    let uniqueCases: any[] = [];
    let uniqueRegs: any[] = [];

    if (useAgenticRAG && riskKeywords.length > 0) {
        // ==========================================
        // 🔥 新方案：Agentic RAG（智能检索代理）
        // ==========================================

        const retrievalAgent = new RetrievalAgent({
            // 可以根据需要自定义配置
            enableQueryRewriting: true,      // 启用查询重写
            maxRewrites: 2,                  // 每个查询生成2个改写

            enableIterativeSearch: true,     // 启用迭代检索
            initialThreshold: 0.65,          // 初始阈值：65%
            minThreshold: 0.35,              // 最低阈值：35%
            thresholdStep: 0.15,             // 每轮降低15%
            maxIterations: 3,                // 最多迭代3轮

            minCases: 3,                     // 最少找到3个案例
            maxCases: 10,                    // 最多返回10个案例
            highQualityThreshold: 0.60,      // 高质量案例阈值：60%
            minHighQualityCases: 2,          // 最少2个高质量案例
        });

        // 🔥 批量检索案例（自动包含查询重写、迭代检索、融合去重）
        const allCases = await retrievalAgent.batchRetrievalForRisks(riskKeywords, 'case');
        uniqueCases = allCases.slice(0, rag.finalCasesCount);

        // 🔥 检索法规（法规用全文摘要，不需要太精准）
        const summaryForRegs = TextChunker.truncate(text, rag.ragInputLength);
        const regQueries = await retrievalAgent.rewriteQuery(summaryForRegs);
        const allRegs = await retrievalAgent.fusionSearch(regQueries, 'regulation');
        uniqueRegs = allRegs.slice(0, rag.finalRegulationsCount);

    } else {
        // ==========================================
        // 🔥 旧方案：Traditional RAG（保留作为后备）
        // ==========================================

        console.log(`[RAG] 使用传统检索模式（风险片段数：${riskKeywords.length}）`);

        const allCasesMap = new Map<number, typeof allCases[0]>();
        let allCases: Awaited<ReturnType<typeof searchSimilarCases>> = [];

        // 对每个风险片段进行检索
        for (const keyword of riskKeywords) {
            const cases = await searchSimilarCases(keyword, 5, 0.45);
            cases.forEach(c => {
                const existing = allCasesMap.get(c.id);
                if (!existing || c.similarity > existing.similarity) {
                    allCasesMap.set(c.id, c);
                }
            });
            console.log(`  - "${keyword.substring(0, 30)}..." → 找到 ${cases.length} 个案例`);
        }

        // 如果风险片段检索结果不足，用全文摘要兜底
        if (allCasesMap.size < 3) {
            console.log(`[RAG] ⚠️ 风险片段检索结果不足，使用全文摘要兜底...`);
            const summaryForRAG = TextChunker.truncate(text, rag.ragInputLength);
            const fallbackCases = await searchSimilarCases(summaryForRAG, rag.maxCasesPerQuery, 0.50);
            fallbackCases.forEach(c => {
                if (!allCasesMap.has(c.id)) {
                    allCasesMap.set(c.id, c);
                }
            });
        }

        // 转换为数组并按相似度排序
        allCases = Array.from(allCasesMap.values()).sort((a, b) => b.similarity - a.similarity);

        // 检索法规
        const summaryForRegs = TextChunker.truncate(text, rag.ragInputLength);
        const allRegs = await searchSimilarRegulations(summaryForRegs, rag.maxRegulationsPerQuery, rag.regulationSimilarityThreshold);

        uniqueCases = allCases.slice(0, rag.finalCasesCount);
        uniqueRegs = allRegs.slice(0, rag.finalRegulationsCount);
    }

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
        ragContext += "\n【可引用的相似案例/权威认定（用于 reference 字段）】：\n";
        ragContext += "说明：以下案例可作为佐证材料引用。若相似度高且违规本质相同，请在reference字段中引用案例原文。\n\n";

        uniqueCases.forEach((c, idx) => {
            const similarityPercent = (c.similarity * 100).toFixed(1);
            const similarityLabel = c.similarity >= 0.75 ? '【高度相似】' :
                c.similarity >= 0.60 ? '【中度相似】' : '【参考价值低】';

            ragContext += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            ragContext += `案例${idx + 1} ${similarityLabel}（相似度：${similarityPercent}%）\n`;
            ragContext += `标题：【${c.violationType}】${c.title}\n`;

            // 展示案例原文（优化：2000字，避免context过大）
            const fullContent = c.content || '';
            ragContext += `【案例原文】：\n${fullContent.substring(0, 2000)}${fullContent.length > 2000 ? '...(省略)' : ''}\n`;

            // 违规要点
            if (c.violationDetail) {
                ragContext += `⚠️ 违规要点：${c.violationDetail}\n`;
            }

            // 处理结果
            if (c.result) {
                ragContext += `处理结果：${c.result}\n`;
            }

            ragContext += `\n`;
        });
    } else {
        // 如果没有检索到案例，提示AI
        ragContext += "\n⚠️ 未检索到相关历史案例（相似度<45%），请仅依据法规进行独立判断。\n\n";
    }

    if (uniqueRegs.length > 0) {
        ragContext += "\n相关法律法规依据（请在 violated_law 字段中完整引用具体条款）：\n";
        uniqueRegs.forEach((r, idx) => {
            const similarityPercent = (r.similarity * 100).toFixed(1);
            ragContext += `法规${idx + 1}（相似度：${similarityPercent}%）：《${r.title}》\n`;
            // 优化：减少法规内容长度，从1000字减少到600字
            ragContext += `   内容：${r.content ? r.content.substring(0, 600) : '暂无'}...\n\n`;
        });
    }

    const systemPrompt = `
    你是一个资深的"公平竞争审查"审计员（Auditor）。你的任务是根据《公平竞争审查条例》及相关法律法规，审查政府文件是否存在排除、限制竞争的内容。

    【核心指令 - 法规引用规则】：
    
    当前审查类别是：${category}
    
    ${category === 'BIDDING' ? `
    【招标文件审查标准】
    1. **主要依据**：《浙江省招标投标领域公平竞争审查细则》（21条禁止性规定）
    2. **violated_law字段**：优先引用浙江细则的具体条款
       格式示例："《浙江省招标投标领域公平竞争审查细则》第三条第（八）项第5点：不得将经营者取得业绩...作为投标条件。"
    3. **判定标准**：招标文件中基于地域、所有制、规模、业绩的不合理限制，视为**明确违规**
    ` : `
    【政策文件/政府协议审查标准】
    1. **主要依据**：《公平竞争审查条例实施办法》（第9-24条审查标准）
    2. **violated_law字段**：引用实施办法的具体条款
       格式示例："《公平竞争审查条例实施办法》第十五条第三款：不得将经营者取得业绩和奖项荣誉的区域...作为投标条件。"
    3. **审查范围**：
       - 第9-12条：限制市场准入和退出
       - 第13-17条：限制商品、要素自由流动
       - 第18-20条：影响生产经营成本
       - 第21-23条：影响生产经营行为
    `}

    审查重点（特别针对工程建设和招投标）：
    1. **市场准入和退出**:
       - 是否要求在本地区设立分支机构、缴纳税收社保？
       - 是否将特定行政区域的业绩、奖项作为加分或中标条件？
       - 是否设置过高的注册资本、净资产、营收等规模门槛？
    2. **商品和要素自由流动**:
       - 是否限定特定的品牌、专利、供应商或产地？
       - 是否要求"优先采购本国/本地产品"而无法规依据？
       - 是否对联合体成员的注册地、所有制设置差异性得分？
       - 是否要求必须提供原件而非电子证照？
    3. **影响生产经营成本**: 是否强制要求提供特定机构的保函？是否违法收取保证金？
    4. **定标和定标权**: 是否限制招标人的定标自主权？是否采用摇号、抓阄等方式确定中标人？

    // ==========================================
    // 🔥 独立输出规则【极其重要】
    // ==========================================

    【强制规则】一个风险点对应一个政策条款：

    ❌ 禁止合并：如果文件中有"政策1、政策2、政策3"三个独立的违规条款，必须输出3个独立的risk对象，不得合并。

    ✅ 正确做法：
    - 每个risk的location字段只能包含一个政策条款的完整原文（30-200字）
    - 即使违规类型相同（如都是"规模限制"），也必须独立输出
    - 每个risk都要有独立的description、suggestion、reference

    【错误示例】❌ 合并多个政策：
    {
      "location": "政策1细则：规模以上制造业企业供电...；政策2细则：规模以上工业企业2026年...；政策5细则：1-2月规模同比增长..."
    }

    【正确示例】✅ 独立输出：
    [
      {
        "id": "risk_1",
        "location": "政策1细则：规模以上制造业企业供电电压等级10千伏及以上且春节假期期间"不停产"...给予用电补贴",
        "description": "【规模/业绩限制 + 财政补贴】该条款将用电补贴限定在'规模以上制造业企业'，排除了规模以下企业..."
      },
      {
        "id": "risk_2",
        "location": "政策2细则：规模以上工业企业2026年一季度产值较2025年一季度产值每增加1000万元奖励2万元",
        "description": "【规模/业绩限制 + 财政补贴】该条款将产值增长奖励限定在'规模以上工业企业'，排除了规模以下企业..."
      },
      {
        "id": "risk_3",
        "location": "政策5细则：1-2月规模同比增长的营利性服务业企业，每新增1000万元奖励2万元",
        "description": "【规模/业绩限制 + 财政补贴】该条款将奖励限定在'规模同比增长的营利性服务业企业'，排除了其他企业..."
      }
    ]

    独立输出的好处：
    1. 用户可以逐条定位原文，快速查找
    2. 每个政策都有独立的修改建议，便于整改
    3. 可以分别标记整改进度（政策1已改，政策2待改）

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
    3. 检索案例：从上方【可引用的相似案例】中查找相似度>70%的案例
    4. 风险等级：High（明确违反《条例》第十条）

    输出JSON：
    {
        "id": "risk_1",
        "risk_level": "High",
        "description": "【地域性限制】文件明确要求投标人必须为本市注册企业，直接排斥外地企业参与投标，违反了《公平竞争审查条例》第十条关于'不得设置不合理的条件排斥或者限制外地经营者参加本地招标投标活动'的规定。",
        "violated_law": "《公平竞争审查条例实施办法》第十五条第一款：禁止外地经营者参与本地政府采购、招标投标活动。",
        "location": "投标人须为本市注册企业，外地企业不得参与本项目投标",
        "suggestion": "建议删除'本市注册企业'的要求，改为'依法注册的企业'，不限制注册地域。",
        "reference": ""
    }

    【示例2：灰色地带 - Medium风险】
    原文引用："优先支持年纳税额1000万元以上的企业申报项目。"

    输出JSON：
    {
        "id": "risk_2",
        "risk_level": "Medium",
        "description": "【规模/业绩限制 + 财政优惠】文件设置年纳税额1000万元的门槛，并给予'优先支持'，这属于选择性支持政策，可能对中小企业构成不公平竞争。",
        "violated_law": "《公平竞争审查条例》第十二条：除法律、行政法规另有规定外，不得给予特定经营者优惠政策。",
        "location": "优先支持年纳税额1000万元以上的企业申报项目",
        "suggestion": "建议取消纳税额门槛，或说明该政策的法律依据。",
        "reference": ""
    }

    【示例3：合理要求 - 不构成风险】
    原文引用："投标人须具备建筑工程施工总承包二级及以上资质，且近三年无重大安全事故。"

    AI判定过程：
    1. 初步怀疑：资质/荣誉限制（类型4）？
    2. 深入分析：
       - 资质要求：行业准入必要条件（《建筑法》规定）
       - 安全记录：合规管理需要，非歧视性条件
    3. 结论：不构成公平竞争风险，不输出此项

    // ==========================================
    // 🔥 reference字段引用规则【极其重要】
    // ==========================================

    **案例引用规则（严格执行）**：

    1. **只能引用真实案例**：reference字段只能从上方【可引用的相似案例/权威认定】中选取内容引用。
    2. **禁止虚构案例**：绝对禁止编造不存在的案例名称或案例内容！
    3. **相似度要求**：只有相似度≥55%且违规本质相同的案例才可引用。
    4. **精准匹配要求【新增】**：
       - ⚠️ 必须检查"违规手段"和"限制对象"是否都一致
       - ✅ 正确：当前文件"对规上企业给予奖励" ←→ 案例"将奖励限制在规上企业" （限制对象一致）
       - ❌ 错误：当前文件"对规上企业给予奖励" ←→ 案例"首次达到规上企业奖励" （限制对象不同：存量 vs 增量）
       - ✅ 正确：当前文件"本地企业优先" ←→ 案例"限定本地企业参与" （限制对象一致）
       - ❌ 错误：当前文件"规模以上企业" ←→ 案例"年产值1000万以上企业" （虽然都是规模限制，但标准不同）
    5. **引用格式**：直接复制上方案例的【案例原文】部分，保持原文不变。
    6. **无案例时留空**：如果上方没有提供相似案例，或相似度不够，或违规本质不同，reference字段必须为空字符串("")。

    reference格式模板（仅当有真实案例时使用）：
    "【案例标题（来自上方检索结果）】\\n违规类型：XX。\\n相似度：XX%。\\n违规要点：XX。\\n【案例原文】：\\n(直接复制上方案例的原文内容)"

    **案例筛选指南**：
    在引用案例前，请自问：
    1. 当前风险点的核心违规对象是谁？（规上企业/本地企业/国有企业/特定品牌...）
    2. 案例中的违规对象是否完全一致？（不能是"相近"，必须是"相同"）
    3. 违规手段是否一致？（限定/禁止/优先/指定...）
    4. 如果案例中有"首次达到"、"新增"、"增量"等词，而当前文件没有，则不匹配
    5. 如果案例中是"年产值XX万"，而当前文件是"规上企业"，虽然都涉及规模，但标准不同，不匹配


    // ==========================================
    // 🔥 风险等级量化标准
    // ==========================================

    **风险等级判定流程**（请严格执行）：

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
    2️⃣ **所有制歧视**
    3️⃣ **规模/业绩限制**
    4️⃣ **资质/荣誉限制**
    5️⃣ **指定交易/排他性**
    6️⃣ **财政优惠/补贴**
    7️⃣ **不合理的准入/退出条件**
    
    **案例匹配原则（精准优先）**：
    1. **精准匹配才引用**：案例的"违规手段"+"限制对象"必须与当前文档**完全一致**才能引用。
       - 相似度≥55%是前提条件
       - 但相似度高不代表可以引用，还要检查违规本质是否相同
    2. **拒绝强行关联**：禁止引用虽然关键词相同但违规逻辑完全不同的案例。
       - 案例："首次达到规上企业奖励" ≠ 当前："规上企业奖励"（前者是增量激励，后者是存量歧视）
       - 案例："年产值1000万以上" ≠ 当前："规上企业"（虽然都是规模限制，但标准不同）
    3. **法理优先**：如果没有精准匹配的案例，请通过 description 字段展现深刻的法理分析。
    4. **空值标准**：若无匹配案例或没把握，reference 字段必须留空（即空字符串），不需要给出任何解释说明。

    reference格式模板：
    "【案例标题】\n违规类型：XX。\n相似度：XX%。\n违规要点：XX。\n处理结果：XX。\n【案例原文】：\n(从上下文摘录的关键段落原文)"

    【输出质量要求】
    1. description字段（150-300字）：明确违规类型、具体内容、违规原因、补充说明。
    2. violated_law字段：必须包含完整法条内容。
    3. reference字段：**严格执行宁缺毋滥原则**。无高匹配度案例时必须留空。若有匹配，必须包含【案例原文】！

    请以 JSON 数组格式返回结果，每个风险点包含以下字段：
    [
        {
            "id": "risk_1",
            "risk_level": "High" | "Medium" | "Low",
            "description": "...",
            "violated_law": "...",
            "location": "...",
            "suggestion": "...",
            "reference": "严格按照上述模板，必须包含【案例原文】。"
        }
    ]
    `;

    // Use TextChunker for consistent truncation
    const truncatedText = TextChunker.getChunkForAgent(text, 'auditor');

    const userPrompt = `
    文件内容：
    ${truncatedText}
    `;

    const resultStr = await callLLM(systemPrompt, userPrompt, true, 'deepseek-reasoner');

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
