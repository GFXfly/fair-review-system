
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const report = await prisma.report.findFirst({
        where: { title: { contains: '甘肃省市场监管局公布“破行政垄断 护公平竞争”典型案例（第二批）' } }
    });

    if (report) {
        console.log(`Found report: ${report.title} (ID: ${report.id})`);
        const deletedCases = await prisma.case.deleteMany({
            where: { reportId: report.id }
        });
        console.log(`Deleted ${deletedCases.count} cases associated with the report.`);

        await prisma.report.delete({
            where: { id: report.id }
        });
        console.log('Deleted the report itself.');
    } else {
        console.log('Report not found, nothing to delete.');
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
