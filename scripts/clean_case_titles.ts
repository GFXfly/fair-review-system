
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('开始清理案例标题中的日期备注...');

    // 1. 获取所有包含 “通报版）” 的案例
    // 我们的后缀格式主要是 "（2024-XX-XX通报版）"
    const cases = await prisma.case.findMany({
        where: {
            title: {
                contains: '通报版）'
            }
        }
    });

    console.log(`找到 ${cases.length} 个需要清理标题的案例。`);

    // 2. 遍历清理
    for (const c of cases) {
        // 使用正则去掉括号及其内容
        // 匹配 "（XXXX-XX-XX通报版）" 或 "(XXXX-XX-XX通报版)"
        const newTitle = c.title.replace(/[\(（]\d{4}-\d{2}-\d{2}通报版[\)）]/g, '').trim();

        if (newTitle !== c.title) {
            await prisma.case.update({
                where: { id: c.id },
                data: { title: newTitle }
            });
            console.log(`已修改: "${c.title}" -> "${newTitle}"`);
        }
    }

    console.log('✅ 所有标题已清理完毕。');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
