
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const report = await prisma.report.findFirst({
        where: {
            province: '山东省',
            title: { contains: '2023' } // Find the Shandong report
        },
        include: {
            cases: true
        }
    });

    if (!report) {
        console.log('Shandong report not found');
        return;
    }

    console.log(`Checking Report: ${report.title}`);
    console.log('---------------------------------------------------');
    for (const c of report.cases) {
        console.log(`ID: ${c.id}`);
        console.log(`Title: ${c.title}`);
        console.log(`ViolationClause: [${c.violationClause || 'NULL'}]`); // Check if this is empty
        console.log('---------------------------------------------------');
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
