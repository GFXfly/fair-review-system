
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Force updating Taizhou cases date...');

    // We found they are in Report ID 38 (created by the revert/add script, a new one)
    // And they have Date = null

    const result = await prisma.case.updateMany({
        where: {
            title: {
                in: [
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
                ]
            }
        },
        data: {
            publishDate: '2024-04-19',
            province: '浙江省'
        }
    });

    console.log(`Updated ${result.count} cases to date 2024-04-19.`);

    // Also update the logical report ID 38's date if it exists
    await prisma.report.updateMany({
        where: { id: 38 },
        data: { publishDate: '2024-04-19' }
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
