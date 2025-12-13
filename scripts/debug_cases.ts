
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const cases = await prisma.case.findMany({
        where: {
            reportId: 11
        }
    });

    console.log('Found cases:', cases.length);
    cases.forEach(c => {
        console.log(`ID: ${c.id}, ReportID: ${c.reportId}, Title: ${c.title.substring(0, 20)}...`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
