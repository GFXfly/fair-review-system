import { prisma } from '@/lib/prisma';
import { getEmbedding } from './llm';

// ==========================================
// In-memory embedding cache
// ==========================================
// Motivation: every similarity search previously executed
//   prisma.<model>.findMany({ select: { embedding: true, ... } })
// then JSON.parse(row.embedding) per row. With ~8 risk keywords ×
// (1 original + 2 rewrites) × 3 iterations = 72 fan-out reads per review,
// that's 72 full scans + 72 × N parses. Caching parsed Float32Array
// embeddings in memory reduces this to ~one scan and zero re-parses.

const CACHE_TTL_MS = parseInt(process.env.EMBEDDING_CACHE_TTL_MS || '600000'); // 10 min

interface CachedCase {
    id: number;
    title: string;
    content: string;
    violationType: string;
    result: string | null;
    violationDetail: string | null;
    embedding: Float32Array;
    embeddingNorm: number;
}

interface CachedRegulation {
    id: number;
    title: string;
    content: string;
    embedding: Float32Array;
    embeddingNorm: number;
}

let caseCache: { data: CachedCase[]; loadedAt: number } | null = null;
let regCache: { data: CachedRegulation[]; loadedAt: number } | null = null;
let caseLoadPromise: Promise<CachedCase[]> | null = null;
let regLoadPromise: Promise<CachedRegulation[]> | null = null;

function computeNorm(vec: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
    return Math.sqrt(sum);
}

async function loadCaseCache(): Promise<CachedCase[]> {
    const rows = await prisma.case.findMany({
        where: { embedding: { not: null } },
        select: {
            id: true,
            title: true,
            content: true,
            violationType: true,
            result: true,
            violationDetail: true,
            embedding: true,
        },
    });

    const parsed: CachedCase[] = [];
    for (const r of rows) {
        try {
            const arr = JSON.parse(r.embedding!);
            if (Array.isArray(arr) && arr.length > 0) {
                const emb = Float32Array.from(arr);
                parsed.push({
                    id: r.id,
                    title: r.title,
                    content: r.content,
                    violationType: r.violationType,
                    result: r.result,
                    violationDetail: r.violationDetail,
                    embedding: emb,
                    embeddingNorm: computeNorm(emb),
                });
            }
        } catch {
            // Skip unparseable rows — already warned by the ingestion pipeline.
        }
    }
    console.log(`[RAG] Cached ${parsed.length} case embeddings in memory`);
    return parsed;
}

async function loadRegCache(): Promise<CachedRegulation[]> {
    const rows = await prisma.regulation.findMany({
        where: { embedding: { not: null } },
        select: {
            id: true,
            title: true,
            content: true,
            embedding: true,
        },
    });

    const parsed: CachedRegulation[] = [];
    for (const r of rows) {
        try {
            const arr = JSON.parse(r.embedding!);
            if (Array.isArray(arr) && arr.length > 0) {
                const emb = Float32Array.from(arr);
                parsed.push({
                    id: r.id,
                    title: r.title,
                    content: r.content,
                    embedding: emb,
                    embeddingNorm: computeNorm(emb),
                });
            }
        } catch {}
    }
    console.log(`[RAG] Cached ${parsed.length} regulation embeddings in memory`);
    return parsed;
}

async function getCaseCache(): Promise<CachedCase[]> {
    const now = Date.now();
    if (caseCache && now - caseCache.loadedAt < CACHE_TTL_MS) return caseCache.data;
    if (caseLoadPromise) return caseLoadPromise;
    caseLoadPromise = loadCaseCache().then(data => {
        caseCache = { data, loadedAt: Date.now() };
        caseLoadPromise = null;
        return data;
    }).catch(err => {
        caseLoadPromise = null;
        throw err;
    });
    return caseLoadPromise;
}

async function getRegCache(): Promise<CachedRegulation[]> {
    const now = Date.now();
    if (regCache && now - regCache.loadedAt < CACHE_TTL_MS) return regCache.data;
    if (regLoadPromise) return regLoadPromise;
    regLoadPromise = loadRegCache().then(data => {
        regCache = { data, loadedAt: Date.now() };
        regLoadPromise = null;
        return data;
    }).catch(err => {
        regLoadPromise = null;
        throw err;
    });
    return regLoadPromise;
}

/**
 * Invalidate caches — call after bulk ingestion of cases/regulations.
 */
export function invalidateEmbeddingCache(target: 'case' | 'regulation' | 'all' = 'all') {
    if (target === 'case' || target === 'all') caseCache = null;
    if (target === 'regulation' || target === 'all') regCache = null;
}

// ==========================================
// Short-lived query-embedding cache
// ==========================================
// iterativeSearch() re-calls searchSimilarCases(query, ...) up to 3 times
// with different thresholds. Without this cache, each call re-embeds the
// same query via the external API.
const QUERY_EMBED_TTL_MS = 120_000;
const QUERY_EMBED_MAX_ENTRIES = 256;
const queryEmbedCache = new Map<string, { emb: Float32Array; norm: number; expiresAt: number }>();

async function getCachedQueryEmbedding(
    query: string
): Promise<{ emb: Float32Array; norm: number } | null> {
    const now = Date.now();
    const existing = queryEmbedCache.get(query);
    if (existing && existing.expiresAt > now) {
        return { emb: existing.emb, norm: existing.norm };
    }

    const raw = await generateEmbedding(query);
    if (raw.length === 0) return null;

    const emb = Float32Array.from(raw);
    const norm = computeNorm(emb);
    queryEmbedCache.set(query, { emb, norm, expiresAt: now + QUERY_EMBED_TTL_MS });

    if (queryEmbedCache.size > QUERY_EMBED_MAX_ENTRIES) {
        const oldest = queryEmbedCache.keys().next().value;
        if (oldest !== undefined) queryEmbedCache.delete(oldest);
    }
    return { emb, norm };
}

// ==========================================
// Cosine similarity with precomputed norms
// ==========================================
function cosineSimilarityFast(
    query: Float32Array,
    queryNorm: number,
    target: Float32Array,
    targetNorm: number
): number {
    if (queryNorm === 0 || targetNorm === 0) return 0;
    const len = Math.min(query.length, target.length);
    let dot = 0;
    for (let i = 0; i < len; i++) dot += query[i] * target[i];
    return dot / (queryNorm * targetNorm);
}

/**
 * Generates a 1024-dimensional embedding for the given text.
 * In Intranet mode, this can use a local model via transformers.js.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    if (!text) return [];

    if (process.env.EMBEDDING_SOURCE === 'local-transformers') {
        try {
            const { pipeline, env } = await import('@xenova/transformers');
            const path = await import('path');

            env.localModelPath = path.join(process.cwd(), 'models');
            env.allowRemoteModels = false;

            if (!(global as any).embeddingPipeline) {
                console.log('--- [Offline Mode] Loading local BGE-M3 model from ./models... ---');
                (global as any).embeddingPipeline = await pipeline('feature-extraction', 'Xenova/bge-m3', {
                    quantized: true,
                });
            }

            const extractor = (global as any).embeddingPipeline;
            const output = await extractor(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data) as number[];
        } catch (error: any) {
            console.error('[RAG] Local Embedding Error:', error.message);
            return [];
        }
    }

    return await getEmbedding(text);
}

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
    threshold: number = 0.0
): Promise<CaseWithSimilarity[]> {
    const qEmbed = await getCachedQueryEmbedding(query);

    if (!qEmbed) {
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

    const cache = await getCaseCache();
    const scored: CaseWithSimilarity[] = [];
    for (const c of cache) {
        const similarity = cosineSimilarityFast(qEmbed.emb, qEmbed.norm, c.embedding, c.embeddingNorm);
        if (similarity >= threshold) {
            scored.push({
                id: c.id,
                title: c.title,
                content: c.content,
                violationType: c.violationType,
                result: c.result,
                violationDetail: c.violationDetail,
                similarity,
            });
        }
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
}

export interface RegulationWithSimilarity {
    id: number;
    title: string;
    content: string;
    similarity: number;
}

export async function searchSimilarRegulations(
    query: string,
    limit: number = 2,
    threshold: number = 0.0
): Promise<RegulationWithSimilarity[]> {
    const qEmbed = await getCachedQueryEmbedding(query);

    if (!qEmbed) {
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

    const cache = await getRegCache();
    const scored: RegulationWithSimilarity[] = [];
    for (const r of cache) {
        const similarity = cosineSimilarityFast(qEmbed.emb, qEmbed.norm, r.embedding, r.embeddingNorm);
        if (similarity >= threshold) {
            scored.push({
                id: r.id,
                title: r.title,
                content: r.content,
                similarity,
            });
        }
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
}
