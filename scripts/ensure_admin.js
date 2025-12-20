
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log("Ensuring admin users...");

    const usersToEnsure = [
        {
            username: 'admin',
            password: 'admin123',
            name: 'System Administrator',
            department: 'Information Center'
        },
        {
            username: 'Felix',
            password: 'GFX150602',
            name: 'Felix Admin',
            department: 'Super Admin Dept'
        }
    ];

    for (const u of usersToEnsure) {
        console.log(`Processing user: ${u.username}`);
        const existingUser = await prisma.user.findUnique({
            where: { username: u.username }
        });

        if (existingUser) {
            console.log(`User ${u.username} exists. Ensuring admin role...`);
            await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    role: 'admin'
                }
            });
            console.log(`User ${u.username} updated (password preserved).`);
        } else {
            console.log(`User ${u.username} not found. Creating...`);
            const hashedPassword = await bcrypt.hash(u.password, 10);
            await prisma.user.create({
                data: {
                    username: u.username,
                    password: hashedPassword,
                    name: u.name,
                    role: 'admin',
                    department: u.department
                }
            });
            console.log(`User ${u.username} created.`);
        }
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
