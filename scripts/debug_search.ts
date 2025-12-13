
import { PrismaClient } from '@prisma/client';
import { searchSimilarCases } from '../src/lib/rag';

const prisma = new PrismaClient();

async function main() {
    const query = '限制外地企业参与招投标';
    console.log(`Testing VECTOR search with query: "${query}"...`);

    const results = await searchSimilarCases(query, 3);

    console.log(`Found ${results.length} results.`);
    results.forEach((r, i) => {
        console.log(`\n--- Result ${i + 1} (Similarity: ${r.similarity?.toFixed(4)}) ---`);
        console.log(`Title: ${r.title}`);
        console.log(`Violation: ${r.violationType}`);
        console.log(`Content Snippet: ${r.content.substring(0, 100)}...`);
    });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
