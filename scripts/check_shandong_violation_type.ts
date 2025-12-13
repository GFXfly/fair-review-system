
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const report = await prisma.report.findFirst({
        where: {
            province: '山东省',
            title: { contains: '2023' }
        },
        include: {
            cases: true
        }
    });

    if (!report) return;

    for (const c of report.cases) {
        console.log(`ID: ${c.id}`);
        console.log(`Title: ${c.title}`);
        console.log(`Type: [${c.violationType || 'NULL'}]`);
        console.log('---------------------------------------------------');
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
