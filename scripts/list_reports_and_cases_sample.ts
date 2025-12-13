import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching sample reports and cases...');

    // Get latest 3 reports
    const reports = await prisma.report.findMany({
        take: 3,
        orderBy: { id: 'desc' },
        include: { cases: { take: 1 } }
    });

    console.log('--- Reports ---');
    for (const r of reports) {
        console.log(`Report ID: ${r.id}, Title: ${r.title}`);
        if (r.cases.length > 0) {
            console.log(`  Sample Case: ${r.cases[0].title}`);
            console.log(`  Violation Type: ${r.cases[0].violationType}`);
            console.log(`  Document Name: ${r.cases[0].documentName}`);
            console.log(`  Structure: ${JSON.stringify(r.cases[0], null, 2)}`);
        }
    }

    // Get latest 3 cases without report
    const looseCases = await prisma.case.findMany({
        where: { reportId: null },
        take: 3,
        orderBy: { id: 'desc' }
    });

    console.log('\n--- Loose Cases (No Report) ---');
    for (const c of looseCases) {
        console.log(`Case ID: ${c.id}, Title: ${c.title}`);
        console.log(`  Violation Type: ${c.violationType}`);
        console.log(`  Result: ${c.result}`);
        console.log(`  Source: ${c.province}`);
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
