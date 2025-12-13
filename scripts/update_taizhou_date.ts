
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Updating publishDate for Taizhou cases...');

    const report = await prisma.report.findFirst({
        where: { title: '台州市公平竞争十大典型案例' }
    });

    if (!report) {
        console.error('Report not found!');
        return;
    }

    const correctDate = '2024-04-19';

    // Update cases linked to this report
    const result = await prisma.case.updateMany({
        where: {
            reportId: report.id
        },
        data: {
            publishDate: correctDate,
            province: '浙江省' // Ensure province is set too while we are at it
        }
    });

    console.log(`Updated ${result.count} cases to date ${correctDate} linked to Report ID ${report.id}.`);

    // Also try to update by title just in case they aren't linked correctly (the "revert" script might have created them without linking if I wasn't careful, but the script looked correct)
    // The previous add script used `report.id` so they should be linked.
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
