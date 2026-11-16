import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { formatRiskForViewer } from '@/lib/caliber-sanitizer';

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

        await prisma.$transaction([
            prisma.reviewRisk.deleteMany({
                where: { reviewId: id }
            }),
            prisma.reviewRecord.delete({
                where: { id: id }
            }),
        ]);

        // 同步清理磁盘上的原始上传文档（若不存在则静默忽略）
        const safeId = path.basename(id);
        const uploadPath = path.join(process.cwd(), 'data', 'uploads', `${safeId}.docx`);
        await unlink(uploadPath).catch((err: NodeJS.ErrnoException) => {
            if (err.code !== 'ENOENT') {
                console.warn('[Reviews] Failed to remove uploaded file:', uploadPath, err.message);
            }
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

        const isAdmin = currentUser.role === 'admin';

        const responseData = {
            id: review.id,
            fileName: review.fileName,
            text: review.originalText || "",
            html: review.originalHtml || "",
            viewerRole: currentUser.role,
            gatekeeper: {
                category: (review.summary && review.summary.includes('文件类型：')) ? review.summary.split('。')[0].replace('文件类型：', '') : '未知',
                reason: review.summary || '无摘要',
                needs_review: review.status !== 'ignored'
            },
            risks: review.risks.map((r: any) =>
                formatRiskForViewer(
                    {
                        id: r.id.toString(),
                        level: r.level,
                        title: r.title,
                        description: r.description,
                        location: r.location,
                        suggestion: r.suggestion,
                        law: r.law,
                        relatedCase: r.relatedCase,
                        defense: r.defense ?? null,
                        rulingReason: r.rulingReason ?? null,
                        confidence: r.confidence ?? null,
                    },
                    isAdmin
                )
            )
        };

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Failed to fetch review detail:', error);
        return NextResponse.json({ error: 'Failed to fetch review detail' }, { status: 500 });
    }
}
