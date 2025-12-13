
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CLAUSE_MAPPING: Record<string, string> = {
    '《实施细则》第十三条第一款': '《公平竞争审查制度实施细则》第十三条第一款（不得设置不合理和歧视性的准入和退出条件）',
    '《实施细则》第十三条第三款': '《公平竞争审查制度实施细则》第十三条第三款（不得限定经营、购买、使用特定经营者提供的商品和服务）',
    '《实施细则》第十四条第一款': '《公平竞争审查制度实施细则》第十四条第一款（不得对外地和进口商品、服务实行歧视性价格和歧视性补贴政策）',
    '《实施细则》第十四条第三款': '《公平竞争审查制度实施细则》第十四条第三款（不得排斥或者限制外地经营者参加本地招标投标活动）',
    '《实施细则》第十四条第四款': '《公平竞争审查制度实施细则》第十四条第四款（不得排斥或者限制外地经营者在本地投资或者设立分支机构）',
    '《实施细则》第十五条第一款': '《公平竞争审查制度实施细则》第十五条第一款（不得违法给予特定经营者优惠政策）',
    '《实施细则》第十五条第二款': '《公平竞争审查制度实施细则》第十五条第二款（安排财政支出一般不得与企业缴纳的税收或非税收入挂钩）'
};

async function main() {
    const reportId = 15; // The report from Sep 19, 2023

    const cases = await prisma.case.findMany({
        where: { reportId }
    });

    console.log(`Found ${cases.length} cases to update in Report ${reportId}`);

    for (const c of cases) {
        let newClause = c.violationClause;

        // Iterate over keys to replace. 
        // Note: checking for exact match first, then partial if combined?
        // Actually, the previous data was exact strings like '《实施细则》第十三条第一款'.

        if (newClause && CLAUSE_MAPPING[newClause]) {
            newClause = CLAUSE_MAPPING[newClause];
        } else if (newClause === '《实施细则》第十五条第二款、第十三条第三款') {
            newClause = '《公平竞争审查制度实施细则》第十五条第二款（税收挂钩）、第十三条第三款（指定交易）';
        }

        if (newClause !== c.violationClause) {
            await prisma.case.update({
                where: { id: c.id },
                data: { violationClause: newClause }
            });
            console.log(`Updated case ${c.id}: ${c.violationClause} -> ${newClause}`);
        } else {
            console.log(`Skipped/No match for case ${c.id}: ${c.violationClause}`);
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
