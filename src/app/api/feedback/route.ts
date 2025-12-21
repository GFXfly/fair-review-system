import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requireAuth } from '@/lib/auth';

// POST /api/feedback - 提交反馈
export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth(req);
        const body = await req.json();

        const { reviewId, riskId, isAccurate } = body;

        console.log('[Feedback API] 收到反馈请求:', { reviewId, riskId, isAccurate });

        // 验证必填字段
        if (!reviewId || riskId === undefined || riskId === null || typeof isAccurate !== 'boolean') {
            console.log('[Feedback API] 缺少必填字段');
            return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
        }

        // 确保 riskId 是数字
        const numericRiskId = typeof riskId === 'number' ? riskId : parseInt(String(riskId), 10);
        if (isNaN(numericRiskId)) {
            console.log('[Feedback API] riskId不是有效数字:', riskId);
            return NextResponse.json({ error: '风险点ID格式错误' }, { status: 400 });
        }

        console.log('[Feedback API] 查询风险点:', { numericRiskId, reviewId });

        // 验证risk是否存在且属于该review
        const risk = await prisma.reviewRisk.findFirst({
            where: {
                id: numericRiskId,
                reviewId: reviewId
            }
        });

        console.log('[Feedback API] 查询结果:', risk ? '找到' : '未找到');

        if (!risk) {
            return NextResponse.json({ error: '风险点不存在' }, { status: 404 });
        }

        // 检查是否已经反馈过
        const existing = await prisma.riskFeedback.findFirst({
            where: {
                reviewId,
                riskId,
                userId: user.id
            }
        });

        if (existing) {
            return NextResponse.json({ error: '您已经对此风险点提交过反馈' }, { status: 400 });
        }

        // 创建反馈
        const feedback = await prisma.riskFeedback.create({
            data: {
                reviewId,
                riskId,
                userId: user.id,
                isAccurate
            }
        });

        return NextResponse.json({
            success: true,
            feedback
        });

    } catch (error) {
        console.error('Submit feedback error:', error);
        return NextResponse.json({ error: '提交反馈失败' }, { status: 500 });
    }
}

// GET /api/feedback - 获取反馈列表（管理员用）
export async function GET(req: NextRequest) {
    try {
        const user = await requireAuth(req);

        // 只有管理员可以查看反馈列表
        if (user.role !== 'admin') {
            return NextResponse.json({ error: '权限不足' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status'); // pending, approved, rejected
        const onlyNeedReview = searchParams.get('onlyNeedReview') === 'true'; // 只看需要审核的

        let whereClause: any = {};

        // 只获取"不准确"且待审核的反馈
        if (onlyNeedReview) {
            whereClause = {
                isAccurate: false,
                adminStatus: 'pending'
            };
        } else if (status) {
            whereClause.adminStatus = status;
        }

        const feedbacks = await prisma.riskFeedback.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        username: true,
                        name: true,
                        department: true
                    }
                },
                review: {
                    select: {
                        fileName: true,
                        summary: true
                    }
                },
                risk: true,
                adminUser: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 50
        });

        return NextResponse.json(feedbacks);

    } catch (error) {
        console.error('Get feedbacks error:', error);
        return NextResponse.json({ error: '获取反馈列表失败' }, { status: 500 });
    }
}
