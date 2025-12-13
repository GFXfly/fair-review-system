import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, handleAuthError } from '@/lib/auth';

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

        return NextResponse.json(user);

    } catch (error) {
        return handleAuthError(error);
    }
}
