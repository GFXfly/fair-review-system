
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning up duplicate Jiangxi cases...');

    // We identified that IDs 279 to 287 are the latest, extensive "verbatim" scrape.
    // IDs 259 to 278 are previous attempts (summaries or shorter titles).

    // Safety check: Ensure we strictly target the IDs we observed in the debug step.
    // Range to delete: 259 to 278 (inclusive).

    const deleteResult = await prisma.case.deleteMany({
        where: {
            id: {
                gte: 259,
                lte: 278
            }
        }
    });

    console.log(`Deleted ${deleteResult.count} duplicate/inferior cases.`);

    const remaining = await prisma.case.findMany({
        where: {
            id: { gte: 279 }
        },
        select: { id: true, title: true, content: true }
    });

    console.log(`\nRemaining Cases (${remaining.length}):`);
    remaining.forEach(c => {
        console.log(`- [${c.id}] ${c.title} (Len: ${c.content.length})`);
    });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
