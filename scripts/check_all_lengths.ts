import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('检查所有法规的内容长度:');
    const regulations = await prisma.regulation.findMany({
        orderBy: { id: 'asc' }
    });

    for (const r of regulations) {
        console.log(`ID: ${r.id}, 标题: ${r.title}, 长度: ${r.content.length}`);
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
