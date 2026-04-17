/**
 * 🔥 Agentic RAG - 智能检索代理
 * 
 * 核心功能：
 * 1. 查询重写（Query Rewriting）：将用户查询改写为多个语义等价的查询
 * 2. 迭代检索（Iterative Retrieval）：逐步降低阈值直到找到足够案例
 * 3. 多查询融合（Query Fusion）：合并多个查询的检索结果
 * 
 * Version: 2.3
 * Author: Agentic RAG Optimization
 */

import { callLLM } from '@/lib/llm';
import {
    searchSimilarCases,
    searchSimilarRegulations,
    CaseWithSimilarity,
    RegulationWithSimilarity
} from '@/lib/rag';

const RAG_CONCURRENCY = Math.max(1, parseInt(process.env.RAG_CONCURRENCY || '3'));

async function parallelMap<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const i = cursor++;
            if (i >= items.length) return;
            results[i] = await fn(items[i], i);
        }
    });
    await Promise.all(workers);
    return results;
}

/**
 * 智能检索代理配置
 */
export interface RetrievalConfig {
    // 查询重写配置
    enableQueryRewriting: boolean;      // 是否启用查询重写
    maxRewrites: number;                // 最大改写数量（建议 2-3）

    // 迭代检索配置  
    enableIterativeSearch: boolean;     // 是否启用迭代检索
    initialThreshold: number;           // 初始相似度阈值（建议 0.65）
    minThreshold: number;               // 最低相似度阈值（建议 0.35）
    thresholdStep: number;              // 阈值递减步长（建议 0.15）
    maxIterations: number;              // 最大迭代次数（建议 3）

    // 结果质量配置
    minCases: number;                   // 最少案例数（建议 3）
    maxCases: number;                   // 最多案例数（建议 10）
    highQualityThreshold: number;       // 高质量案例阈值（建议 0.60）
    minHighQualityCases: number;        // 最少高质量案例数（建议 2）
}

/**
 * 默认配置
 */
export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
    enableQueryRewriting: true,
    maxRewrites: 2,

    enableIterativeSearch: true,
    initialThreshold: 0.65,
    minThreshold: 0.35,
    thresholdStep: 0.15,
    maxIterations: 3,

    minCases: 3,
    maxCases: 10,
    highQualityThreshold: 0.60,
    minHighQualityCases: 2,
};

/**
 * 智能检索代理类
 */
export class RetrievalAgent {
    private config: RetrievalConfig;

    constructor(config: Partial<RetrievalConfig> = {}) {
        this.config = { ...DEFAULT_RETRIEVAL_CONFIG, ...config };
    }

    /**
     * 🔥 核心方法1：查询重写
     * 
     * 将原始查询改写为多个语义等价但表达不同的查询，提高召回率
     * 
     * @param originalQuery 原始查询文本
     * @returns 包含原始查询和改写查询的数组
     * 
     * @example
     * 输入："本市注册企业"
     * 输出：["本市注册企业", "要求投标人在本地注册", "限定本地企业参与"]
     */
    async rewriteQuery(originalQuery: string): Promise<string[]> {
        if (!this.config.enableQueryRewriting) {
            return [originalQuery];
        }

        // 查询太短，不需要改写
        if (originalQuery.length < 5) {
            return [originalQuery];
        }

        const systemPrompt = `
你是一个法律文本检索专家，擅长改写查询以提高检索准确性。

**任务**：将用户提供的查询改写为 ${this.config.maxRewrites} 个语义等价但表达不同的查询。

**改写规则**：
1. 保留核心法律概念（如"规上企业"、"本地注册"、"投标资格"）
2. 使用同义词替换：
   - "限制" ↔ "排除" ↔ "禁止"
   - "本地" ↔ "本市" ↔ "本省"
   - "企业" ↔ "经营者" ↔ "投标人"
   - "要求" ↔ "规定" ↔ "设置条件"
3. 调整语序和结构（主动 ↔ 被动）
4. 可以从反向角度表述（如"允许本地企业" → "排除外地企业"）

**示例**：
输入："本市注册企业"
输出：["要求投标人在本地注册", "限定本地企业参与"]

输入："规模以上企业给予补贴"
输出：["对规上企业提供财政奖励", "将补贴限定在大型企业"]

**输出格式**：
JSON 数组，每个元素是一个改写后的查询字符串。
只返回 ${this.config.maxRewrites} 个改写结果，不包含原始查询。
`;

        const userPrompt = `请改写以下查询：\n\n${originalQuery}`;

        try {
            const result = await callLLM(systemPrompt, userPrompt, true, 'deepseek-chat');
            if (!result) {
                console.warn('[RetrievalAgent] 查询重写失败，使用原始查询');
                return [originalQuery];
            }

            const rewrites = JSON.parse(result);
            if (!Array.isArray(rewrites) || rewrites.length === 0) {
                return [originalQuery];
            }

            // 返回：原始查询 + 改写查询
            const allQueries = [originalQuery, ...rewrites.slice(0, this.config.maxRewrites)];

            console.log(`[RetrievalAgent] 🔄 查询重写成功：1 原始 + ${rewrites.length} 改写`);
            allQueries.forEach((q, i) => {
                if (i === 0) {
                    console.log(`  [原始] ${q}`);
                } else {
                    console.log(`  [改写${i}] ${q}`);
                }
            });

            return allQueries;

        } catch (e: any) {
            console.error('[RetrievalAgent] 查询重写错误:', e.message);
            return [originalQuery];
        }
    }

    /**
     * 🔥 核心方法2：迭代检索
     * 
     * 逐步降低相似度阈值，直到找到足够的高质量案例
     * 
     * @param query 查询文本
     * @param targetType 检索目标类型（'case' 或 'regulation'）
     * @returns 检索到的案例/法规列表
     */
    async iterativeSearch(
        query: string,
        targetType: 'case' | 'regulation' = 'case'
    ): Promise<CaseWithSimilarity[] | RegulationWithSimilarity[]> {

        if (!this.config.enableIterativeSearch) {
            // 如果未启用迭代检索，使用传统单次查询
            if (targetType === 'case') {
                return await searchSimilarCases(query, this.config.maxCases, this.config.minThreshold);
            } else {
                return await searchSimilarRegulations(query, this.config.maxCases, this.config.minThreshold);
            }
        }

        const allResults = new Map<number, any>();
        let currentThreshold = this.config.initialThreshold;
        let iteration = 0;

        console.log(`[RetrievalAgent] 🔍 开始迭代检索：目标类型=${targetType}`);
        console.log(`  查询："${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);

        while (iteration < this.config.maxIterations) {
            iteration++;

            // 确保阈值不低于最小值
            currentThreshold = Math.max(currentThreshold, this.config.minThreshold);

            console.log(`  [迭代${iteration}] 阈值=${currentThreshold.toFixed(2)}`);

            // 执行检索
            let results: any[] = [];
            if (targetType === 'case') {
                results = await searchSimilarCases(
                    query,
                    this.config.maxCases * 2,  // 每次多查一些，后续再筛选
                    currentThreshold
                );
            } else {
                results = await searchSimilarRegulations(
                    query,
                    this.config.maxCases * 2,
                    currentThreshold
                );
            }

            // 合并结果（保留最高相似度）
            results.forEach(item => {
                const existing = allResults.get(item.id);
                if (!existing || item.similarity > existing.similarity) {
                    allResults.set(item.id, item);
                }
            });

            const currentCount = allResults.size;
            const highQualityCount = Array.from(allResults.values())
                .filter(item => item.similarity >= this.config.highQualityThreshold)
                .length;

            console.log(`    → 本轮找到 ${results.length} 个，累计 ${currentCount} 个（高质量：${highQualityCount}）`);

            // 停止条件：找到足够的高质量案例
            if (highQualityCount >= this.config.minHighQualityCases && currentCount >= this.config.minCases) {
                console.log(`  ✓ 已找到足够案例，停止检索`);
                break;
            }

            // 停止条件：已达到最低阈值
            if (currentThreshold <= this.config.minThreshold) {
                console.log(`  ⚠️ 已达到最低阈值，停止检索`);
                break;
            }

            // 降低阈值继续下一轮
            currentThreshold -= this.config.thresholdStep;
        }

        // 排序并限制数量
        const finalResults = Array.from(allResults.values())
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, this.config.maxCases);

        console.log(`[RetrievalAgent] 📊 迭代检索完成：`);
        console.log(`  - 总迭代次数：${iteration}`);
        console.log(`  - 最终结果数：${finalResults.length}`);
        if (finalResults.length > 0) {
            const similarities = finalResults.map(r => r.similarity);
            console.log(`  - 相似度范围：${(Math.min(...similarities) * 100).toFixed(1)}% ~ ${(Math.max(...similarities) * 100).toFixed(1)}%`);
        }

        return finalResults;
    }

    /**
     * 🔥 核心方法3：多查询融合检索
     * 
     * 对多个查询（原始 + 改写）分别检索，然后去重合并
     * 
     * @param queries 查询列表
     * @param targetType 检索目标类型
     * @returns 融合后的检索结果
     */
    async fusionSearch(
        queries: string[],
        targetType: 'case' | 'regulation' = 'case'
    ): Promise<CaseWithSimilarity[] | RegulationWithSimilarity[]> {

        if (queries.length === 0) {
            console.warn('[RetrievalAgent] 查询列表为空');
            return [];
        }

        console.log(`[RetrievalAgent] 🎯 开始融合检索：${queries.length} 个查询 (并发=${RAG_CONCURRENCY})`);

        const allResults = new Map<number, any>();

        // 并发执行迭代检索，上限由 RAG_CONCURRENCY 控制
        const perQueryResults = await parallelMap(queries, RAG_CONCURRENCY, async (query, i) => {
            console.log(`[查询 ${i + 1}/${queries.length}] "${query.substring(0, 40)}${query.length > 40 ? '...' : ''}"`);
            const results = await this.iterativeSearch(query, targetType);
            return { query, i, results };
        });

        for (const { query, i, results } of perQueryResults) {
            results.forEach(item => {
                const existing = allResults.get(item.id);
                if (!existing || item.similarity > existing.similarity) {
                    allResults.set(item.id, {
                        ...item,
                        matchedQuery: query,
                        queryIndex: i
                    });
                }
            });
        }

        // 最终排序和统计
        const finalResults = Array.from(allResults.values())
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, this.config.maxCases);

        console.log(`\n[RetrievalAgent] ✅ 融合检索完成：`);
        console.log(`  - 总查询数：${queries.length}`);
        console.log(`  - 去重后结果：${finalResults.length}`);

        if (finalResults.length > 0) {
            const highQuality = finalResults.filter(r => r.similarity >= this.config.highQualityThreshold);
            console.log(`  - 高质量结果（≥${(this.config.highQualityThreshold * 100).toFixed(0)}%）：${highQuality.length} 个`);

            // 展示前3个结果
            console.log(`  - Top 3 结果：`);
            finalResults.slice(0, 3).forEach((r, idx) => {
                console.log(`    ${idx + 1}. [${(r.similarity * 100).toFixed(1)}%] ${r.title.substring(0, 30)}...`);
            });
        }

        return finalResults;
    }

    /**
     * 🔥 高级方法：风险片段批量检索
     * 
     * 针对多个风险片段，分别进行查询重写和融合检索，最后全局去重
     * 这是 Auditor 的主要入口方法
     * 
     * @param riskKeywords 风险关键片段列表
     * @param targetType 检索目标类型
     * @returns 最终检索结果
     */
    async batchRetrievalForRisks(
        riskKeywords: string[],
        targetType: 'case' | 'regulation' = 'case'
    ): Promise<CaseWithSimilarity[] | RegulationWithSimilarity[]> {

        if (riskKeywords.length === 0) {
            console.warn('[RetrievalAgent] 风险片段列表为空');
            return [];
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log(`[RetrievalAgent] 🚀 批量风险检索开始`);
        console.log(`  - 风险片段数：${riskKeywords.length}`);
        console.log(`  - 目标类型：${targetType === 'case' ? '案例' : '法规'}`);
        console.log(`  - 查询重写：${this.config.enableQueryRewriting ? '启用' : '禁用'}`);
        console.log(`  - 迭代检索：${this.config.enableIterativeSearch ? '启用' : '禁用'}`);
        console.log(`${'='.repeat(80)}\n`);

        const globalResults = new Map<number, any>();

        // 并发处理每个风险片段：查询重写 + 融合检索 (并发上限由 RAG_CONCURRENCY 控制)
        const perKeywordResults = await parallelMap(riskKeywords, RAG_CONCURRENCY, async (keyword, i) => {
            console.log(`[风险片段 ${i + 1}/${riskKeywords.length}] ${keyword.substring(0, 60)}${keyword.length > 60 ? '...' : ''}`);
            const queries = await this.rewriteQuery(keyword);
            const results = await this.fusionSearch(queries, targetType);
            return { keyword, i, results };
        });

        for (const { keyword, i, results } of perKeywordResults) {
            results.forEach(item => {
                const existing = globalResults.get(item.id);
                if (!existing || item.similarity > existing.similarity) {
                    globalResults.set(item.id, {
                        ...item,
                        sourceRisk: keyword,
                        riskIndex: i
                    });
                }
            });
            console.log(`  → 片段${i + 1}贡献 ${results.length} 个结果，全局累计 ${globalResults.size} 个`);
        }

        // 最终全局排序
        const finalResults = Array.from(globalResults.values())
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, this.config.maxCases);

        // 最终统计报告
        console.log(`\n${'='.repeat(80)}`);
        console.log(`[RetrievalAgent] 📊 批量检索完成统计`);
        console.log(`${'='.repeat(80)}`);
        console.log(`  总风险片段：${riskKeywords.length} 个`);
        console.log(`  全局去重后：${globalResults.size} 个结果`);
        console.log(`  最终返回：${finalResults.length} 个结果`);

        if (finalResults.length > 0) {
            const similarities = finalResults.map(r => r.similarity);
            const highQuality = finalResults.filter(r => r.similarity >= this.config.highQualityThreshold);

            console.log(`  相似度范围：${(Math.min(...similarities) * 100).toFixed(1)}% ~ ${(Math.max(...similarities) * 100).toFixed(1)}%`);
            console.log(`  高质量结果（≥${(this.config.highQualityThreshold * 100).toFixed(0)}%）：${highQuality.length} 个`);

            if (highQuality.length < this.config.minHighQualityCases) {
                console.warn(`  ⚠️ 警告：高质量结果不足（期望≥${this.config.minHighQualityCases}个）`);
            } else {
                console.log(`  ✅ 检索质量：良好`);
            }
        } else {
            console.warn(`  ⚠️ 警告：未找到任何结果`);
        }
        console.log(`${'='.repeat(80)}\n`);

        return finalResults;
    }
}
