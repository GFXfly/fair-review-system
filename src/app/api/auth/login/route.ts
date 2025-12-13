import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logSuccess, logFailure } from '@/lib/audit-logger';
import { createErrorResponse } from '@/lib/error-handler';
import { getSession } from '@/lib/auth';
import { applyRateLimit, loginRateLimiter, getClientId } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    try {
        // Apply rate limiting
        const clientId = getClientId(request);
        const rateLimitResult = await applyRateLimit(loginRateLimiter, clientId);

        if (!rateLimitResult.success) {
            await logFailure('login_failed', '登录尝试次数过多', null, undefined, { clientId }, request);
            return rateLimitResult.response!;
        }

        const { username, password } = await request.json();

        // 1. Find user
        const user = await prisma.user.findUnique({
            where: { username }
        });

        if (!user) {
            // 记录登录失败（用户不存在）
            await logFailure('login_failed', '用户不存在', null, username, undefined, request);

            return NextResponse.json(
                { error: '用户名或密码错误' },
                { status: 401 }
            );
        }

        // 2. Verify password with bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            // 记录登录失败（密码错误）
            await logFailure('login_failed', '密码错误', user.id, username, undefined, request);

            return NextResponse.json(
                { error: '用户名或密码错误' },
                { status: 401 }
            );
        }

        // 3. Set secure session with iron-session
        const session = await getSession();
        session.userId = user.id;
        session.username = user.username;
        session.role = user.role;
        session.isLoggedIn = true;
        await session.save();

        // 4. 记录成功登录
        await logSuccess('login', user.id, username, {
            role: user.role,
            department: user.department
        }, request);

        // 5. Return user info (excluding password)
        const { password: _, ...userWithoutPassword } = user;
        return NextResponse.json(userWithoutPassword);

    } catch (error) {
        console.error('Login error:', error);

        // 记录系统错误
        await logFailure('login_failed', '系统错误', null, undefined, { error: String(error) }, request);

        return NextResponse.json(
            createErrorResponse(error, '登录'),
            { status: 500 }
        );
    }
}
