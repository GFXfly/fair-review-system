import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAuth, handleAuthError, validatePassword, PASSWORD_REQUIREMENTS_MSG } from '@/lib/auth';
import { logSuccess, logFailure } from '@/lib/audit-logger';
import { applyRateLimit, passwordResetRateLimiter, getClientId } from '@/lib/rate-limit';

/**
 * Change password for the currently logged-in user
 * Requires old password verification
 */
export async function POST(request: NextRequest) {
    try {
        // Require authentication
        const currentUser = await requireAuth(request);

        // Apply rate limiting
        const clientId = getClientId(request);
        const rateLimitResult = await applyRateLimit(passwordResetRateLimiter, clientId);

        if (!rateLimitResult.success) {
            await logFailure('change_password_failed', '密码修改尝试次数过多', currentUser.id, currentUser.username, { clientId }, request);
            return rateLimitResult.response!;
        }

        const { oldPassword, newPassword } = await request.json();

        // Validate input
        if (!oldPassword || !newPassword) {
            return NextResponse.json(
                { error: '旧密码和新密码都是必填项' },
                { status: 400 }
            );
        }

        if (!validatePassword(newPassword)) {
            return NextResponse.json(
                { error: `新密码不符合要求：${PASSWORD_REQUIREMENTS_MSG}` },
                { status: 400 }
            );
        }

        // Get user with password
        const user = await prisma.user.findUnique({
            where: { id: currentUser.id }
        });

        if (!user) {
            return NextResponse.json(
                { error: '用户不存在' },
                { status: 404 }
            );
        }

        // Verify old password
        const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isOldPasswordValid) {
            await logFailure('change_password_failed', '旧密码错误', currentUser.id, currentUser.username, undefined, request);

            return NextResponse.json(
                { error: '旧密码错误' },
                { status: 400 }
            );
        }

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: currentUser.id },
            data: { password: hashedPassword }
        });

        await logSuccess('change_password', currentUser.id, currentUser.username, {}, request);

        return NextResponse.json({ success: true, message: '密码修改成功' });

    } catch (error) {
        return handleAuthError(error);
    }
}
