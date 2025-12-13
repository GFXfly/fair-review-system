import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 检查现有法规
    const regulations = await prisma.regulation.findMany({
        select: {
            id: true,
            title: true
        }
    });

    console.log('当前数据库中的法规:');
    regulations.forEach(r => {
        console.log(`ID ${r.id}: ${r.title}`);
    });

    console.log('\n总计:', regulations.length, '条法规');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
