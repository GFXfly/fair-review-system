import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logSuccess } from '@/lib/audit-logger';

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        const userId = session.userId;
        const username = session.username;

        // Destroy session
        session.destroy();

        // Log logout event if user was logged in
        if (userId && username) {
            await logSuccess('logout', userId, username, {}, request);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: '登出失败' },
            { status: 500 }
        );
    }
}
