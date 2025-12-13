
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('正在查找山东省的相关通报...');

    // 搜索包含“山东”的通报
    const reports = await prisma.report.findMany({
        where: {
            OR: [
                { title: { contains: '山东' } },
                { department: { contains: '山东' } },
                { province: { contains: '山东' } }
            ]
        },
        include: {
            cases: true
        }
    });

    if (reports.length === 0) {
        console.log('未找到山东省的相关通报。');
    } else {
        console.log(`找到 ${reports.length} 个山东省相关通报：`);
        for (const report of reports) {
            console.log(`\n通报ID: ${report.id}`);
            console.log(`标题: ${report.title}`);
            console.log(`发布日期: ${report.publishDate}`);
            console.log(`关联案例数: ${report.cases.length}`);

            // 打印前几个案例的标题和内容摘要，以便核对
            for (const c of report.cases.slice(0, 3)) {
                console.log(`  - 案例: ${c.title}`);
                console.log(`    内容预览: ${c.content.substring(0, 50)}...`);
            }
            if (report.cases.length > 3) {
                console.log(`    ...剩余 ${report.cases.length - 3} 个案例`);
            }
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
