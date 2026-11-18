import { prisma } from '@/lib/prisma';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedPrompt: string | null = null;
let cacheExpiresAt = 0;

function sanitizeSnippet(raw: string | null | undefined, maxLen: number): string {
    if (typeof raw !== 'string') return '';
    const cleaned = raw
        .replace(/<!--INTERNAL_CALIBER:[\s\S]*?-->/g, '')
        .replace(/[\[【]\s*(?:总局答疑|内部口径)\s*\d*\s*[\]】]/g, '')
        .replace(/(?:集中答疑口径|总局答疑口径|总局答疑|内部答疑口径|内部业务口径|答疑口径)/g, '实务标准')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned) return '';
    return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}...` : cleaned;
}

/**
 * 清除历史误报反馈缓存（管理员审核反馈后调用，立即生效）。
 */
export function invalidateFeedbackLearningCache(): void {
    cachedPrompt = null;
    cacheExpiresAt = 0;
}

/**
 * 查询管理员已核准确认（adminStatus = 'approved' 且 isAccurate = false）的历史误报案例，
 * 转化为合规豁免反例提示词，带 5 分钟内存缓存。
 */
export async function getApprovedFalsePositivePrompt(): Promise<string> {
    const now = Date.now();
    if (cachedPrompt !== null && now < cacheExpiresAt) {
        return cachedPrompt;
    }

    try {
        if (typeof prisma?.riskFeedback?.findMany !== 'function') {
            return '';
        }

        const records = await prisma.riskFeedback.findMany({
            where: { isAccurate: false, adminStatus: 'approved' },
            include: { risk: { select: { title: true, location: true, description: true } } },
            orderBy: { adminReviewedAt: 'desc' },
            take: 8,
        });

        if (!Array.isArray(records) || records.length === 0) {
            cachedPrompt = '';
            cacheExpiresAt = now + CACHE_TTL_MS;
            return '';
        }

        const lines: string[] = [];
        for (const item of records) {
            const clauseRaw = item?.risk?.location || item?.risk?.title || item?.risk?.description;
            const clause = sanitizeSnippet(clauseRaw, 100);
            if (!clause) continue;
            const comment = sanitizeSnippet(item?.adminComment, 120);
            const reasonPart = comment ? `（复核结论：${comment}）` : '（复核结论：合法合规条款，不构成违规）';
            lines.push(`${lines.length + 1}. 原条款摘要：“${clause}”${reasonPart}`);
        }

        if (lines.length === 0) {
            cachedPrompt = '';
            cacheExpiresAt = now + CACHE_TTL_MS;
            return '';
        }

        const formatted = [
            '【本系统历史人工复核确认的合规豁免反例（遇到本质相同的合法条款请勿误报）】：',
            ...lines,
        ].join('\n');

        cachedPrompt = formatted;
        cacheExpiresAt = now + CACHE_TTL_MS;
        return formatted;
    } catch (error) {
        console.warn('[FeedbackLearning] Failed to query approved false positives:', error);
        return '';
    }
}
