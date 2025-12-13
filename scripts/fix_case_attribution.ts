import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('开始修正专项行动案件归属...\n');

    // 1. 创建第二批专项行动通报
    const report2Data = {
        title: '整治滥用行政权力排除、限制竞争专项行动案件（第二批）',
        department: '国家市场监督管理总局',
        publishDate: '2025-10-01', // 根据图片，应该是2025年的某个时间
        province: '全国'
    };

    let report2 = await prisma.report.findFirst({
        where: { title: report2Data.title }
    });

    if (!report2) {
        console.log('创建第二批专项行动通报...');
        report2 = await prisma.report.create({
            data: report2Data
        });
        console.log('✅ 已创建 Report ID:', report2.id);
    } else {
        console.log('使用已有的第二批通报, ID:', report2.id);
    }

    // 2. 查找需要重新归类的案例（当前在 Report ID 5 下，但应该在第二批专项行动下）
    // 根据图片，第二批包含的案例有：珠海、福建南平等
    const casesToMove = [
        '珠海市香洲区',
        '南平市水利局',
        '济宁市科技局',
        '曲水县人民政府',
        '靖西市人民政府',
        '南陵县教育局'
    ];

    console.log('\n开始重新归类案例...');
    let movedCount = 0;

    for (const keyword of casesToMove) {
        const cases = await prisma.case.findMany({
            where: {
                title: { contains: keyword },
                reportId: 5 // 当前在发改委通报下
            }
        });

        for (const c of cases) {
            await prisma.case.update({
                where: { id: c.id },
                data: { reportId: report2.id }
            });
            console.log(`✅ 已移动: ${c.title.substring(0, 50)}...`);
            movedCount++;
        }
    }

    console.log(`\n总共移动了 ${movedCount} 个案例`);

    // 3. 显示最终结果
    const report2Final = await prisma.report.findUnique({
        where: { id: report2.id },
        include: { cases: true }
    });

    if (report2Final) {
        console.log('\n=== 第二批专项行动通报最终状态 ===');
        console.log('标题:', report2Final.title);
        console.log('发布机构:', report2Final.department);
        console.log('案例数:', report2Final.cases.length);
    }

    const report5Final = await prisma.report.findUnique({
        where: { id: 5 },
        include: { cases: true }
    });

    if (report5Final) {
        console.log('\n=== 发改委第五批通报剩余案例数 ===');
        console.log('案例数:', report5Final.cases.length);
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
