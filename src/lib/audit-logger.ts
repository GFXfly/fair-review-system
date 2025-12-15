/**
 * 审计日志工具
 * 记录所有关键操作，用于安全审计和问题追溯
 */

import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

export type AuditAction =
    | 'login'                   // 用户登录
    | 'login_failed'            // 登录失败
    | 'logout'                  // 用户登出
    | 'change_password'         // 修改密码
    | 'change_password_failed'  // 修改密码失败
    | 'reset_password'          // 重置密码
    | 'reset_password_failed'   // 重置密码失败
    | 'create_user'             // 创建用户
    | 'create_user_failed'      // 创建用户失败
    | 'create_cases'            // 创建案例
    | 'upload_file'             // 上传文件
    | 'analyze_file'            // 分析文件
    | 'view_review'             // 查看审查结果
    | 'export_review'           // 导出审查报告
    | 'delete_review'           // 删除审查记录
    | 'delete_user'             // 删除用户
    | 'access_denied';          // 访问被拒绝

export type AuditStatus = 'success' | 'failure';

interface AuditLogParams {
    userId?: number | null;
    action: AuditAction;
    resource?: string;
    status: AuditStatus;
    details?: Record<string, any>;
    errorMessage?: string;
    request?: NextRequest;
}

/**
 * 从请求中提取客户端信息
 */
function getClientInfo(request?: NextRequest) {
    if (!request) {
        return {
            ipAddress: null,
            userAgent: null
        };
    }

    // 获取真实IP地址（考虑代理）
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0] || realIp || null;

    // 获取 User Agent
    const userAgent = request.headers.get('user-agent') || null;

    return { ipAddress, userAgent };
}

/**
 * 记录审计日志
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
    try {
        const { userId, action, resource, status, details, errorMessage, request } = params;
        const { ipAddress, userAgent } = getClientInfo(request);

        await prisma.auditLog.create({
            data: {
                userId,
                action,
                resource,
                status,
                ipAddress,
                userAgent,
                details: details ? JSON.stringify(details) : null,
                errorMessage
            }
        });

        // 同时输出到控制台日志（便于调试）
        const logLevel = status === 'failure' ? 'warn' : 'info';
        console[logLevel](`[Audit] ${action} - ${status}`, {
            userId,
            resource,
            ipAddress,
            errorMessage
        });
    } catch (error) {
        // 审计日志记录失败不应该影响主业务流程
        console.error('[Audit] Failed to log audit record:', error);
    }
}

/**
 * 便捷方法：记录成功操作
 */
export async function logSuccess(
    action: AuditAction,
    userId?: number | null,
    resource?: string,
    details?: Record<string, any>,
    request?: NextRequest
): Promise<void> {
    await logAudit({
        userId,
        action,
        resource,
        status: 'success',
        details,
        request
    });
}

/**
 * 便捷方法：记录失败操作
 */
export async function logFailure(
    action: AuditAction,
    errorMessage: string,
    userId?: number | null,
    resource?: string,
    details?: Record<string, any>,
    request?: NextRequest
): Promise<void> {
    await logAudit({
        userId,
        action,
        resource,
        status: 'failure',
        errorMessage,
        details,
        request
    });
}
