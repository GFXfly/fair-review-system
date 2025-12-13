
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const reportId = 12; // The old report ID to delete

    // 1. Check if report exists
    const report = await prisma.report.findUnique({
        where: { id: reportId },
        include: { _count: { select: { cases: true } } }
    });

    if (!report) {
        console.log(`Report with ID ${reportId} not found.`);
        return;
    }

    console.log(`Found report: ${report.title}`);
    console.log(`Number of cases to delete: ${report._count.cases}`);

    // 2. Delete associated cases
    const deleteCases = await prisma.case.deleteMany({
        where: {
            reportId: reportId
        }
    });
    console.log(`Deleted ${deleteCases.count} cases.`);

    // 3. Delete the report
    const deleteReport = await prisma.report.delete({
        where: {
            id: reportId
        }
    });
    console.log(`Deleted report: ${deleteReport.title} (ID: ${deleteReport.id})`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
