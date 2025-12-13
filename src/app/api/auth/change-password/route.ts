import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { logSuccess, logFailure } from '@/lib/audit-logger';
import { createErrorResponse } from '@/lib/error-handler';

export async function POST(req: NextRequest) {
    try {
        const { currentPassword, newPassword } = await req.json();
        const cookieStore = await cookies();
        const userIdStr = cookieStore.get('userId')?.value;
        const userId = userIdStr ? parseInt(userIdStr) : null;

        if (!userId) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        if (!newPassword || newPassword.length < 6) {
            await logFailure('change_password', '新密码不符合要求', userId, undefined, undefined, req);
            return NextResponse.json({
                error: '密码不符合要求',
                message: '新密码长度至少需要6位',
                suggestion: '请输入至少6个字符的密码'
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

        // 3. Hash new password and update
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        // 记录密码修改成功
        await logSuccess('change_password', userId, user.username, undefined, req);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Change password error:', error);

        const cookieStore = await cookies();
        const userIdStr = cookieStore.get('userId')?.value;
        const userId = userIdStr ? parseInt(userIdStr) : null;

        await logFailure('change_password', '系统错误', userId, undefined, { error: String(error) }, req);

        return NextResponse.json(
            createErrorResponse(error, '修改密码'),
            { status: 500 }
        );
    }
}
