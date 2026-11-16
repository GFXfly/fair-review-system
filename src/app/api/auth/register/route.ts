import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { validatePassword, PASSWORD_REQUIREMENTS_MSG } from '@/lib/auth';
import { logSuccess, logFailure } from '@/lib/audit-logger';
import { createErrorResponse } from '@/lib/error-handler';
import { applyRateLimit, registerRateLimiter, getClientId } from '@/lib/rate-limit';
import {
    isValidOrgType,
    isValidPhone,
    validateDepartmentByOrgType,
} from '@/lib/org-constants';

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,32}$/;
const MAX_PENDING_USERS = 200;

export async function POST(request: NextRequest) {
    try {
        const clientId = getClientId(request);
        const rateLimitResult = await applyRateLimit(registerRateLimiter, clientId);
        if (!rateLimitResult.success) {
            await logFailure('register_failed', '注册尝试次数过多', null, undefined, { clientId }, request);
            return rateLimitResult.response!;
        }

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: '请求参数格式无效' }, { status: 400 });
        }

        const username = typeof body.username === 'string' ? body.username.trim() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const orgType = body.orgType;
        const department = typeof body.department === 'string' ? body.department.trim() : '';
        const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

        if (!USERNAME_REGEX.test(username)) {
            return NextResponse.json(
                { error: '用户名须为 3-32 位字母、数字、下划线或连字符' },
                { status: 400 }
            );
        }

        if (name.length < 2 || name.length > 32) {
            return NextResponse.json(
                { error: '真实姓名须为 2-32 个字符' },
                { status: 400 }
            );
        }

        if (!phone || !isValidPhone(phone)) {
            return NextResponse.json(
                { error: '请输入有效的 11 位手机号码' },
                { status: 400 }
            );
        }

        if (!validatePassword(password)) {
            return NextResponse.json(
                { error: PASSWORD_REQUIREMENTS_MSG },
                { status: 400 }
            );
        }

        if (!isValidOrgType(orgType)) {
            return NextResponse.json(
                { error: '请选择有效的主体类型' },
                { status: 400 }
            );
        }

        const deptError = validateDepartmentByOrgType(orgType, department);
        if (deptError) {
            return NextResponse.json({ error: deptError }, { status: 400 });
        }

        const pendingCount = await prisma.user.count({
            where: { status: 'pending' },
        });
        if (pendingCount >= MAX_PENDING_USERS) {
            await logFailure('register_failed', '待审批申请达到上限', null, username, { pendingCount }, request);
            return NextResponse.json(
                { error: '当前待审批申请过多，请联系管理员先行处理' },
                { status: 429 }
            );
        }

        const existingUser = await prisma.user.findUnique({
            where: { username },
            select: { id: true },
        });
        if (existingUser) {
            await logFailure('register_failed', '用户名已被使用', null, username, undefined, request);
            return NextResponse.json(
                { error: '该用户名已被使用，请更换后重试' },
                { status: 409 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name,
                orgType,
                department,
                phone,
                role: 'user',
                status: 'pending',
            },
            select: {
                id: true,
                username: true,
            },
        });

        await logSuccess(
            'register',
            newUser.id,
            newUser.username,
            { orgType, department },
            request
        );

        return NextResponse.json(
            {
                success: true,
                message: '注册申请已提交，请等待管理员审批通过后登录',
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Register error:', error);
        await logFailure('register_failed', '系统错误', null, undefined, { error: String(error) }, request);
        return NextResponse.json(
            createErrorResponse(error, '注册'),
            { status: 500 }
        );
    }
}
