
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targetTitle = '基层公平竞争审查实践问题集中答疑口径（第二批）';
    // Find the consolidated regulation
    const regulation = await prisma.regulation.findFirst({
        where: {
            title: targetTitle,
            category: { not: 'QA_Fragment' }
        }
    });

    if (!regulation) {
        console.error('Regulation not found');
        return;
    }

    let content = regulation.content;

    // Fix missing numbers for items 6 and 7
    // Pattern looking for the specific text starts and prepending numbers

    const q6Text = '对“与经营者签订的行政协议”审查时，是否应听取利害关系人关于公平竞争影响的意见？';
    const q7Text = '审查的政策措施依据的上级规范性文件、政策文件等也涉嫌存在违反公平竞争审查标准问题的，应当如何处理？';

    // We need to be careful with replace, as indexOf or simple replace might miss if spacing changed.
    // However, since we just formatted it, checks should be relatively safe if we ignore the leading whitespace we added.

    if (content.includes(q6Text) && !content.includes('6.对“与经营者')) {
        // If content has the text but not the number. 
        // Note: previous step added indentation. So it might look like "\u3000\u3000对“与..."
        // We will replace the text occurrence with "6." prepended.

        // Use a more robust replace that handles potential whitespace before it
        content = content.replace(
            new RegExp(`(\\s*)${escapeRegExp(q6Text)}`),
            `$16. ${q6Text}` // keep leading whitespace, add "6. "
        );
        console.log('Fixed Question 6 numbering.');
    }

    if (content.includes(q7Text) && !content.includes('7.审查的')) {
        content = content.replace(
            new RegExp(`(\\s*)${escapeRegExp(q7Text)}`),
            `$17. ${q7Text}`
        );
        console.log('Fixed Question 7 numbering.');
    }

    // Update
    await prisma.regulation.update({
        where: { id: regulation.id },
        data: { content: content }
    });

    console.log('Numbering fix complete.');
}

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
