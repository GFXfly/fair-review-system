import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Ensuring admin users...");

    const usersToEnsure = [
        {
            username: 'admin',
            passwordHash: '$2b$10$Xxn6i96VGimJ3.ezzPyKLOZelIFcPGuQVGuXtLl37xhTipqelBoUW', // admin123
            name: 'System Administrator',
            department: 'Information Center'
        },
        {
            username: 'Felix',
            passwordHash: '$2b$10$LIjg8BN.qsHfPOIzjQpaNebxR02zt31yrfVUN7U6WNOWjAmAJQXBC', // GFX150602
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
            console.log(`User ${u.username} exists. Updating role and password...`);
            await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    role: 'admin',
                    password: u.passwordHash
                }
            });
            console.log(`User ${u.username} updated.`);
        } else {
            console.log(`User ${u.username} not found. Creating...`);
            await prisma.user.create({
                data: {
                    username: u.username,
                    password: u.passwordHash,
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
