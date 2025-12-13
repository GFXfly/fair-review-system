import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking cases with missing publishDate...');
    const cases = await prisma.case.findMany({
        where: {
            publishDate: null
        },
        include: {
            report: true
        }
    });

    console.log(`Found ${cases.length} cases with missing publishDate.`);
    if (cases.length > 0) {
        console.log('Sample cases:');
        for (const c of cases.slice(0, 5)) {
            console.log(`- ID: ${c.id}, Title: ${c.title.substring(0, 20)}..., ReportID: ${c.reportId}, ReportDate: ${c.report?.publishDate}`);
        }
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
