
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const report = await prisma.report.findUnique({
        where: { id: 5 },
        include: { cases: true }
    });

    if (!report) {
        console.log('Report 5 not found');
        return;
    }

    console.log(`Report: ${report.title}`);
    console.log(`Department: ${report.department}`);
    console.log(`PublishDate: ${report.publishDate}`);
    console.log(`Case Count: ${report.cases.length}`);

    if (report.cases.length > 0) {
        console.log('First case sample:');
        console.log(report.cases[0]);
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
