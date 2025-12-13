import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const regulation = await prisma.regulation.findUnique({
        where: { id: 23 }
    });

    if (regulation) {
        console.log('标题:', regulation.title);
        console.log('内容长度:', regulation.content.length);
        console.log('\n查找第八条:');
        const index8 = regulation.content.indexOf('第八条');
        console.log('第八条位置:', index8);

        if (index8 !== -1) {
            console.log('\n第八条内容:');
            console.log(regulation.content.substring(index8, index8 + 200));
        }

        console.log('\n查找第四十八条:');
        const index48 = regulation.content.indexOf('第四十八条');
        console.log('第四十八条位置:', index48);

        if (index48 !== -1) {
            console.log('\n第四十八条内容:');
            console.log(regulation.content.substring(index48));
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
