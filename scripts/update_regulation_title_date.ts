
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const oldTitle = '基层公平竞争审查实践问题集中答疑口径（第二批）';
    const newTitle = '公平竞争审查实践问题集中答疑口径（第二批）';
    const newDate = '2025-11-11';

    // Update the main regulation
    const result = await prisma.regulation.updateMany({
        where: {
            title: oldTitle
        },
        data: {
            title: newTitle,
            publishDate: newDate
        }
    });

    console.log(`Updated ${result.count} regulations.`);

    // Check if it worked
    const updatedReg = await prisma.regulation.findFirst({
        where: { title: newTitle }
    });
    console.log('Updated Regulation:', updatedReg);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
