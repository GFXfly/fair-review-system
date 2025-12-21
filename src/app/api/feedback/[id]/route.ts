import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// PATCH /api/feedback/[id] - 管理员审核反馈
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth(req);

        // 只有管理员可以审核
        if (user.role !== 'admin') {
            return NextResponse.json({ error: '权限不足' }, { status: 403 });
        }

        const { id } = await params;
        const feedbackId = parseInt(id);
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

        return NextResponse.json({
            success: true,
            feedback
        });

    } catch (error) {
        console.error('Review feedback error:', error);
        return NextResponse.json({ error: '审核失败' }, { status: 500 });
    }
}
