import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Create the Report record
    const report = await prisma.report.create({
        data: {
            title: '江西省市场监管局通报公平竞争审查典型案例',
            department: '江西省市场监管局',
            publishDate: '2025-12-02',
            province: '江西省'
        }
    });

    console.log(`Created report with ID: ${report.id}`);

    // 2. Link all Jiangxi cases to this report
    const result = await prisma.case.updateMany({
        where: {
            province: '江西省'
        },
        data: {
            reportId: report.id
        }
    });

    console.log(`Linked ${result.count} cases to report ${report.id}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
