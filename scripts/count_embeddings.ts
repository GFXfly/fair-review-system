
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const totalCases = await prisma.case.count();
    const casesWithEmbeddings = await prisma.case.count({
        where: {
            embedding: {
                not: null
            }
        }
    });

    const casesWithoutEmbeddings = await prisma.case.count({
        where: {
            embedding: null
        }
    });

    console.log(`Total Cases: ${totalCases}`);
    console.log(`Cases with Embeddings: ${casesWithEmbeddings}`);
    console.log(`Cases WITHOUT Embeddings: ${casesWithoutEmbeddings}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
