import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdmin, handleAuthError, validatePassword, PASSWORD_REQUIREMENTS_MSG } from '@/lib/auth';
import { logSuccess, logFailure } from '@/lib/audit-logger';
import { isValidOrgType, isValidPhone, validateDepartmentByOrgType } from '@/lib/org-constants';

/**
 * Get all users (admin only)
 */
export async function GET(request: NextRequest) {
    try {
        await requireAdmin(request);

        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                username: true,
                name: true,
                department: true,
                orgType: true,
                phone: true,
                role: true,
                status: true,
                createdAt: true,
                _count: {
                    select: { reviews: true },
                },
            },
        });

        const formatted = users.map(({ _count, ...rest }) => ({
            ...rest,
            reviewCount: _count.reviews,
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        return handleAuthError(error);
    }
}

/**
 * Create new user (admin only)
 */
export async function POST(request: NextRequest) {
    try {
        // Require admin authentication
        const admin = await requireAdmin(request);

        const body = await request.json();
        const { username, password, name, department, orgType, phone, role } = body;

        const trimmedUsername = typeof username === 'string' ? username.trim() : '';
        const trimmedName = typeof name === 'string' ? name.trim() : '';
        const trimmedDepartment = typeof department === 'string' ? department.trim() : '';
        const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';

        // Manual validation
        if (!trimmedUsername || trimmedUsername.length < 3 || trimmedUsername.length > 32) {
            return NextResponse.json({ error: '用户名无效：须为 3-32 个字符' }, { status: 400 });
        }
        const pwdCheck = typeof password === 'string' ? validatePassword(password) : false;
        const isPwdValid = typeof pwdCheck === 'boolean' ? pwdCheck : pwdCheck.valid;
        if (!password || typeof password !== 'string' || !isPwdValid) {
            const pwdMsg = typeof pwdCheck === 'object' && pwdCheck.message
                ? pwdCheck.message
                : PASSWORD_REQUIREMENTS_MSG;
            return NextResponse.json({ error: `密码无效：${pwdMsg}` }, { status: 400 });
        }
        if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 32) {
            return NextResponse.json({ error: '姓名无效：须为 2-32 个字符' }, { status: 400 });
        }

        const resolvedOrgType = orgType ?? 'town';
        if (!isValidOrgType(resolvedOrgType)) {
            return NextResponse.json({ error: '主体类型无效' }, { status: 400 });
        }

        if (trimmedPhone && !isValidPhone(trimmedPhone)) {
            return NextResponse.json({ error: '请输入有效的 11 位手机号码' }, { status: 400 });
        }

        const validRoles = ['user', 'admin'];
        const userRole = role && validRoles.includes(role) ? role : 'user';

        // 若填写了单位且为普通用户，校验对应单位格式（管理员账号允许空单位）
        if (trimmedDepartment) {
            const deptError = validateDepartmentByOrgType(resolvedOrgType, trimmedDepartment, { allowLegacyTown: true });
            if (deptError) {
                return NextResponse.json({ error: deptError }, { status: 400 });
            }
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { username: trimmedUsername },
            select: { id: true },
        });

        if (existingUser) {
            await logFailure('create_user_failed', '用户名已存在', admin.id, admin.username, { targetUsername: trimmedUsername }, request);
            return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
        }

        // Hash password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                username: trimmedUsername,
                password: hashedPassword,
                name: trimmedName,
                department: trimmedDepartment || null,
                orgType: resolvedOrgType,
                phone: trimmedPhone || null,
                role: userRole,
                status: 'active',
            },
            select: {
                id: true,
                username: true,
                name: true,
                department: true,
                orgType: true,
                phone: true,
                role: true,
                status: true,
                createdAt: true,
            },
        });

        await logSuccess('create_user', admin.id, admin.username, {
            newUserId: newUser.id,
            newUsername: newUser.username,
            newUserRole: newUser.role,
            orgType: newUser.orgType,
        }, request);

        return NextResponse.json(newUser, { status: 201 });
    } catch (error) {
        return handleAuthError(error);
    }
}
