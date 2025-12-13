import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const regulations = await prisma.regulation.findMany({
        select: {
            id: true,
            title: true,
            content: true
        }
    });

    console.log('检查法规完整性 (内容长度 < 2000 字符):');
    let count = 0;

    for (const r of regulations) {
        if (r.content.length < 2000) {
            console.log(`[INCOMPLETE] ID: ${r.id}, 长度: ${r.content.length}, 标题: ${r.title}`);
            count++;
        } else {
            console.log(`[OK] ID: ${r.id}, 长度: ${r.content.length}, 标题: ${r.title}`);
        }
    }

    console.log(`\n总计发现 ${count} 条不完整法规 / 共 ${regulations.length} 条`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
