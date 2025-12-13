
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Delete the specific case that is actually the title
    const deleteResult = await prisma.case.deleteMany({
        where: {
            title: '江西省市场监管局通报公平竞争审查典型案例'
        }
    });
    console.log(`Deleted ${deleteResult.count} cases with title '江西省市场监管局通报公平竞争审查典型案例'.`);

    // 2. Update the department for the Jiangxi cases
    // We identify them by sourceTitle
    const updateResult = await prisma.case.updateMany({
        where: {
            sourceTitle: '江西省市场监管局通报公平竞争审查典型案例'
        },
        data: {
            department: '江西省市场监管局'
        }
    });
    console.log(`Updated department for ${updateResult.count} cases.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
