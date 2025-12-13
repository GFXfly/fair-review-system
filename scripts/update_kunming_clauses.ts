
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const updates = [
        {
            title: '昆明市某区文化和旅游局违规限制外地企业申报旅游业补助资金',
            violationClause: '《公平竞争审查制度实施细则》第十三条第一款“2.没有法律、行政法规或者国务院规定依据，对不同所有制、地区、组织形式的经营者实施不合理的差别化待遇，设置不平等的市场准入和退出条件”及“1.设置明显不必要或者超出实际需要的退出条件”'
        },
        {
            title: '昆明市某县经济技术开发区管理委员会在招标公告中违规设定营业执照经营范围限制',
            violationClause: '《公平竞争审查制度实施细则》第十三条第一款“3.没有法律、行政法规或者国务院规定依据，以备案、登记、注册、目录、年检、年报、监制、认定、认证、认可、检验、监测、审定、指定、配号、复检、复审、换证、要求设立分支机构以及其他任何形式，设定或者变相设定市场准入障碍”'
        },
        {
            title: '昆明市某县人民政府办公室公务用车定点维修采购公告中限定本地服务',
            violationClause: '《公平竞争审查制度实施细则》第十三条第三款“不得限定经营、购买、使用特定经营者提供的商品和服务”。同时违反《反垄断法》第三十二条“限定或者变相限定单位或者个人经营、购买、使用其指定的经营者提供的商品”及第三十七条“制定含有排除、限制竞争内容的规定”'
        },
        {
            title: '昆明市某区水务局在河道管护招标公告中限制投标人独立法人资格',
            violationClause: '《公平竞争审查制度实施细则》第十三条第一款“2.没有法律、行政法规或者国务院规定依据，对不同所有制、地区、组织形式的经营者实施不合理的差别化待遇”及“3.没有法律、行政法规或者国务院规定依据...设定或者变相设定市场准入障碍”'
        }
    ];

    for (const update of updates) {
        const kCase = await prisma.case.findFirst({
            where: {
                title: update.title
            }
        });

        if (kCase) {
            await prisma.case.update({
                where: { id: kCase.id },
                data: {
                    violationClause: update.violationClause
                }
            });
            console.log(`Updated violation clause for: ${update.title}`);
        } else {
            console.log(`Case not found: ${update.title}`);
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
