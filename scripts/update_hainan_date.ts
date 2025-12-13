
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Update Hainan Report publishDate
    const hainanReport = await prisma.report.findFirst({
        where: {
            title: {
                contains: '海南省卫生健康委员会滥用行政权力'
            }
        }
    });

    if (hainanReport) {
        await prisma.report.update({
            where: { id: hainanReport.id },
            data: {
                publishDate: '2024-04-17'
            }
        });

        // Also update the cases associated with it if they need specific dates, 
        // usually cases inherit report date or use it. 
        // The previous script didn't set date on cases for this one, 
        // so let's set it on the cases too to be safe/consistent.
        await prisma.case.updateMany({
            where: { reportId: hainanReport.id },
            data: {
                publishDate: '2024-04-17'
            }
        });

        console.log(`Updated Hainan Report ${hainanReport.id} and cases date to 2024-04-17.`);
    } else {
        console.log('Hainan report not found for update.');
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
