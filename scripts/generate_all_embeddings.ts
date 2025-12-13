import dotenv from 'dotenv';
dotenv.config({ override: true });

import { PrismaClient } from '@prisma/client';
import { generateEmbedding } from '../src/lib/rag';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting embedding generation...');

    // 1. Process Cases
    const cases = await prisma.case.findMany({
        where: {
            embedding: null
        }
    });

    console.log(`Found ${cases.length} cases without embeddings.`);

    for (const c of cases) {
        // Combine title and content for a rich representation
        const textToEmbed = `标题: ${c.title}\n违规类型: ${c.violationType}\n内容: ${c.content}`;

        console.log(`Generating embedding for Case ID: ${c.id}...`);
        try {
            const embedding = await generateEmbedding(textToEmbed);
            if (embedding.length > 0) {
                await prisma.case.update({
                    where: { id: c.id },
                    data: {
                        embedding: JSON.stringify(embedding)
                    }
                });
                console.log(`  -> Saved embedding for Case ID: ${c.id}`);
            } else {
                console.warn(`  -> Failed to generate embedding for Case ID: ${c.id}`);
            }
        } catch (e) {
            console.error(`  -> Error processing Case ID: ${c.id}`, e);
        }

        // Brief pause to be nice to the API
        await new Promise(r => setTimeout(r, 200));
    }

    // 2. Process Regulations
    const regs = await prisma.regulation.findMany({
        where: {
            embedding: null
        }
    });

    console.log(`Found ${regs.length} regulations without embeddings.`);

    for (const r of regs) {
        // Truncate content if too long for embedding model (usually 8k tokens approx, be safe with 20k chars)
        const contentSample = r.content.length > 8000 ? r.content.substring(0, 8000) : r.content;
        const textToEmbed = `法规名称: ${r.title}\n效力级别: ${r.level}\n内容: ${contentSample}`;

        console.log(`Generating embedding for Regulation ID: ${r.id}...`);
        try {
            const embedding = await generateEmbedding(textToEmbed);
            if (embedding.length > 0) {
                await prisma.regulation.update({
                    where: { id: r.id },
                    data: {
                        embedding: JSON.stringify(embedding)
                    }
                });
                console.log(`  -> Saved embedding for Regulation ID: ${r.id}`);
            } else {
                console.warn(`  -> Failed to generate embedding for Regulation ID: ${r.id}`);
            }
        } catch (e) {
            console.error(`  -> Error processing Regulation ID: ${r.id}`, e);
        }

        await new Promise(r => setTimeout(r, 200));
    }

    console.log('Done!');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
