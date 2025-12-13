
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const totalCases = await prisma.case.count();
    console.log(`Total cases: ${totalCases}`);

    const reports = await prisma.report.findMany({
        include: {
            _count: {
                select: { cases: true }
            }
        },
        orderBy: {
            id: 'asc'
        }
    });

    console.log('Case counts per report:');
    reports.forEach(r => {
        console.log(`ID: ${r.id} | Title: ${r.title.substring(0, 30)}... | Cases: ${r._count.cases}`);
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
