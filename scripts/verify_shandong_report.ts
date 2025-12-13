
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const report = await prisma.report.findFirst({
        where: {
            province: '山东省',
            title: { contains: '2023' }
        },
        include: {
            _count: {
                select: { cases: true }
            }
        }
    });

    if (report) {
        console.log(`Found Report: ${report.title}`);
        console.log(`Date: ${report.publishDate}`);
        console.log(`Case Count: ${report._count.cases}`);
    } else {
        console.log('Report not found');
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
