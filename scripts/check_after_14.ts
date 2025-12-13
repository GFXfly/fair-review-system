import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const regulation = await prisma.regulation.findUnique({
        where: { id: 21 }
    });

    if (regulation) {
        // 查找第十四条之后的内容
        const index = regulation.content.indexOf('第十四条');
        if (index !== -1) {
            console.log('找到第十四条，位置:', index);
            console.log('\n第十四条之后的内容:');
            console.log(regulation.content.substring(index, index + 800));
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
