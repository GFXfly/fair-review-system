import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const regulation = await prisma.regulation.findUnique({
        where: { id: 21 }
    });

    if (regulation) {
        // 统计章节
        const chapters = regulation.content.match(/## 第.章/g);
        const articles = regulation.content.match(/第.{1,3}条/g);

        console.log('章节数量:', chapters?.length || 0);
        console.log('条款数量:', articles?.length || 0);
        console.log('\n所有条款:');
        articles?.forEach((article, index) => {
            console.log(`${index + 1}. ${article}`);
        });
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
