
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log("Checking ZJJ user...");
    const user = await prisma.user.findFirst({
        where: { username: { contains: 'ZJJ' } }
    });

    if (!user) {
        console.log("User ZJJ not found!");
        return;
    }

    console.log(`Found User: ${user.username}, ID: ${user.id}, Role: ${user.role}`);

    const reviews = await prisma.reviewRecord.findMany({
        where: { userId: user.id },
        include: { user: true }
    });

    console.log(`Found ${reviews.length} reviews for this user.`);
    reviews.forEach(r => {
        console.log(`- Review ID: ${r.id}, File: ${r.fileName}, Created: ${r.createdAt}, User: ${r.user?.username}`);
    });

    // Also check admin user
    const admin = await prisma.user.findFirst({
        where: { role: 'admin' }
    });
    if (admin) {
        console.log(`Found Admin: ${admin.username}, ID: ${admin.id}, Role: ${admin.role}`);
    } else {
        console.log("No admin user found.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
