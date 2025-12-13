
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const reportTitle = '国家发展改革委办公厅关于2021年第四季度违背市场准入负面清单典型案例的通报';
    const violationContent = '《市场准入负面清单》市场准入负面清单事项类型和准入要求';

    const report = await prisma.report.findFirst({
        where: { title: reportTitle },
        include: { cases: true }
    });

    if (!report) {
        console.log('Report not found');
        return;
    }

    console.log(`Updating empty violation clauses for report: ${report.title}`);

    let updatedCount = 0;

    for (const c of report.cases) {
        if (!c.violationClause || c.violationClause.trim() === '') {
            await prisma.case.update({
                where: { id: c.id },
                data: {
                    violationClause: violationContent
                }
            });
            console.log(`Updated case: ${c.title}`);
            updatedCount++;
        }
    }

    console.log(`\nSuccessfully updated ${updatedCount} cases.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
