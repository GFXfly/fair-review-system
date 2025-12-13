
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targetName = '内蒙古自治区市场监督管理局';
    const newName = '内蒙古自治区市场监管局';

    console.log(`Updating department name from "${targetName}" to "${newName}"...`);

    // 1. Update Reports
    const reportResult = await prisma.report.updateMany({
        where: {
            department: targetName
        },
        data: {
            department: newName
        }
    });
    console.log(`Updated ${reportResult.count} Reports.`);

    // 2. Update Regulations
    const regResult = await prisma.regulation.updateMany({
        where: {
            department: targetName
        },
        data: {
            department: newName
        }
    });
    console.log(`Updated ${regResult.count} Regulations.`);

    // 3. Update Cases (documentOrg)
    const caseResult = await prisma.case.updateMany({
        where: {
            documentOrg: targetName
        },
        data: {
            documentOrg: newName
        }
    });
    console.log(`Updated ${caseResult.count} Cases.`);

    console.log('Update complete.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
