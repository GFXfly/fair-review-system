
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Correct Hash for 'GFX150602'
    const hash = '$2b$10$1pRshh3Qm8WLQnSny1GcSuSBnAsSEpTLELvbqHFseCmDhCzK5eQeK';

    console.log('Fixing password for Felix...');
    console.log('Hash to write:', hash);

    await prisma.user.update({
        where: { username: 'Felix' },
        data: { password: hash }
    });
    console.log('✅ Password fixed in DB.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
