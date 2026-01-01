const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    try {
        const sqlContent = fs.readFileSync('insert_users.sql', 'utf8');
        // 移除 BEGIN TRANSACTION 和 COMMIT，只取 INSERT 语句
        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('BEGIN') && !s.startsWith('COMMIT'));

        console.log(`Found ${statements.length} statements to execute.`);

        let successCount = 0;
        for (const sql of statements) {
            try {
                await prisma.$executeRawUnsafe(sql);
                successCount++;
            } catch (err) {
                console.error('Failed to execute statement:', sql.substring(0, 50) + '...', err.message);
            }
        }
        console.log(`✅ successfully executed ${successCount}/${statements.length} statements`);
    } catch (e) {
        console.error('❌ Start Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
