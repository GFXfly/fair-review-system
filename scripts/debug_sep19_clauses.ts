
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
                    violationClause: true
                }
            }
        }
    });

    for (const report of reports) {
        console.log(`Report: ${report.title} (ID: ${report.id})`);
        report.cases.forEach(c => {
            console.log(`[${c.violationClause || 'EMPTY'}] - ${c.title.substring(0, 30)}...`);
        });
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
