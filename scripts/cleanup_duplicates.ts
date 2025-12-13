
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const reportIdToDelete = 8;

    // Delete cases first (due to foreign key usually, though Prisma might handle cascade if configured, better be explicit)
    const deleteCases = await prisma.case.deleteMany({
        where: {
            reportId: reportIdToDelete
        }
    });
    console.log(`Deleted ${deleteCases.count} cases for Report ID ${reportIdToDelete}`);

    // Delete the report
    const deleteReport = await prisma.report.delete({
        where: {
            id: reportIdToDelete
        }
    });
    console.log(`Deleted Report ID ${reportIdToDelete}: ${deleteReport.title}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
