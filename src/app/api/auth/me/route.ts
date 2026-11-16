import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, handleAuthError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Get current authenticated user info
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);

        if (!user) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        if (user.role === 'admin') {
            const pendingUserCount = await prisma.user.count({
                where: { status: 'pending' },
            });
            return NextResponse.json({ ...user, pendingUserCount });
        }

        return NextResponse.json(user);

    } catch (error) {
        return handleAuthError(error);
    }
}
