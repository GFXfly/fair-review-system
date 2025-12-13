
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Debugging Taizhou visibility...');

    // 1. Count Reports with "台州"
    const reports = await prisma.report.findMany({
        where: {
            title: { contains: '台州' }
        },
        include: {
            _count: {
                select: { cases: true }
            }
        }
    });

    console.log(`Found ${reports.length} reports with '台州' in title:`);
    reports.forEach(r => {
        console.log(` - ID: ${r.id}, Title: "${r.title}", Date: ${r.publishDate} (Cases: ${r._count.cases})`);
    });

    // 2. Search Cases with "某区发改局" (one of the reverted titles)
    const cases = await prisma.case.findMany({
        where: {
            title: { contains: '某区发改局' }
        },
        select: {
            id: true,
            title: true,
            reportId: true,
            publishDate: true,
            province: true
        }
    });

    console.log(`Found ${cases.length} cases with '某区发改局' in title:`);
    cases.forEach(c => {
        console.log(` - Case ID: ${c.id}, ReportID: ${c.reportId}, Date: ${c.publishDate}, Prov: ${c.province}, Title: ${c.title.substring(0, 20)}...`);
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
