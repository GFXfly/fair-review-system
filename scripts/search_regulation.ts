import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const query = process.argv[2];
    if (!query) {
        console.error('Please provide a search query');
        process.exit(1);
    }

    const regulation = await prisma.regulation.findFirst({
        where: {
            title: {
                contains: query
            }
        }
    });

    if (regulation) {
        console.log('Found regulation:');
        console.log(`ID: ${regulation.id}`);
        console.log(`Title: ${regulation.title}`);
        console.log(`Content Preview: ${regulation.content.substring(0, 200)}...`);
    } else {
        console.log('Regulation not found.');
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
