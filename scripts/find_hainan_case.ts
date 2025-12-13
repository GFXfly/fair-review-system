
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const report = await prisma.report.findFirst({
        where: {
            title: {
                contains: '海南省卫生健康委员会滥用行政权力'
            }
        },
        include: { cases: true }
    });

    console.log(report);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
