import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/reviews/[id]/status
 * 查询审查任务的进度状态（用于前端轮询）
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Require authentication
        const user = await requireAuth(req);
        const { id } = await params;

        const review = await prisma.reviewRecord.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                progress: true,
                progressMessage: true,
                riskCount: true,
                fileName: true,
                userId: true
            }
        });

        if (!review) {
            return NextResponse.json(
                { error: '审查记录不存在' },
                { status: 404 }
            );
        }

        // Check access permission (admin can see all, user can only see their own)
        if (user.role !== 'admin' && review.userId !== user.id) {
            return NextResponse.json(
                { error: '无权查看此记录' },
                { status: 403 }
            );
        }

        return NextResponse.json({
            id: review.id,
            status: review.status,
            progress: review.progress,
            progressMessage: review.progressMessage,
            riskCount: review.riskCount,
            fileName: review.fileName
        });

    } catch (error: any) {
        console.error('Error fetching review status:', error);
        return NextResponse.json(
            { error: error.message || '获取状态失败' },
            { status: 500 }
        );
    }
}
