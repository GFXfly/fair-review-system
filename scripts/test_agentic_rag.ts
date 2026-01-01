/**
 * Agentic RAG 测试脚本
 * 
 * 用途：测试智能检索代理的各项功能
 * 
 * 运行方式：
 * npx tsx scripts/test_agentic_rag.ts
 */

import { RetrievalAgent } from '../src/lib/agents/retrieval';

async function testAgenticRAG() {
    console.log('🧪 开始测试 Agentic RAG...\n');

    const agent = new RetrievalAgent({
        enableQueryRewriting: true,
        maxRewrites: 2,
        enableIterativeSearch: true,
        initialThreshold: 0.65,
        minThreshold: 0.35,
        maxCases: 5,
    });

    // 测试案例：典型的公平竞争违规文本
    const testQueries = [
        '本市注册企业优先',
        '规模以上企业给予财政补贴',
        '近三年在本地有类似项目业绩',
    ];

    console.log('📋 测试查询列表：');
    testQueries.forEach((q, i) => {
        console.log(`  ${i + 1}. ${q}`);
    });
    console.log('\n' + '='.repeat(80) + '\n');

    try {
        // 测试：批量检索
        console.log('🔥 测试1：批量风险检索\n');
        const cases = await agent.batchRetrievalForRisks(testQueries, 'case');

        console.log('\n📊 检索结果摘要：');
        console.log(`  - 找到案例数：${cases.length}`);

        if (cases.length > 0) {
            console.log('\n  Top 3 案例：');
            cases.slice(0, 3).forEach((c: any, idx: number) => {
                console.log(`    ${idx + 1}. [${(c.similarity * 100).toFixed(1)}%] ${c.title}`);
            });
        } else {
            console.warn('  ⚠️ 未找到任何案例，请检查数据库是否有案例数据');
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ Agentic RAG 测试完成！');
        console.log('='.repeat(80) + '\n');

        console.log('💡 提示：');
        console.log('  - 如需查看详细日志，检查上方的检索过程输出');
        console.log('  - 如需调整参数，编辑 RetrievalAgent 的配置');
        console.log('  - 在实际审查中，系统会自动使用 Agentic RAG');

    } catch (error: any) {
        console.error('\n❌ 测试失败:', error.message);
        console.error('\n可能的原因：');
        console.error('  1. 数据库连接失败');
        console.error('  2. 案例表为空（需要先运行 scripts/generate_all_embeddings.ts）');
        console.error('  3. Embedding 服务不可用');

        throw error;
    }
}

// 运行测试
testAgenticRAG()
    .then(() => {
        console.log('\n✨ 所有测试通过！');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 测试失败:', error);
        process.exit(1);
    });
