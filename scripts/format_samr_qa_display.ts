
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targetTitle = '基层公平竞争审查实践问题集中答疑口径（第二批）';
    // Find the consolidated regulation
    const regulation = await prisma.regulation.findFirst({
        where: {
            title: targetTitle,
            category: { not: 'QA_Fragment' } // Ensure we get the full doc, not a fragment
        }
    });

    if (!regulation) {
        console.error('Regulation not found');
        return;
    }

    let content = regulation.content;

    // Normalize newlines and split
    // Filter out empty lines to rebuild them correctly
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

    let formattedContent = '';

    // Regex for Question start: e.g. "1.", "10.", "3. "
    const questionRegex = /^(\d+)[.、\s]/;

    // Regex for Roman/Chinese Headers: e.g. "一、"
    const headerRegex = /^[一二三四五]、/;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // 1. Add indentation to EVERY paragraph (2 full-width spaces)
        // Check if already indented (just in case multiple runs)
        if (!line.startsWith('\u3000\u3000')) {
            line = '\u3000\u3000' + line;
        }

        // 2. Add spacing logic
        if (i === 0) {
            formattedContent += line;
        } else {
            const isQuestion = questionRegex.test(lines[i]); // Check ORIGINAL content for regex to avoid confusion with added spaces
            const isHeader = headerRegex.test(lines[i]);

            if (isQuestion || isHeader) {
                // "每一条之间空一行" -> Insert an empty line before this new item
                formattedContent += '\n\n' + line;
            } else {
                // Just a normal new line (continuation or next paragraph of same answer)
                formattedContent += '\n' + line;
            }
        }
    }

    // Update
    await prisma.regulation.update({
        where: { id: regulation.id },
        data: { content: formattedContent }
    });

    console.log('Formatted content successfully with indentation and spacing.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
