
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const username = 'Felix';
    // Hash for 'GFX150602' generated locally
    const passwordHash = '$2b$10$1pRshh3Qm8WLQnSny1GcSuSBnAsSEpTLELvbqHFseCmDhCzK5eQeK';

    console.log(`Checking for user ${username}...`);
    const existing = await prisma.user.findUnique({ where: { username } });

    if (existing) {
        console.log('User exists. Updating password and role...');
        await prisma.user.update({
            where: { id: existing.id },
            data: {
                password: passwordHash,
                role: 'admin'
            }
        });
    } else {
        console.log('Creating new admin user...');
        await prisma.user.create({
            data: {
                username,
                password: passwordHash,
                name: 'Felix',
                role: 'admin',
                department: 'System Admin'
            }
        });
    }
    console.log('✅ Admin user Felix configured successfully.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
