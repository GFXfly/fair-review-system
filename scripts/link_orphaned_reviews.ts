
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Linking orphaned ReviewRecords to Admin user (ID: 1)...');

    const result = await prisma.reviewRecord.updateMany({
        where: { userId: null },
        data: { userId: 1 }
    });

    console.log(`Updated ${result.count} orphaned records to belong to User ID 1.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
