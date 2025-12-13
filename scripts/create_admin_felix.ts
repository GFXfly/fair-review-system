import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
    try {
        // Check if user already exists
        const existing = await prisma.user.findUnique({
            where: { username: 'Felix' }
        });

        if (existing) {
            console.log('✓ User Felix already exists');
            console.log('  Role:', existing.role);
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash('GFX150602', 10);

        // Create admin user
        const admin = await prisma.user.create({
            data: {
                username: 'Felix',
                password: hashedPassword,
                name: 'Felix',
                department: '系统管理',
                role: 'admin'
            }
        });

        console.log('✓ Admin user created successfully!');
        console.log('  Username:', admin.username);
        console.log('  Name:', admin.name);
        console.log('  Role:', admin.role);
        console.log('  ID:', admin.id);
    } catch (error) {
        console.error('✗ Error creating admin:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();
