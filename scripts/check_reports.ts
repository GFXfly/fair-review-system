
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const report12 = await prisma.report.findUnique({ where: { id: 12 } });
    const report62 = await prisma.report.findUnique({ where: { id: 62 } });

    console.log('Report 12:', report12);
    console.log('Report 62:', report62);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
