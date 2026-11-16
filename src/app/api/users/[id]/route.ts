import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { logSuccess } from '@/lib/audit-logger';

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

        // Unbind nullable foreign keys and delete owned feedback before removing the user
        await prisma.$transaction([
            prisma.reviewRecord.updateMany({ where: { userId }, data: { userId: null } }),
            prisma.riskFeedback.updateMany({ where: { adminUserId: userId }, data: { adminUserId: null } }),
            prisma.riskFeedback.deleteMany({ where: { userId } }),
            prisma.auditLog.updateMany({ where: { userId }, data: { userId: null } }),
            prisma.user.delete({ where: { id: userId } }),
        ]);

        await logSuccess('delete_user', admin.id, admin.username, {
            deletedUserId: userId,
            deletedUsername: userToDelete.username
        }, request);

        return NextResponse.json({ message: '用户删除成功' });
    } catch (error) {
        return handleAuthError(error);
    }
}
