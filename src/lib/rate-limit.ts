import { RateLimiterMemory } from 'rate-limiter-flexible';
import { NextRequest, NextResponse } from 'next/server';

// Rate limiter for login attempts (5 attempts per 15 minutes per IP)
export const loginRateLimiter = new RateLimiterMemory({
    points: 5,
    duration: 15 * 60, // 15 minutes
});

// Rate limiter for self-registration (10 attempts per hour per IP)
export const registerRateLimiter = new RateLimiterMemory({
    points: 10,
    duration: 60 * 60, // 1 hour
});

// Rate limiter for password reset (3 attempts per hour per IP)
export const passwordResetRateLimiter = new RateLimiterMemory({
    points: 3,
    duration: 60 * 60, // 1 hour
});

// Rate limiter for LLM analysis (10 requests per hour per user)
export const llmAnalysisRateLimiter = new RateLimiterMemory({
    points: 10,
    duration: 60 * 60, // 1 hour
});

// Rate limiter for general API requests (100 per minute per IP)
export const generalApiRateLimiter = new RateLimiterMemory({
    points: 100,
    duration: 60, // 1 minute
});

/**
 * 从反向代理请求头中提取可信客户端 IP：
 * 1) 优先取单层 Nginx 强制覆写的 X-Real-IP；
 * 2) 其次取 X-Forwarded-For 末段（proxy_add_x_forwarded_for 追加的真实来源 IP，防止伪造首段绕过限流）；
 * 3) 兜底返回 'unknown'。
 */
export function getTrustedClientIp(request: NextRequest | Request): string {
    const realIp = request.headers.get('x-real-ip')?.trim();
    if (realIp) {
        return realIp;
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        const parts = forwardedFor
            .split(',')
            .map(part => part.trim())
            .filter(Boolean);
        if (parts.length > 0) {
            return parts[parts.length - 1];
        }
    }

    return 'unknown';
}

/**
 * Get client identifier from request
 */
export function getClientId(request: NextRequest | Request): string {
    return getTrustedClientIp(request);
}

/**
 * Apply rate limiting to a request
 */
export async function applyRateLimit(
    rateLimiter: RateLimiterMemory,
    identifier: string
): Promise<{ success: boolean; response?: NextResponse }> {
    try {
        await rateLimiter.consume(identifier);
        return { success: true };
    } catch (rateLimiterRes: unknown) {
        const msBeforeNext =
            typeof rateLimiterRes === 'object' &&
            rateLimiterRes !== null &&
            'msBeforeNext' in rateLimiterRes &&
            typeof (rateLimiterRes as { msBeforeNext?: unknown }).msBeforeNext === 'number'
                ? (rateLimiterRes as { msBeforeNext: number }).msBeforeNext
                : 0;
        const retryAfter = Math.ceil(msBeforeNext / 1000) || 60;

        return {
            success: false,
            response: NextResponse.json(
                {
                    error: '请求过于频繁，请稍后再试',
                    retryAfter
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(retryAfter)
                    }
                }
            )
        };
    }
}
