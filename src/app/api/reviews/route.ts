import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

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
            // Check if user is actually admin
            if (user.role !== 'admin') {
                console.log('[API_REVIEWS] Admin access denied: Not admin');
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            console.log(`[API_REVIEWS] Admin access granted for ${user.username}`);
            // Admin sees all
            whereClause = {};
        } else {
            // Normal user: sees only their own
            whereClause = { userId: user.id };
        }

        const isExport = searchParams.get('export') === 'true';

        const reviews = await prisma.reviewRecord.findMany({
            take: isExport ? undefined : 50, // No limit for export, otherwise 50
            where: whereClause,
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                risks: true,
                user: {
                    select: {
                        name: true,
                        department: true
                    }
                }
            }
        });

        console.log(`[API_REVIEWS] Returning ${reviews.length} reviews. Where: ${JSON.stringify(whereClause)}`);

        return NextResponse.json(reviews);
    } catch (error) {
        console.error('Failed to fetch review records:', error);
        return NextResponse.json({ error: 'Failed to fetch review records' }, { status: 500 });
    }
}

