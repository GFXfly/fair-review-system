import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

        // Transform data to match the format used in review page
        // We need to reconstruct the "Gatekeeper" and "Auditor" structure
        // Since we don't store full text in DB currently, we might need to handle that.
        // However, the user just wants to see the risks.

        const responseData = {
            id: review.id,
            fileName: review.fileName, // Add file name
            text: "",
            gatekeeper: {
                category: (review.summary && review.summary.includes('文件类型：')) ? review.summary.split('。')[0].replace('文件类型：', '') : '未知',
                reason: review.summary || '无摘要',
                needs_review: review.status !== 'ignored'
            },
            auditor: (review as any).risks.map((r: any) => ({
                id: r.id.toString(),
                risk_level: r.level as 'High' | 'Medium' | 'Low',
                description: r.description,
                location: r.location,
                suggestion: r.suggestion,
                violated_law: null // DB doesn't have this yet, maybe extracted from description later?
            }))
        };

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Failed to fetch review detail:', error);
        return NextResponse.json({ error: 'Failed to fetch review detail' }, { status: 500 });
    }
}
