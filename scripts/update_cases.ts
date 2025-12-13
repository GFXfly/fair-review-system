
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Update all cases that look like the ones we just added (e.g. from Jiangxi)
    // We can identify them by province '江西省'
    const result = await prisma.case.updateMany({
        where: {
            province: '江西省',
            sourceTitle: null
        },
        data: {
            sourceTitle: '江西省市场监管局通报公平竞争审查典型案例'
        }
    });

    console.log(`Updated ${result.count} cases.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
