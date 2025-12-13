import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const regulation = await prisma.regulation.findUnique({
        where: { id: 21 }
    });

    if (regulation) {
        console.log('法规标题:', regulation.title);
        console.log('发布部门:', regulation.department);
        console.log('发布日期:', regulation.publishDate);
        console.log('效力级别:', regulation.level);
        console.log('\n内容长度:', regulation.content.length, '字符');
        console.log('\n内容预览（前500字符）:');
        console.log(regulation.content.substring(0, 500));
        console.log('\n...');
        console.log('\n内容结尾（最后200字符）:');
        console.log(regulation.content.substring(regulation.content.length - 200));
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
