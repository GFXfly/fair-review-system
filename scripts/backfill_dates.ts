import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Backfilling case publish dates from reports...');

    // Find cases with missing date but valid report
    const casesToUpdate = await prisma.case.findMany({
        where: {
            publishDate: null,
            reportId: { not: null }
        },
        include: {
            report: true
        }
    });

    console.log(`Found ${casesToUpdate.length} cases to update.`);

    let updatedCount = 0;
    for (const c of casesToUpdate) {
        if (c.report && c.report.publishDate) {
            await prisma.case.update({
                where: { id: c.id },
                data: {
                    publishDate: c.report.publishDate
                }
            });
            updatedCount++;
        }
    }

    console.log(`Successfully updated ${updatedCount} cases with dates from their parent reports.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
