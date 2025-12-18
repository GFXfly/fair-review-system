
import { prisma } from '@/lib/prisma';
import { getEmbedding } from './llm';

// Simple in-memory cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function generateEmbedding(text: string): Promise<number[]> {
    if (!text) return [];
    return await getEmbedding(text);
}

// ✅ 定义返回类型（包含相似度）
export interface CaseWithSimilarity {
    id: number;
    title: string;
    content: string;
    violationType: string;
    result: string | null;
    violationDetail?: string | null;
    similarity: number;
}

export async function searchSimilarCases(
    query: string,
    limit: number = 3,
    threshold: number = 0.0  // ✅ 新增阈值参数
): Promise<CaseWithSimilarity[]> {
    const queryEmbedding = await generateEmbedding(query);

    // Fallback to keyword search if embedding fails
    if (queryEmbedding.length === 0) {
        console.warn('Embedding failed, falling back to keyword search.');
        const results = await prisma.case.findMany({
            where: {
                OR: [
                    { title: { contains: query } },
                    { content: { contains: query } },
                    { violationType: { contains: query } }
                ]
            },
            take: limit
        });
        return results.map(r => ({ ...r, similarity: 0 }));
    }

    // Fetch all cases with embeddings
    // Optimization: In a production app with millions of rows, use pgvector.
    // For < 10,000 items, fetching only ID + Embedding is acceptable.
    const allCases = await prisma.case.findMany({
        where: {
            embedding: {
                not: null
            }
        },
        select: {
            id: true,
            title: true,
            content: true,
            violationType: true,
            result: true,
            violationDetail: true,  // ✅ 包含违规要点
            embedding: true
        }
    });

    const scored = allCases.map(c => {
        let similarity = 0;
        try {
            const embedding = JSON.parse(c.embedding!);
            if (Array.isArray(embedding)) {
                similarity = cosineSimilarity(queryEmbedding, embedding);
            }
        } catch (e) {
            console.error(`Error parsing embedding for case ${c.id}`);
        }
        return { ...c, similarity };
    });

    // Sort descending
    scored.sort((a, b) => b.similarity - a.similarity);

    // ✅ 应用阈值过滤和数量限制
    const filtered = scored
        .filter(c => c.similarity >= threshold)
        .slice(0, limit);

    // ✅ 保留similarity，但移除embedding
    return filtered.map(({ embedding, ...rest }) => rest);
}

// ✅ 定义返回类型（包含相似度）
export interface RegulationWithSimilarity {
    id: number;
    title: string;
    content: string;
    similarity: number;
}

export async function searchSimilarRegulations(
    query: string,
    limit: number = 2,
    threshold: number = 0.0  // ✅ 新增阈值参数
): Promise<RegulationWithSimilarity[]> {
    const queryEmbedding = await generateEmbedding(query);

    if (queryEmbedding.length === 0) {
        const results = await prisma.regulation.findMany({
            where: {
                OR: [
                    { title: { contains: query } },
                    { content: { contains: query } }
                ]
            },
            take: limit
        });
        return results.map(r => ({ ...r, similarity: 0 }));
    }

    const allRegs = await prisma.regulation.findMany({
        where: {
            embedding: {
                not: null
            }
        },
        select: {
            id: true,
            title: true,
            content: true,
            embedding: true
        }
    });

    const scored = allRegs.map(r => {
        let similarity = 0;
        try {
            const embedding = JSON.parse(r.embedding!);
            if (Array.isArray(embedding)) {
                similarity = cosineSimilarity(queryEmbedding, embedding);
            }
        } catch (e) {
            console.error(`Error parsing embedding for regulation ${r.id}`);
        }
        return { ...r, similarity };
    });

    scored.sort((a, b) => b.similarity - a.similarity);

    // ✅ 应用阈值过滤和数量限制
    const filtered = scored
        .filter(r => r.similarity >= threshold)
        .slice(0, limit);

    // ✅ 保留similarity，但移除embedding
    return filtered.map(({ embedding, ...rest }) => rest);
}
