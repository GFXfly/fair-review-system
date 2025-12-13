
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const reports = await prisma.report.findMany({
        where: {
            OR: [
                { title: { contains: '山东' } },
                { department: { contains: '山东' } },
                { province: { contains: '山东' } }
            ]
        },
        include: {
            cases: {
                orderBy: { id: 'asc' }
            }
        }
    });

    for (const report of reports) {
        console.log(`\n=== 通报: ${report.title} (ID: ${report.id}) ===`);
        for (const c of report.cases) {
            console.log(`\n[ID: ${c.id}] 标题: ${c.title}`);
            console.log(`内容开头: ${c.content.substring(0, 100)}...`);
            console.log(`内容长度: ${c.content.length}`);
        }
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
