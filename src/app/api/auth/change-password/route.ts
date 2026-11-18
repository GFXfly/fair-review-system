import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logSuccess, logFailure } from '@/lib/audit-logger';
import { createErrorResponse } from '@/lib/error-handler';
import { getCurrentUser, getSession, validatePassword, PASSWORD_REQUIREMENTS_MSG } from '@/lib/auth';
import { applyRateLimit, passwordResetRateLimiter, getClientId } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
    let userId: number | null = null;
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        userId = currentUser.id;

        const clientId = getClientId(req);
        const rateLimitResult = await applyRateLimit(
            passwordResetRateLimiter,
            `${userId}:${clientId}`
        );
        if (!rateLimitResult.success) {
            await logFailure('change_password', '密码修改尝试次数过多', userId, currentUser.username, { clientId }, req);
            return rateLimitResult.response!;
        }

        const { currentPassword, newPassword } = await req.json();

        if (
            typeof currentPassword !== 'string' ||
            !currentPassword ||
            typeof newPassword !== 'string' ||
            !newPassword
        ) {
            return NextResponse.json({ error: '当前密码和新密码都是必填项' }, { status: 400 });
        }

        if (typeof Buffer !== 'undefined' ? Buffer.byteLength(currentPassword, 'utf8') > 128 : currentPassword.length > 128) {
            return NextResponse.json({
                error: '当前密码错误',
                message: '您输入的当前密码不正确',
                suggestion: '请确认当前密码后重试'
            }, { status: 400 });
        }

        const pwdCheck = validatePassword(newPassword);
        const isPwdValid = typeof pwdCheck === 'boolean' ? pwdCheck : pwdCheck.valid;
        if (!isPwdValid) {
            const pwdMsg = typeof pwdCheck === 'boolean'
                ? PASSWORD_REQUIREMENTS_MSG
                : (pwdCheck.message || PASSWORD_REQUIREMENTS_MSG);
            await logFailure('change_password', '新密码不符合要求', userId, undefined, undefined, req);
            return NextResponse.json({
                error: '密码不符合要求',
                message: pwdMsg,
                suggestion: '请使用更复杂的密码（需包含字母、数字、符号中的两种）'
            }, { status: 400 });
        }

        // 1. Find user
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }

        // 2. Verify current password with bcrypt
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            await logFailure('change_password', '当前密码错误', userId, user.username, undefined, req);
            return NextResponse.json({
                error: '当前密码错误',
                message: '您输入的当前密码不正确',
                suggestion: '请确认当前密码后重试'
            }, { status: 400 });
        }

        // 3. Hash new password and bump sessionVersion to revoke old sessions across other devices
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                sessionVersion: { increment: 1 },
            },
            select: { sessionVersion: true },
        });

        if (typeof getSession === 'function') {
            try {
                const session = await getSession();
                if (session.isLoggedIn && session.userId === userId) {
                    session.sessionVersion = updatedUser.sessionVersion;
                    await session.save();
                }
            } catch {
                // 忽略测试环境无 cookies 上下文的情况
            }
        }

        // 记录密码修改成功
        await logSuccess('change_password', userId, user.username, undefined, req);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Change password error:', error);

        await logFailure('change_password', '系统错误', userId, undefined, { error: String(error) }, req);

        return NextResponse.json(
            createErrorResponse(error, '修改密码'),
            { status: 500 }
        );
    }
}
