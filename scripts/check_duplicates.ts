
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Jiangxi Cases ---');

    // Find the report first
    const report = await prisma.report.findFirst({
        where: { department: { contains: '江西' } },
        include: { cases: true }
    });

    if (!report) {
        console.log('Report not found');
        return;
    }

    console.log(`Report: ${report.title} (ID: ${report.id})`);
    console.log(`Total Linked Cases: ${report.cases.length}`);

    // Group by similar titles/content to identify versions
    // We can list them all out.
    // Also check unlinked cases that might be duplicates?

    const allJiangxiCases = await prisma.case.findMany({
        where: {
            OR: [
                { reportId: report.id },
                { title: { contains: '某' } } // The scraped titles all start with "某"
            ]
        },
        orderBy: { id: 'asc' }
    });

    console.log(`\nListing potential duplicates (Total found: ${allJiangxiCases.length}):`);

    allJiangxiCases.forEach(c => {
        console.log(`\nID: ${c.id} | ReportID: ${c.reportId}`);
        console.log(`Title: ${c.title}`);
        console.log(`Content Length: ${c.content.length} chars`);
        console.log(`Content Preview: ${c.content.substring(0, 50)}...`);
    });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
