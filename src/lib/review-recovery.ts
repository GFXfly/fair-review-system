import { prisma } from '@/lib/prisma';

export const STALE_PROCESSING_MS = 15 * 60 * 1000;

/**
 * Mark review records stuck in 'processing' past STALE_PROCESSING_MS as failed.
 */
export async function recoverStaleReviews(recordId?: string): Promise<number> {
    try {
        const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);
        const result = await prisma.reviewRecord.updateMany({
            where: {
                status: 'processing',
                updatedAt: { lt: cutoff },
                ...(recordId ? { id: recordId } : {}),
            },
            data: {
                status: 'failed',
                progress: 0,
                progressMessage: '审查任务超时或服务重启中断，请重新上传审查',
            },
        });
        return result.count;
    } catch (error) {
        console.warn('[ReviewRecovery] 回收超时审查任务失败:', error);
        return 0;
    }
}
