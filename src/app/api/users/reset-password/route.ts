import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdmin, handleAuthError, validatePassword, PASSWORD_REQUIREMENTS_MSG } from '@/lib/auth';
import { logSuccess, logFailure } from '@/lib/audit-logger';
import { applyRateLimit, passwordResetRateLimiter, getClientId } from '@/lib/rate-limit';

/**
 * Admin-only endpoint to reset another user's password
 * Does NOT require old password verification
 */
export async function POST(request: NextRequest) {
    try {
        // Require admin authentication
        const admin = await requireAdmin(request);

        // Apply rate limiting
        const clientId = getClientId(request);
        const rateLimitResult = await applyRateLimit(passwordResetRateLimiter, clientId);

        if (!rateLimitResult.success) {
            await logFailure('reset_password_failed', '密码重置尝试次数过多', admin.id, admin.username, { clientId }, request);
            return rateLimitResult.response!;
        }

        const { userId, newPassword } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: '用户ID是必填项' }, { status: 400 });
        }

        if (!newPassword || !validatePassword(newPassword)) {
            return NextResponse.json({ error: `新密码无效：${PASSWORD_REQUIREMENTS_MSG}` }, { status: 400 });
        }

        // Check if target user exists
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            await logFailure('reset_password_failed', '目标用户不存在', admin.id, admin.username, { targetUserId: userId }, request);
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }

        // Hash password before updating
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        await logSuccess('reset_password', admin.id, admin.username, {
            targetUserId: userId,
            targetUsername: user.username
        }, request);

        return NextResponse.json({ success: true, message: '密码重置成功' });

    } catch (error) {
        return handleAuthError(error);
    }
}
