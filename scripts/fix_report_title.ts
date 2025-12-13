
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Update Report 5 to the correct details corresponding to the cases we just added
    await prisma.report.update({
        where: { id: 5 },
        data: {
            title: '关于违背市场准入负面清单典型案例的通报(第五批)',
            department: '国家发展和改革委员会',
            publishDate: '2023-03-16',
            province: '全国'
        }
    });
    console.log('Updated Report 5 title and metadata.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
