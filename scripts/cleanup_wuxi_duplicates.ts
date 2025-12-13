
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning up old, incorrectly named Wuxi cases...');

    // These are the old titles we want to remove
    const oldTitles = [
        '某部门违规给予特定经营者税收优惠',
        '某市某县人民政府对企业设置不合理退出条件',
        '某县级市人民政府区别对待本地与外地企业',
        '某县级市人民政府违法对“种子库”企业给予优惠政策'
    ];

    const deleted = await prisma.case.deleteMany({
        where: {
            title: {
                in: oldTitles
            }
        }
    });

    console.log(`Deleted ${deleted.count} old cases.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
