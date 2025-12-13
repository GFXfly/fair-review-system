
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MAPPING = {
    '《实施细则》第十三条第一款': '《公平竞争审查制度实施细则》第十三条第（一）项“不得设置不合理或者歧视性的准入和退出条件”',
    '《实施细则》第十三条第二款': '《公平竞争审查制度实施细则》第十三条第（二）项“不得未经公平竞争授予经营者特许经营权”',
    '《实施细则》第十三条第三款': '《公平竞争审查制度实施细则》第十三条第（三）项“不得排斥或者限制外地经营者参加本地招标投标活动”',
    '《实施细则》第十四条第一款': '《公平竞争审查制度实施细则》第十四条第（一）项“不得对外地和进口商品、服务实行歧视性价格和歧视性补贴政策”',
    '《实施细则》第十五条第一款': '《公平竞争审查制度实施细则》第十五条第（一）项“不得违法给予特定经营者优惠政策”',
    '《实施细则》第十五条第二款': '《公平竞争审查制度实施细则》第十五条第（二）项“安排财政支出一般不得与特定经营者缴纳的税收或非税收入挂钩”',
    '《反垄断法》第三十二条': '《中华人民共和国反垄断法》第三十二条“行政机关和法律、法规授权的具有管理公共事务职能的组织不得滥用行政权力，限定或者变相限定单位或者个人经营、购买、使用其指定的经营者提供的商品”'
    // Add truncated versions if necessary
};

async function main() {
    const report = await prisma.report.findFirst({
        where: {
            title: { contains: '山东省' },
            publishDate: '2023-12-07'
        },
        include: { cases: true }
    });

    if (!report) {
        console.log('Shandong report not found');
        return;
    }

    console.log(`Updating cases for report: ${report.title}`);

    for (const c of report.cases) {
        // Simple matching
        let newClause = c.violationClause;

        // Try exact match first
        if (c.violationClause && MAPPING[c.violationClause]) {
            newClause = MAPPING[c.violationClause];
        }
        // Try fuzzy match
        else if (c.violationClause) {
            for (const key of Object.keys(MAPPING)) {
                if (c.violationClause.includes(key.replace('《实施细则》', ''))) { // looser check
                    newClause = MAPPING[key];
                    break;
                }
            }
        }

        // Special handling for some specific cases if mapping failed but we know the content
        if (newClause === c.violationClause) {
            if (c.content.includes('不得设置不合理或者歧视性的准入和退出条件')) {
                newClause = MAPPING['《实施细则》第十三条第一款'];
            } else if (c.content.includes('招投标')) {
                newClause = MAPPING['《实施细则》第十三条第三款'];
            } else if (c.content.includes('税收')) {
                newClause = MAPPING['《实施细则》第十五条第二款'];
            } else if (c.content.includes('优惠政策')) {
                newClause = MAPPING['《实施细则》第十五条第一款'];
            }
        }

        if (newClause !== c.violationClause) {
            console.log(`Updating Case ${c.id}:`);
            console.log(`  Old: ${c.violationClause}`);
            console.log(`  New: ${newClause}`);
            await prisma.case.update({
                where: { id: c.id },
                data: { violationClause: newClause }
            });
        } else {
            console.log(`Skipping Case ${c.id} (No mapping found for ${c.violationClause})`);
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
