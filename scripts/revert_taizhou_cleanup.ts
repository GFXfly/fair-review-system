
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Reverting Taizhou cases to old format...');

    // 1. Delete the "fancy" cases (starting with "台州市")
    const { count } = await prisma.case.deleteMany({
        where: {
            title: {
                startsWith: '台州市'
            }
        }
    });

    console.log(`Deleted ${count} "fancy" format cases.`);

    // 2. Also ensure we don't have duplicates of the "old" format
    // Just in case they exist but are hidden or were added by mistake.
    const oldTitles = [
        '某区发改局文件对不同组织形式的经营者实施差别化待遇并变相设定市场准入障碍',
        '某区商务局文件对不同组织形式的经营者实施差别化待遇并变相设定市场准入障碍',
        '某区政府文件对不同所有制、组织形式的经营者实施差别化待遇',
        '某市政府文件安排财政支出与企业缴纳税收挂钩并对不同地区、组织形式的经营者实施差别化待遇',
        '某市政府文件违规给予特定经营者财政奖补并对不同地区经营者实施差别化待遇',
        '某市政府文件对不同经营者实施差别化待遇并违规给予特定经营者财政奖补',
        '某县政府文件违规减免特定经营应缴纳的社会保险费用',
        '某县政府违规给予特定经营者优惠政策并设置不合理的市场准入和退出条件',
        '某县政府文件对不同地区的经营者实施差别化待遇并违规给予特定经营者优惠政策',
        '某区政府文件通过设置名录库排斥或限制潜在经营提供商品服务'
    ];

    const delOld = await prisma.case.deleteMany({
        where: {
            title: {
                in: oldTitles
            }
        }
    });
    console.log(`Deleted ${delOld.count} potentially existing old cases to ensure clean slate.`);

    // 3. Ensure the report exists and has the correct date
    // We want it to be recent or dated correctly so the user can find it.
    // The previous script sets it to '2024-04-19'.
    // We should check if the report '台州市公平竞争十大典型案例' exists.
    let report = await prisma.report.findFirst({
        where: { title: '台州市公平竞争十大典型案例' }
    });

    if (!report) {
        console.log('Report not found, it will be created by the add script.');
    } else {
        console.log(`Report found (ID: ${report.id}). Updating date to ensure visibility if needed.`);
        // Ensure date is 2024-04-19
        await prisma.report.update({
            where: { id: report.id },
            data: { publishDate: '2024-04-19' }
        });
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
