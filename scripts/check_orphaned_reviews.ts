
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking orphaned ReviewRecords...');

    const total = await prisma.reviewRecord.count();
    const orphans = await prisma.reviewRecord.count({
        where: { userId: null }
    });

    const linked = await prisma.reviewRecord.count({
        where: { userId: { not: null } }
    });

    console.log(`Total Records: ${total}`);
    console.log(`Orphans (No User): ${orphans}`);
    console.log(`Linked (Has User): ${linked}`);

    if (orphans > 0) {
        const sample = await prisma.reviewRecord.findFirst({
            where: { userId: null }
        });
        console.log('Sample orphan:', sample?.fileName, sample?.createdAt);
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
