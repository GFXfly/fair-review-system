/**
 * 迁移脚本：将数据库中的明文密码哈希化
 *
 * 使用方法：
 * npx ts-node scripts/migrate-passwords.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function migratePasswords() {
    console.log('开始迁移密码...\n');

    try {
        // 获取所有用户
        const users = await prisma.user.findMany();

        console.log(`找到 ${users.length} 个用户`);

        let migratedCount = 0;
        let skippedCount = 0;

        for (const user of users) {
            // 检查密码是否已经是 bcrypt 哈希
            // bcrypt 哈希总是以 $2a$, $2b$, $2y$ 开头
            const isAlreadyHashed = /^\$2[ayb]\$/.test(user.password);

            if (isAlreadyHashed) {
                console.log(`✓ 用户 "${user.username}" 的密码已经是哈希，跳过`);
                skippedCount++;
                continue;
            }

            // 哈希明文密码
            const hashedPassword = await bcrypt.hash(user.password, 10);

            // 更新数据库
            await prisma.user.update({
                where: { id: user.id },
                data: { password: hashedPassword }
            });

            console.log(`✓ 已迁移用户 "${user.username}" 的密码`);
            migratedCount++;
        }

        console.log('\n迁移完成！');
        console.log(`- 成功迁移: ${migratedCount} 个`);
        console.log(`- 已跳过: ${skippedCount} 个`);

    } catch (error) {
        console.error('迁移失败:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

migratePasswords();
