import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { logSuccess } from '@/lib/audit-logger';
import { isValidOrgType, isValidPhone, validateDepartmentByOrgType } from '@/lib/org-constants';

type StatusAction = 'approve' | 'reject' | 'enable' | 'disable';

const STATUS_TRANSITIONS: Record<StatusAction, { allowedFrom: string[]; nextStatus: string; bumpSession: boolean }> = {
    approve: { allowedFrom: ['pending', 'rejected'], nextStatus: 'active', bumpSession: false },
    reject: { allowedFrom: ['pending'], nextStatus: 'rejected', bumpSession: true },
    disable: { allowedFrom: ['active'], nextStatus: 'disabled', bumpSession: true },
    enable: { allowedFrom: ['disabled'], nextStatus: 'active', bumpSession: false },
};

const SAFE_USER_SELECT = {
    id: true,
    username: true,
    name: true,
    department: true,
    orgType: true,
    phone: true,
    role: true,
    status: true,
    createdAt: true,
} as const;

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await requireAdmin(request);
        const { id } = await context.params;
        if (!/^\d+$/.test(id)) {
            return NextResponse.json({ error: '无效的用户ID' }, { status: 400 });
        }
        const userId = parseInt(id, 10);

        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                name: true,
                department: true,
                orgType: true,
                phone: true,
                role: true,
                status: true,
            },
        });

        if (!targetUser) {
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: '请求参数无效' }, { status: 400 });
        }

        if ('action' in body && body.action !== undefined) {
            const action = body.action as string;
            if (!(action in STATUS_TRANSITIONS)) {
                return NextResponse.json({ error: '不支持的状态操作' }, { status: 400 });
            }

            if (userId === admin.id || targetUser.role === 'admin') {
                return NextResponse.json({ error: '禁止修改自身或管理员账号状态' }, { status: 400 });
            }

            const transition = STATUS_TRANSITIONS[action as StatusAction];
            if (!transition.allowedFrom.includes(targetUser.status)) {
                return NextResponse.json(
                    { error: '账号当前状态不适用此操作，请刷新后重试' },
                    { status: 409 }
                );
            }

            const updated = await prisma.user.update({
                where: { id: userId },
                data: {
                    status: transition.nextStatus,
                    ...(transition.bumpSession ? { sessionVersion: { increment: 1 } } : {}),
                },
                select: SAFE_USER_SELECT,
            });

            await logSuccess('update_user', admin.id, admin.username, {
                targetUserId: userId,
                targetUsername: targetUser.username,
                action,
                previousStatus: targetUser.status,
                newStatus: transition.nextStatus,
            }, request);

            return NextResponse.json(updated);
        }

        // 资料编辑模式：{ name?, department?, orgType?, phone? }
        const updateData: {
            name?: string;
            department?: string | null;
            orgType?: string;
            phone?: string | null;
        } = {};

        if (body.name !== undefined) {
            const trimmedName = typeof body.name === 'string' ? body.name.trim() : '';
            if (trimmedName.length < 2 || trimmedName.length > 32) {
                return NextResponse.json({ error: '姓名须为 2-32 个字符' }, { status: 400 });
            }
            updateData.name = trimmedName;
        }

        let nextOrgType = targetUser.orgType;
        if (body.orgType !== undefined) {
            if (!isValidOrgType(body.orgType)) {
                return NextResponse.json({ error: '主体类型无效' }, { status: 400 });
            }
            nextOrgType = body.orgType;
            updateData.orgType = body.orgType;
        }

        if (body.department !== undefined || body.orgType !== undefined) {
            const rawDept = body.department !== undefined ? body.department : (targetUser.department ?? '');
            const trimmedDept = typeof rawDept === 'string' ? rawDept.trim() : '';
            if (!trimmedDept) {
                return NextResponse.json({ error: '所属单位/公司不能为空' }, { status: 400 });
            }
            if (isValidOrgType(nextOrgType)) {
                const deptError = validateDepartmentByOrgType(nextOrgType, trimmedDept, { allowLegacyTown: true });
                if (deptError) {
                    return NextResponse.json({ error: deptError }, { status: 400 });
                }
            }
            updateData.department = trimmedDept;
        }

        if (body.phone !== undefined) {
            const trimmedPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
            if (trimmedPhone && !isValidPhone(trimmedPhone)) {
                return NextResponse.json({ error: '请输入有效的 11 位手机号码' }, { status: 400 });
            }
            updateData.phone = trimmedPhone || null;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: SAFE_USER_SELECT,
        });

        await logSuccess('update_user', admin.id, admin.username, {
            targetUserId: userId,
            targetUsername: targetUser.username,
            updatedFields: Object.keys(updateData),
        }, request);

        return NextResponse.json(updated);
    } catch (error) {
        return handleAuthError(error);
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await requireAdmin(request);
        const { id } = await context.params;
        const userId = parseInt(id, 10);

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

        const reviewCount = await prisma.reviewRecord.count({ where: { userId } });
        const force = request?.url
            ? new URL(request.url, 'http://localhost').searchParams.get('force') === 'true'
            : false;

        if (reviewCount > 0 && !force) {
            return NextResponse.json(
                { error: `该账号名下已有 ${reviewCount} 条历史审查记录，请改用「禁用」以保留台账归属信息` },
                { status: 409 }
            );
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
            deletedUsername: userToDelete.username,
            force,
        }, request);

        return NextResponse.json({ message: '用户删除成功' });
    } catch (error) {
        return handleAuthError(error);
    }
}
