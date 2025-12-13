
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log("Ensuring admin user has correct role...");

    // 1. Try to find user 'admin'
    const adminUser = await prisma.user.findFirst({
        where: { username: 'admin' }
    });

    if (adminUser) {
        console.log(`Found user 'admin'. Current role: ${adminUser.role}`);
        if (adminUser.role !== 'admin') {
            await prisma.user.update({
                where: { id: adminUser.id },
                data: { role: 'admin' }
            });
            console.log("Updated 'admin' role to 'admin'.");
        } else {
            console.log("'admin' is already an admin.");
        }
    } else {
        console.log("User 'admin' not found. Creating...");
        // Create default admin if not exists
        await prisma.user.create({
            data: {
                username: 'admin',
                password: 'admin123', // Weak password, but ensure it exists.
                name: 'System Administrator',
                role: 'admin',
                department: 'Information Center'
            }
        });
        console.log("Created 'admin' user with password 'admin123'");
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
