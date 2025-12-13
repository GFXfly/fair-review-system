import { RateLimiterMemory } from 'rate-limiter-flexible';
import { NextRequest, NextResponse } from 'next/server';

// Rate limiter for login attempts (5 attempts per 15 minutes per IP)
export const loginRateLimiter = new RateLimiterMemory({
    points: 5,
    duration: 15 * 60, // 15 minutes
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
 * Get client identifier from request
 */
export function getClientId(request: NextRequest): string {
    // Try to get real IP from various headers (for proxy/load balancer scenarios)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');

    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }

    if (realIp) {
        return realIp;
    }

    // Fallback to a generic identifier
    return 'unknown';
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
    } catch (rateLimiterRes: any) {
        const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000) || 60;

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
