import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('开始修正辽宁省案例数据...');

    // 1. 修正通报标题（确保与图片一致）
    // 之前可能误设置为 '辽宁省市场监督管理局发布...'，现修正为图片原文 '6起公平竞争审查案例公布！'
    await prisma.report.update({
        where: { id: 28 },
        data: {
            title: '6起公平竞争审查案例公布！',
            publishDate: '2025-09-08' // 再次确认为 2025-09-08
        }
    });
    console.log('✅ 通报标题及日期已确认');

    // 2. 修正案例3中的错别字 "上形规" -> "上规"
    const case3 = await prisma.case.findFirst({
        where: {
            reportId: 28,
            title: { contains: '上形规' }
        }
    });

    if (case3) {
        const newTitle = case3.title.replace('上形规', '上规');
        const newContent = case3.content.replace('上形规', '上规');
        const newDocName = case3.documentName.replace('上形规', '上规');

        await prisma.case.update({
            where: { id: case3.id },
            data: {
                title: newTitle,
                content: newContent,
                documentName: newDocName
            }
        });
        console.log('✅ 已修正案例3中的错别字 (上形规 -> 上规)');
    } else {
        console.log('ℹ️ 未发现 "上形规" 错别字 (可能已修正)');
    }

    const report = await prisma.report.findUnique({
        where: { id: 28 },
        include: { cases: true }
    });
    console.log('\n=== 最终数据状态 ===');
    console.log('标题:', report?.title);
    console.log('日期:', report?.publishDate);
    console.log('案例数:', report?.cases.length);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
