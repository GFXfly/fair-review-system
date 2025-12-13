
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Update the consolidated item
    await prisma.regulation.updateMany({
        where: {
            level: '总局指导/业务口径'
        },
        data: {
            level: '业务口径'
        }
    });

    console.log('Updated level to "业务口径"');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
