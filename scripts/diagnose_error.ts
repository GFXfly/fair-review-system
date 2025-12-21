/**
 * Diagnostic script to identify the root cause of "文件分析失败" error
 */

import { prisma } from '../src/lib/prisma';
import { callLLM, getEmbedding } from '../src/lib/llm';

async function diagnose() {
    console.log('🔍 Starting diagnostic tests...\n');

    // Test 1: Database Connection
    console.log('Test 1: Database Connection');
    try {
        const userCount = await prisma.user.count();
        console.log(`✅ Database OK - Found ${userCount} users`);
    } catch (error: any) {
        console.error(`❌ Database ERROR: ${error.message}`);
        return;
    }

    // Test 2: DeepSeek API
    console.log('\nTest 2: DeepSeek API');
    try {
        const result = await callLLM(
            'You are a helpful assistant.',
            'Say "Hello" in Chinese.',
            false,
            'deepseek-chat'
        );
        console.log(`✅ DeepSeek API OK - Response: ${result?.substring(0, 50)}...`);
    } catch (error: any) {
        console.error(`❌ DeepSeek API ERROR: ${error.message}`);
        console.error('   Please check your DEEPSEEK_API_KEY in .env file');
        return;
    }

    // Test 3: SiliconFlow Embedding API
    console.log('\nTest 3: SiliconFlow Embedding API');
    try {
        const embedding = await getEmbedding('测试文本');
        if (embedding && embedding.length > 0) {
            console.log(`✅ SiliconFlow Embedding OK - Dimension: ${embedding.length}`);
        } else {
            throw new Error('Empty embedding returned');
        }
    } catch (error: any) {
        console.error(`❌ SiliconFlow API ERROR: ${error.message}`);
        console.error('   Please check your SILICONFLOW_API_KEY in .env file');
        return;
    }

    // Test 4: Guidance Counselor (浙江规则查询)
    console.log('\nTest 4: Guidance Counselor (浙江规则查询)');
    try {
        const zhejiangRules = await prisma.regulation.findFirst({
            where: { title: '浙江省招标投标领域公平竞争审查细则' },
            select: { id: true, title: true }
        });
        if (zhejiangRules) {
            console.log(`✅ Zhejiang Rules Found - ID: ${zhejiangRules.id}`);
        } else {
            console.warn(`⚠️  Zhejiang Rules NOT FOUND - This may cause issues for BIDDING category`);
        }
    } catch (error: any) {
        console.error(`❌ Regulation Query ERROR: ${error.message}`);
    }

    // Test 5: Cases Count
    console.log('\nTest 5: Cases Database');
    try {
        const caseCount = await prisma.case.count();
        const casesWithEmbedding = await prisma.case.count({
            where: { embedding: { not: null } }
        });
        console.log(`✅ Cases OK - Total: ${caseCount}, With Embeddings: ${casesWithEmbedding}`);
        if (casesWithEmbedding < caseCount) {
            console.warn(`⚠️  ${caseCount - casesWithEmbedding} cases missing embeddings`);
        }
    } catch (error: any) {
        console.error(`❌ Cases Query ERROR: ${error.message}`);
    }

    console.log('\n✅ All diagnostic tests completed!');
    console.log('\nIf all tests pass but you still see errors, please:');
    console.log('1. Check browser console for client-side errors');
    console.log('2. Check the Network tab when uploading a file');
    console.log('3. Try uploading a simple test file');
}

diagnose()
    .then(() => {
        console.log('\n✅ Diagnostic complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Diagnostic failed:', error);
        process.exit(1);
    });
