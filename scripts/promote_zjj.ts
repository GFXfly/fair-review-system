
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Promoting user 'ZJJ20251209' to admin...");

    const user = await prisma.user.findFirst({
        where: { username: 'ZJJ20251209' }
    });

    if (user) {
        console.log(`Found user: ${user.username}, Role: ${user.role}`);
        await prisma.user.update({
            where: { id: user.id },
            data: { role: 'admin' }
        });
        console.log("✅ Successfully updated role to 'admin'.");
    } else {
        console.log("❌ User 'ZJJ20251209' not found.");
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
