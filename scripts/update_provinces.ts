import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 案例1：某市财政局 → 江西省某市
    await prisma.case.update({
        where: { id: 6 },
        data: { province: '江西省某市' }
    });

    // 案例2：某区人民政府办公室 → 江西省某市某区
    await prisma.case.update({
        where: { id: 7 },
        data: { province: '江西省某市某区' }
    });

    // 案例3：某区人民政府办公室 → 江西省某市某区
    await prisma.case.update({
        where: { id: 8 },
        data: { province: '江西省某市某区' }
    });

    // 案例4：某县人民政府办公室 → 江西省某县
    await prisma.case.update({
        where: { id: 9 },
        data: { province: '江西省某县' }
    });

    // 案例5：某县人民政府办公室 → 江西省某县
    await prisma.case.update({
        where: { id: 10 },
        data: { province: '江西省某县' }
    });

    // 案例6：某县人民政府办公室 → 江西省某县
    await prisma.case.update({
        where: { id: 11 },
        data: { province: '江西省某县' }
    });

    // 案例7：某区人民政府办公室 → 江西省某市某区
    await prisma.case.update({
        where: { id: 12 },
        data: { province: '江西省某市某区' }
    });

    // 案例8：某市科学技术局 → 江西省某市
    await prisma.case.update({
        where: { id: 13 },
        data: { province: '江西省某市' }
    });

    // 案例9：某区人民政府办公室 → 江西省某市某区
    await prisma.case.update({
        where: { id: 14 },
        data: { province: '江西省某市某区' }
    });

    // 案例10：某县人民政府办公室 → 江西省某县
    await prisma.case.update({
        where: { id: 15 },
        data: { province: '江西省某县' }
    });

    console.log('✅ 已更新所有案例的地区信息（市/区/县）');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
