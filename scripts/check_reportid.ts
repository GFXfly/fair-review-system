import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const cases = await prisma.case.findMany({
        where: { province: '江西省' }
    });

    console.log('Cases with reportId:');
    cases.forEach(c => {
        console.log(`ID: ${c.id}, reportId: ${c.reportId}`);
    });

    const reports = await prisma.report.findMany();
    console.log('\nReports:');
    reports.forEach(r => {
        console.log(`Report ID: ${r.id}, Title: ${r.title}`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
