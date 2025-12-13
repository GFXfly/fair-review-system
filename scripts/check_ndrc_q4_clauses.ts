
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const reportTitle = '国家发展改革委办公厅关于2021年第四季度违背市场准入负面清单典型案例的通报';

    const report = await prisma.report.findFirst({
        where: { title: reportTitle },
        include: { cases: true }
    });

    if (!report) {
        console.log('Report not found');
        return;
    }

    console.log(`Report: ${report.title}`);
    console.log(`Total Cases: ${report.cases.length}`);
    console.log('--- Case Violation Clauses ---');
    report.cases.forEach((c, index) => {
        console.log(`${index + 1}. ${c.title}`);
        console.log(`   Violation Clause: ${c.violationClause || '[EMPTY]'}`);
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
