
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targetDate = '2023-09-19';

    // Find report(s) on this date
    const reports = await prisma.report.findMany({
        where: {
            publishDate: targetDate
        },
        include: {
            cases: {
                select: {
                    id: true,
                    title: true,
                    violationClause: true,
                    violationType: true
                }
            }
        }
    });

    console.log(`Found ${reports.length} reports for ${targetDate}`);

    for (const report of reports) {
        console.log(`Report: ${report.title} (ID: ${report.id})`);
        console.log(`Cases count: ${report.cases.length}`);
        report.cases.forEach(c => {
            console.log(`- Case: ${c.title}`);
            console.log(`  Clause: ${c.violationClause}`);
            console.log(`  Type: ${c.violationType}`);
        });
    }

    // Also check for individual cases just in case they aren't linked to a report (though they should be)
    const cases = await prisma.case.findMany({
        where: {
            publishDate: targetDate
        },
        select: {
            id: true,
            title: true,
            violationClause: true
        }
    });
    console.log(`\nTotal cases found with publishDate ${targetDate}: ${cases.length}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
