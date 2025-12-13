
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting department name updates...');

    // 1. Update specific Shandong department name
    // Target: Shandong Provincial Fair Competition Review System Inter-departmental Joint Conference Office
    // New: Shandong Provincial Administration for Market Regulation
    const targetShandong = '山东省公平竞争审查制度部门际联席会议办公室';
    const newShandong = '山东省市场监督管理局';

    const shandongReports = await prisma.report.updateMany({
        where: {
            department: targetShandong
        },
        data: {
            department: newShandong
        }
    });
    console.log(`Updated ${shandongReports.count} reports from "${targetShandong}" to "${newShandong}"`);

    // 2. Generic update: "监管局" -> "监督管理局"
    // This often appears in abbreviations like "xx市市场监管局" -> "xx市市场监督管理局"

    // FETCH all reports to do regex-like replacement in JS (Prisma doesn't support regex replace easily in SQLite/all DBs)
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

    // Also check Regulations
    const allRegulations = await prisma.regulation.findMany();
    let regUpdateCount = 0;
    for (const reg of allRegulations) {
        if (reg.department && reg.department.includes('监管局') && !reg.department.includes('监督管理局')) {
            const newDept = reg.department.replace(/监管局/g, '监督管理局');
            await prisma.regulation.update({
                where: { id: reg.id },
                data: { department: newDept }
            });
            console.log(`Regulation [${reg.id}]: "${reg.department}" -> "${newDept}"`);
            regUpdateCount++;
        }
    }
    console.log(`Updated ${regUpdateCount} regulations.`);

    // Also check Cases (documentOrg)
    const allCases = await prisma.case.findMany();
    let caseUpdateCount = 0;
    for (const c of allCases) {
        let needsUpdate = false;
        let newOrg = c.documentOrg;

        // Specific Shandong fix for Case documentOrg
        if (newOrg === targetShandong) {
            newOrg = newShandong;
            needsUpdate = true;
        }
        // Generic fix
        else if (newOrg && newOrg.includes('监管局') && !newOrg.includes('监督管理局')) {
            newOrg = newOrg.replace(/监管局/g, '监督管理局');
            needsUpdate = true;
        }

        if (needsUpdate && newOrg) {
            await prisma.case.update({
                where: { id: c.id },
                data: { documentOrg: newOrg }
            });
            // console.log(`Case [${c.id}]: "${c.documentOrg}" -> "${newOrg}"`); // verbose
            caseUpdateCount++;
        }
    }
    console.log(`Updated ${caseUpdateCount} cases (documentOrg).`);

}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
