import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { invalidateFeedbackLearningCache } from '@/lib/feedback-learning';

// PATCH /api/feedback/[id] - 管理员审核反馈
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAdmin(req);

        const { id } = await params;
        if (!/^\d+$/.test(id)) {
            return NextResponse.json({ error: '无效的反馈ID' }, { status: 400 });
        }
        const feedbackId = parseInt(id, 10);
        const body = await req.json();
        const { adminStatus, adminComment } = body;

        // 验证状态值
        if (!['approved', 'rejected'].includes(adminStatus)) {
            return NextResponse.json({ error: '无效的审核状态' }, { status: 400 });
        }

        // 更新反馈
        const feedback = await prisma.riskFeedback.update({
            where: { id: feedbackId },
            data: {
                adminStatus,
                adminComment: adminComment || null,
                adminUserId: user.id,
                adminReviewedAt: new Date()
            },
            include: {
                risk: true,
                user: {
                    select: {
                        name: true
                    }
                }
            }
        });

        invalidateFeedbackLearningCache();

        return NextResponse.json({
            success: true,
            feedback
        });

    } catch (error) {
        console.error('Review feedback error:', error);
        return handleAuthError(error);
    }
}
