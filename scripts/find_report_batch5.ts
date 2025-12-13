
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const reports = await prisma.report.findMany({
        where: {
            title: {
                contains: '第5期'
            }
        }
    });

    const reports2 = await prisma.report.findMany({
        where: {
            title: {
                contains: '第五批'
            }
        }
    });

    console.log('Reports with 第5期:', reports);
    console.log('Reports with 第五批:', reports2);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
