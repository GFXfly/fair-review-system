import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdmin, requireAuth, handleAuthError } from '@/lib/auth';
import { logSuccess, logFailure } from '@/lib/audit-logger';

/**
 * Get all users (requires authentication)
 * Regular users can see the list, but sensitive operations require admin
 */
export async function GET(request: NextRequest) {
    try {
        // Require authentication to view users
        await requireAuth(request);

        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                username: true,
                name: true,
                department: true,
                role: true,
                createdAt: true,
                // Exclude password
            },
        });
        return NextResponse.json(users);
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
        const { username, password, name, department, role } = body;

        // Manual validation
        if (!username || typeof username !== 'string' || username.length < 3) {
            return NextResponse.json({ error: '用户名无效：至少需要3个字符' }, { status: 400 });
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
            return NextResponse.json({ error: '密码无效：至少需要6个字符' }, { status: 400 });
        }
        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: '姓名无效' }, { status: 400 });
        }
        const validRoles = ['user', 'admin'];
        const userRole = role && validRoles.includes(role) ? role : 'user';

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { username },
        });

        if (existingUser) {
            await logFailure('create_user_failed', '用户名已存在', admin.id, admin.username, { targetUsername: username }, request);
            return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
        }

        // Hash password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name,
                department,
                role: userRole,
            },
        });

        await logSuccess('create_user', admin.id, admin.username, {
            newUserId: newUser.id,
            newUsername: newUser.username,
            newUserRole: newUser.role
        }, request);

        // Remove password from response
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userWithoutPassword } = newUser;

        return NextResponse.json(userWithoutPassword, { status: 201 });
    } catch (error) {
        return handleAuthError(error);
    }
}
