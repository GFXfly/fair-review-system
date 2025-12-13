
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const reportId = 62; // The ID of the report we kept

    const report = await prisma.report.findUnique({
        where: { id: reportId }
    });

    if (!report) {
        console.error(`Report ${reportId} not found`);
        return;
    }

    console.log(`Current Department: ${report.department}`);
    console.log(`Current Title: ${report.title}`);

    // Update the department to remove '办公厅'
    const updatedReport = await prisma.report.update({
        where: { id: reportId },
        data: {
            department: '国家发展和改革委员会',
            // Also updating title to be consistent if it starts with the office name, 
            // though the user's primary concern from the screenshot is likely the department column.
            // But "国家发展改革委办公厅..." is the official title often. 
            // The user said "把办公厅三个字去掉", I will primarily update the department field 
            // as that matches the screenshot exactly.
            // If the title also contains it prominently as the author, I might leave it 
            // or ask, but typically 'department' metadata is what fills the column in the screenshot.
        }
    });

    console.log(`Updated Report ${reportId}:`);
    console.log(`New Department: ${updatedReport.department}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
