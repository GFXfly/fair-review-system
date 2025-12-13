import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const id = 18;
    const regulation = await prisma.regulation.findUnique({
        where: { id: id }
    });

    if (regulation) {
        console.log(regulation.content);
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
