import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';

export const PASSWORD_REQUIREMENTS_MSG = '密码长度至少8位，且包含字母、数字、特殊字符中的两种及以上';

export function validatePassword(password: string): boolean {
    if (!password || password.length < 8) return false;

    let types = 0;
    if (/[a-zA-Z]/.test(password)) types++;
    if (/[0-9]/.test(password)) types++;
    if (/[^a-zA-Z0-9]/.test(password)) types++;

    return types >= 2;
}

/**
 * Get the current session from request
 */
export async function getSession() {
    const cookieStore = await cookies();
    return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/**
 * Get current logged-in user
 * Returns null if not authenticated
 */
export async function getCurrentUser(request?: NextRequest) {
    try {
        const session = await getSession();

        if (!session.isLoggedIn || !session.userId) {
            return null;
        }

        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: {
                id: true,
                username: true,
                name: true,
                department: true,
                role: true,
                createdAt: true,
                // Exclude password
            }
        });

        return user;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

/**
 * Require authentication - throws error if not logged in
 */
export async function requireAuth(request?: NextRequest) {
    const user = await getCurrentUser(request);

    if (!user) {
        throw new AuthError('未登录，请先登录', 401);
    }

    return user;
}

/**
 * Require admin role - throws error if not admin
 */
export async function requireAdmin(request?: NextRequest) {
    const user = await requireAuth(request);

    if (user.role !== 'admin') {
        throw new AuthError('需要管理员权限', 403);
    }

    return user;
}

/**
 * Custom authentication error
 */
export class AuthError extends Error {
    constructor(
        message: string,
        public statusCode: number = 401
    ) {
        super(message);
        this.name = 'AuthError';
    }
}

/**
 * Handle authentication errors and return appropriate response
 */
export function handleAuthError(error: unknown): NextResponse {
    if (error instanceof AuthError) {
        return NextResponse.json(
            { error: error.message },
            { status: error.statusCode }
        );
    }

    console.error('Unexpected error in auth handler:', error);
    return NextResponse.json(
        { error: '服务器内部错误' },
        { status: 500 }
    );
}
