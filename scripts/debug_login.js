
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testLogin() {
    console.log('--- Debug Login Start ---');
    const username = 'Felix';
    const password = 'GFX150602';

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
        console.log('User not found!');
        return;
    }

    console.log(`User found: ${user.username}`);
    console.log(`Stored Hash: ${user.password}`);
    console.log(`Input Password: ${password}`);

    // Test compare
    const isValid = await bcrypt.compare(password, user.password);
    console.log(`bcrypt.compare result: ${isValid}`);

    if (isValid) {
        console.log('✅ LOGIN SHOULD SUCCESS');
    } else {
        console.log('❌ PASSWORD MISMATCH');

        // Try to generate new hash
        const newHash = await bcrypt.hash(password, 10);
        console.log(`Generated NEW Hash: ${newHash}`);

        // Validate new hash immediately
        const testNew = await bcrypt.compare(password, newHash);
        console.log(`Test new hash: ${testNew}`);
    }
}

testLogin()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
