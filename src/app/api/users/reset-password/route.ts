import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdmin, handleAuthError, validatePassword, PASSWORD_REQUIREMENTS_MSG } from '@/lib/auth';
import { logSuccess, logFailure } from '@/lib/audit-logger';
import { applyRateLimit, passwordResetRateLimiter, getClientId } from '@/lib/rate-limit';

const LOWER_CHARS = 'abcdefghjkmnpqrstuvwxyz';
const UPPER_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DIGIT_CHARS = '23456789';
const SYMBOL_CHARS = '@#%';

function pickRandomChars(charset: string, count: number): string[] {
    const chars: string[] = [];
    for (let i = 0; i < count; i++) {
        chars.push(charset[crypto.randomInt(0, charset.length)]);
    }
    return chars;
}

function generateTempPassword(): string {
    const chars = [
        ...pickRandomChars(LOWER_CHARS, 4),
        ...pickRandomChars(UPPER_CHARS, 2),
        ...pickRandomChars(DIGIT_CHARS, 3),
        ...pickRandomChars(SYMBOL_CHARS, 1),
    ];
    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}

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

        const hasCustomPassword = typeof newPassword === 'string' && newPassword.length > 0;
        if (hasCustomPassword) {
            const pwdCheck = validatePassword(newPassword);
            const isPwdValid = typeof pwdCheck === 'boolean' ? pwdCheck : pwdCheck.valid;
            if (!isPwdValid) {
                const pwdMsg = typeof pwdCheck === 'object' && pwdCheck.message
                    ? pwdCheck.message
                    : PASSWORD_REQUIREMENTS_MSG;
                return NextResponse.json({ error: `新密码无效：${pwdMsg}` }, { status: 400 });
            }
        }

        // Check if target user exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, role: true },
        });

        if (!user) {
            await logFailure('reset_password_failed', '目标用户不存在', admin.id, admin.username, { targetUserId: userId }, request);
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }

        if (user.role === 'admin') {
            await logFailure('reset_password_failed', '禁止重置管理员密码', admin.id, admin.username, { targetUserId: userId }, request);
            return NextResponse.json({ error: '不支持重置管理员账号密码，请使用个人中心修改密码' }, { status: 403 });
        }

        const tempPassword = hasCustomPassword ? null : generateTempPassword();
        const passwordToHash = hasCustomPassword ? newPassword : tempPassword!;

        // Hash password and bump sessionVersion to revoke old sessions immediately
        const hashedPassword = await bcrypt.hash(passwordToHash, 10);
        await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                sessionVersion: { increment: 1 },
            },
        });

        await logSuccess('reset_password', admin.id, admin.username, {
            targetUserId: userId,
            targetUsername: user.username,
            mode: hasCustomPassword ? 'manual' : 'generated',
        }, request);

        if (tempPassword) {
            return NextResponse.json({ success: true, tempPassword, message: '密码重置成功' });
        }
        return NextResponse.json({ success: true, message: '密码重置成功' });

    } catch (error) {
        return handleAuthError(error);
    }
}
