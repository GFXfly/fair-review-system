
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const caseCount = await prisma.case.count();
        console.log(`Total Cases in Database: ${caseCount}`);

        // Optional: breakdown by source or type if useful
        const regulationsCount = await prisma.regulation.count();
        console.log(`Total Regulations: ${regulationsCount}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
