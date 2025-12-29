import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!id) {
            return NextResponse.json({ error: 'Review ID is required' }, { status: 400 });
        }

        // Check if review exists and permission
        const review = await prisma.reviewRecord.findUnique({
            where: { id: id }
        });

        if (!review) {
            return NextResponse.json({ error: 'Review record not found' }, { status: 404 });
        }

        // Only admin or owner can delete
        if (user.role !== 'admin' && review.userId !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Delete risks first (if not cascading) - strictly speaking prisma handles cascade if configured,
        // but explicit delete is safer if schema is unknown.
        // Assuming cascade delete is set up on foreign key or we just delete the record if relation is mandatory.
        // Let's try deleting the record directly.
        await prisma.reviewRisk.deleteMany({
            where: { reviewId: id }
        });

        await prisma.reviewRecord.delete({
            where: { id: id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete review:', error);
        return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
    }
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> } // Fix for Next.js 15+ dynamic params
) {
    // Await params first
    const { id } = await context.params;

    try {
        if (!id) {
            return NextResponse.json({ error: 'Review ID is required' }, { status: 400 });
        }

        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const review = await prisma.reviewRecord.findUnique({
            where: {
                id: id
            },
            include: {
                risks: true
            }
        });

        if (!review) {
            return NextResponse.json({ error: 'Review record not found' }, { status: 404 });
        }

        // 归属校验：非管理员只能看自己的记录
        if (currentUser.role !== 'admin' && review.userId !== currentUser.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Transform data to match the format used in review page
        // We need to reconstruct the "Gatekeeper" and "Auditor" structure
        // Since we don't store full text in DB currently, we might need to handle that.
        // However, the user just wants to see the risks.


        // @ts-ignore
        const responseData = {
            id: review.id,
            fileName: review.fileName,
            text: review.originalText || "",  // Return stored original text
            html: review.originalHtml || "",  // Return stored original HTML for table rendering
            gatekeeper: {
                category: (review.summary && review.summary.includes('文件类型：')) ? review.summary.split('。')[0].replace('文件类型：', '') : '未知',
                reason: review.summary || '无摘要',
                needs_review: review.status !== 'ignored'
            },
            risks: review.risks.map((r: any) => ({
                id: r.id.toString(),
                level: r.level,
                title: r.title,
                description: r.description,
                location: r.location,
                suggestion: r.suggestion,
                law: r.law,
                relatedCase: r.relatedCase
            }))
        };

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Failed to fetch review detail:', error);
        return NextResponse.json({ error: 'Failed to fetch review detail' }, { status: 500 });
    }
}
