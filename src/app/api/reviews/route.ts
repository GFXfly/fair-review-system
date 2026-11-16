import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { recoverStaleReviews } from '@/lib/review-recovery';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const mode = searchParams.get('mode');

        // Use the unified auth helper to get the current session user
        const user = await getCurrentUser();

        console.log(`[API_REVIEWS] GET request. User: ${user?.username} (${user?.id}), Role: ${user?.role}, Mode: ${mode}`);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let whereClause: any = {};

        if (mode === 'admin') {
            // Explicit admin mode (felixgao 后台)：必须确实是 admin
            if (user.role !== 'admin') {
                console.log('[API_REVIEWS] Admin access denied: Not admin');
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            console.log(`[API_REVIEWS] Admin access granted for ${user.username}`);
            // Admin sees all
            whereClause = {};
        } else {
            // 默认按身份决定范围：管理员看全部、普通用户只看自己的。
            // 这样前端不必先拿到 user.role 才能决定 URL，可与鉴权请求并行，消除首屏串行延迟。
            whereClause = user.role === 'admin' ? {} : { userId: user.id };
        }

        const isExport = searchParams.get('export') === 'true';
        // all=true：返回全部记录（台账页用）；默认仅 20 条（首页"最近审查记录"）。
        const showAll = isExport || searchParams.get('all') === 'true';

        await recoverStaleReviews();

        const reviews = await prisma.reviewRecord.findMany({
            take: showAll ? undefined : 20,
            where: whereClause,
            orderBy: {
                createdAt: 'desc'
            },
            // 列表只返回元数据，排除 originalText/originalHtml 两个全文大字段
            // （20 条记录的全文 JSON 可达数 MB，是首屏列表延迟 1-2 秒的根源）
            select: {
                id: true,
                fileName: true,
                fileSize: true,
                status: true,
                progress: true,
                progressMessage: true,
                riskCount: true,
                summary: true,
                createdAt: true,
                updatedAt: true,
                userId: true,
                _count: {
                    select: { risks: true }
                },
                user: {
                    select: {
                        name: true,
                        department: true
                    }
                }
            }
        });

        // 将_count转换为riskCount字段，保持向后兼容
        const reviewsWithCount = reviews.map(review => ({
            ...review,
            riskCount: review._count.risks,
            _count: undefined // 移除_count字段
        }));

        console.log(`[API_REVIEWS] Returning ${reviewsWithCount.length} reviews. Where: ${JSON.stringify(whereClause)}`);

        return NextResponse.json(reviewsWithCount);
    } catch (error) {
        console.error('Failed to fetch review records:', error);
        return NextResponse.json({ error: 'Failed to fetch review records' }, { status: 500 });
    }
}

