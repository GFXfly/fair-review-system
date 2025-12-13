
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 查找山东省的那个报告
    const report = await prisma.report.findFirst({
        where: {
            province: '山东省',
            title: '关于发布2023年违反公平竞争审查标准的典型整改案例的公告'
        }
    });

    if (report) {
        // 更新标题，使其更正规，带上发布部门
        const newTitle = '山东省公平竞争审查制度部际联席会议办公室关于发布2023年违反公平竞争审查标准的典型整改案例的公告';
        await prisma.report.update({
            where: { id: report.id },
            data: {
                title: newTitle,
                department: '山东省公平竞争审查制度部际联席会议办公室' // 确保部门也准确
            }
        });
        console.log(`✓ 已完善通报标题: ${newTitle}`);
    } else {
        console.log('未找到需要更新的山东省通报记录。');
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
