
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Finding cases to delete...');

    const titlesToFind = [
        '哈尔滨市交通运输局滥用行政权力排除、限制竞争行为',
        '五省区（辽宁、黑龙江、广东、广西、新疆）在2018年公平竞争审查重点督查中发现30份违规文件'
    ];

    const cases = await prisma.case.findMany({
        where: {
            title: {
                in: titlesToFind
            }
        }
    });

    console.log(`Found ${cases.length} cases.`);
    cases.forEach(c => console.log(`ID: ${c.id} | Title: ${c.title}`));

    if (cases.length > 0) {
        console.log('Deleting these cases...');
        const result = await prisma.case.deleteMany({
            where: {
                id: {
                    in: cases.map(c => c.id)
                }
            }
        });
        console.log(`Deleted ${result.count} cases.`);
    }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
