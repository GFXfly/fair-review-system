import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const username = 'admin';

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
        where: { username }
    });

    if (!existingUser) {
        const user = await prisma.user.create({
            data: {
                username: 'admin',
                password: 'admin123', // In production, hash this!
                name: '系统管理员',
                department: '市场监管总局',
                role: 'admin'
            }
        });
        console.log('Admin user created:', user);
    } else {
        console.log('Admin user already exists.');
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
