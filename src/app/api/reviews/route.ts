import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userIdStr = cookieStore.get('userId')?.value;
        const userId = userIdStr ? parseInt(userIdStr) : null;

        const { searchParams } = new URL(req.url);
        const mode = searchParams.get('mode');

        console.log(`[API_REVIEWS] GET request. UserId: ${userId}, Mode: ${mode}`);

        let whereClause: any = {};

        if (mode === 'admin') {
            // Check if user is actually admin
            if (!userId) {
                console.log('[API_REVIEWS] Admin access denied: No userId');
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const user = await prisma.user.findUnique({ where: { id: userId } });
            console.log(`[API_REVIEWS] Admin check. User found: ${user?.username}, Role: ${user?.role}`);

            if (!user || user.role !== 'admin') {
                console.log('[API_REVIEWS] Admin access denied: Not admin');
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            // Admin sees all
            whereClause = {};
        } else {
            // Normal user: sees only their own
            if (!userId) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            whereClause = { userId: userId };
        }

        const reviews = await prisma.reviewRecord.findMany({
            take: 50, // Increased limit for admin visibility
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

