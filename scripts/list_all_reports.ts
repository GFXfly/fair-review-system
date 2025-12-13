import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Listing all reports...');
    const reports = await prisma.report.findMany({
        orderBy: { id: 'desc' },
        include: {
            _count: {
                select: { cases: true }
            }
        }
    });

    console.table(reports.map(r => ({
        id: r.id,
        title: r.title.substring(0, 30) + '...',
        department: r.department,
        publishDate: r.publishDate,
        caseCount: r._count.cases
    })));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
