
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Finding cases with "Unknown Agency" (no report or no department)...');

    // 1. Find cases where reportId is null
    const casesNoReport = await prisma.case.findMany({
        where: {
            reportId: null
        }
    });

    console.log(`Found ${casesNoReport.length} cases with no Report ID.`);

    // 2. Find cases where reportId exists but the report itself might have no department (though less likely based on previous scripts)
    // Actually, the UI shows '未知机构' if report?.department is missing.
    // Let's filter for cases where we want to delete.

    // Deleting cases with no report
    if (casesNoReport.length > 0) {
        const deleted = await prisma.case.deleteMany({
            where: {
                reportId: null
            }
        });
        console.log(`Deleted ${deleted.count} cases with no linked Report.`);
    }

    // 3. Find reports with empty department if any, and delete their cases?
    // Let's first assume the "Unknown Agency" ones are primarily those without a report relation.

    console.log('Operation complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
