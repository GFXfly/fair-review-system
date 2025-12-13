
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Check cases created or updated in the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentCases = await prisma.case.findMany({
        where: {
            updatedAt: {
                gte: yesterday
            }
        },
        include: {
            report: true
        }
    });

    console.log(`Checking ${recentCases.length} recently updated cases for completeness...`);
    console.log('---------------------------------------------------');

    let incompleteCount = 0;

    for (const c of recentCases) {
        const issues = [];
        if (!c.violationDetail || c.violationDetail.length < 5) issues.push('Missing/Short Violation Detail');
        if (!c.documentName || c.documentName.length < 2) issues.push('Missing Document Name');
        // Check if clause is just a reference (short) or has content (long)
        // A simple reference like "《反垄断法》第三十二条" is about 10-15 chars. 
        // A full quote covers more. Let's say < 30 chars is suspicious for "completeness".
        if (!c.violationClause || c.violationClause.length < 30) issues.push('Short/Missing Clause Text');

        if (issues.length > 0) {
            console.log(`[${c.report?.title?.substring(0, 20)}...] - ${c.title.substring(0, 30)}...`);
            console.log(`   Issues: ${issues.join(', ')}`);
            incompleteCount++;
        }
    }

    console.log('---------------------------------------------------');
    if (incompleteCount === 0) {
        console.log('All recent cases appear to have complete details (Detail, Document, Full Clause).');
    } else {
        console.log(`Found ${incompleteCount} cases that might be missing full details.`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
