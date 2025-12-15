import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { logSuccess } from '@/lib/audit-logger';

// @ts-ignore
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await requireAdmin(request);
        const { id } = await context.params;
        const userId = parseInt(id);

        if (isNaN(userId)) {
            return NextResponse.json({ error: '无效的用户ID' }, { status: 400 });
        }

        // Prevent self-deletion
        if (userId === admin.id) {
            return NextResponse.json({ error: '不能删除自己的账号' }, { status: 400 });
        }

        const userToDelete = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!userToDelete) {
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }

        await prisma.user.delete({
            where: { id: userId },
        });

        await logSuccess('delete_user', admin.id, admin.username, {
            deletedUserId: userId,
            deletedUsername: userToDelete.username
        }, request);

        return NextResponse.json({ message: '用户删除成功' });
    } catch (error) {
        return handleAuthError(error);
    }
}
