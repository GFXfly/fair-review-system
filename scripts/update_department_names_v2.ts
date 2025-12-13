
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting department name updates (Retry)...');

    // 1. Update specific Shandong department name
    // Correct target: "山东省公平竞争审查制度部际联席会议办公室" (buji - inter-departmental)
    const targetShandong = '山东省公平竞争审查制度部际联席会议办公室';
    const newShandong = '山东省市场监督管理局';

    // Update Reports
    const shandongReports = await prisma.report.updateMany({
        where: {
            department: targetShandong
        },
        data: {
            department: newShandong
        }
    });
    console.log(`Updated ${shandongReports.count} reports from "${targetShandong}" to "${newShandong}"`);

    // Update Cases (documentOrg) if they have this name
    const shandongCases = await prisma.case.updateMany({
        where: {
            documentOrg: targetShandong
        },
        data: {
            documentOrg: newShandong
        }
    });
    console.log(`Updated ${shandongCases.count} cases (documentOrg) from "${targetShandong}" to "${newShandong}"`);

    // 2. Generic update: "监管局" -> "监督管理局"
    // This often appears in abbreviations like "xx市市场监管局" -> "xx市市场监督管理局"

    // FETCH all reports to do regex-like replacement in JS
    const allReports = await prisma.report.findMany();
    let reportUpdateCount = 0;

    for (const report of allReports) {
        if (report.department.includes('监管局') && !report.department.includes('监督管理局')) {
            const newDept = report.department.replace(/监管局/g, '监督管理局');
            await prisma.report.update({
                where: { id: report.id },
                data: { department: newDept }
            });
            console.log(`Report [${report.id}]: "${report.department}" -> "${newDept}"`);
            reportUpdateCount++;
        }
    }
    console.log(`Updated ${reportUpdateCount} reports with "监管局" -> "监督管理局" correction.`);

    // Also check Cases (documentOrg) for generic replace
    const allCases = await prisma.case.findMany();
    let caseUpdateCount = 0;
    for (const c of allCases) {
        let newOrg = c.documentOrg;
        if (newOrg && newOrg.includes('监管局') && !newOrg.includes('监督管理局')) {
            newOrg = newOrg.replace(/监管局/g, '监督管理局');
            await prisma.case.update({
                where: { id: c.id },
                data: { documentOrg: newOrg }
            });
            // console.log(`Case [${c.id}]: "${c.documentOrg}" -> "${newOrg}"`); 
            caseUpdateCount++;
        }
    }
    console.log(`Updated ${caseUpdateCount} cases (documentOrg) with generic fix.`);

}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
