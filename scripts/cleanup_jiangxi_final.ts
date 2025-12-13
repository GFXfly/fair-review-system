
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning up duplicate Jiangxi cases (Final Cleanup)...');

    // IDs 279-287 are the High Quality ones (Verbatim).
    // The user identified duplicates: 
    // - 252 vs 279 (252 is short summary)
    // - 253 vs 280 (253 is short summary)
    // - 254 vs 281
    // - 255 vs 282
    // - 256 vs 283 (partially?)
    // - 257 vs 284
    // - 258 vs 285

    // Let's delete the range 252 to 258. 
    // Note: In previous step I deleted 259-278. 
    // Now I see 252-258 are also inferior summaries of the same batch.

    const deleteResult = await prisma.case.deleteMany({
        where: {
            id: {
                gte: 252,
                lte: 258
            }
        }
    });

    console.log(`Deleted ${deleteResult.count} additional duplicate/summary cases.`);

    const remaining = await prisma.case.findMany({
        where: {
            id: { gte: 279 }
        },
        select: { id: true, title: true, content: true }
    });

    console.log(`\nFinal Remaining Cases for this batch (${remaining.length}):`);
    remaining.forEach(c => {
        console.log(`- [${c.id}] ${c.title} (Len: ${c.content.length})`);
    });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
