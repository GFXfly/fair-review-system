
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Fix Case 153 specifically
    // Article 14 item 2
    const clause = '《公平竞争审查制度实施细则》第十四条第（二）项“不得排斥、限制或者强制外地经营者在本地投资或者设立分支机构、办事机构”';

    // Also check for any other missed ones
    const report = await prisma.report.findFirst({
        where: { title: { contains: '山东省' } },
        include: { cases: true }
    });

    // Find cases with short clauses
    const shortClauses = report?.cases.filter(c => c.violationClause && c.violationClause.length < 20);

    for (const c of shortClauses || []) {
        let newClause = c.violationClause;
        if (c.violationClause === '《实施细则》第十四条第二款') {
            newClause = clause;
        }

        if (newClause !== c.violationClause) {
            await prisma.case.update({
                where: { id: c.id },
                data: { violationClause: newClause }
            });
            console.log(`Updated Case ${c.id}: ${newClause}`);
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
