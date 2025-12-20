import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createErrorResponse } from '@/lib/error-handler';
import { getCurrentUser } from '@/lib/auth';

/**
 * 审计日志查询 API
 * 仅管理员可访问
 */
export async function GET(req: NextRequest) {
    try {
        // 1. 验证管理员权限
        // 1. 验证管理员权限
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { error: '未登录' },
                { status: 401 }
            );
        }

        if (!user || user.role !== 'admin') {
            return NextResponse.json(
                {
                    error: '权限不足',
                    message: '只有管理员可以查看审计日志',
                    suggestion: '如需访问此功能，请联系系统管理员'
                },
                { status: 403 }
            );
        }

        // 2. 解析查询参数
        const searchParams = req.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '50');
        const action = searchParams.get('action');
        const status = searchParams.get('status');
        const targetUserId = searchParams.get('userId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // 3. 构建查询条件
        const where: any = {};

        if (action) {
            where.action = action;
        }

        if (status) {
            where.status = status;
        }

        if (targetUserId) {
            where.userId = parseInt(targetUserId);
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                where.createdAt.lte = new Date(endDate);
            }
        }

        // 4. 查询审计日志（分页）
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            name: true,
                            department: true,
                            role: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                skip: (page - 1) * pageSize,
                take: pageSize
            }),
            prisma.auditLog.count({ where })
        ]);

        // 5. 返回结果
        return NextResponse.json({
            logs: logs.map(log => {
                let parsedDetails = null;
                if (log.details) {
                    try {
                        parsedDetails = JSON.parse(log.details);
                    } catch (e) {
                        console.error(`Failed to parse audit log details for log ${log.id}`, e);
                        parsedDetails = { raw: log.details };
                    }
                }
                return {
                    ...log,
                    details: parsedDetails
                };
            }),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        });

    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        return NextResponse.json(
            createErrorResponse(error, '查询审计日志'),
            { status: 500 }
        );
    }
}
