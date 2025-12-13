
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.regulation.count();
    console.log(`Total Regulations: ${count}`);
    const regs = await prisma.regulation.findMany({ select: { title: true }, take: 5 });
    console.log('Sample Regulations:', regs);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
