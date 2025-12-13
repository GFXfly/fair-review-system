
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Listing "unknown" Taizhou cases...');

    // Find cases with the titles we know, to see their IDs and ReportIDs
    const titles = [
        '某区发改局文件对不同组织形式的经营者实施差别化待遇并变相设定市场准入障碍',
        '某区商务局文件对不同组织形式的经营者实施差别化待遇并变相设定市场准入障碍'
    ];

    const cases = await prisma.case.findMany({
        where: {
            title: {
                in: titles
            }
        }
    });

    console.log(`Found ${cases.length} matching cases.`);
    cases.forEach(c => {
        console.log(`ID: ${c.id}, ReportID: ${c.reportId}, Date: ${c.publishDate}, Title: ${c.title.substring(0, 20)}`);
    });

    // Also check report 37 again
    const reportCases = await prisma.case.count({ where: { reportId: 37 } });
    console.log(`Report 37 has ${reportCases} cases.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
