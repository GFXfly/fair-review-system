import { SessionOptions } from 'iron-session';

export interface SessionData {
    userId?: number;
    username?: string;
    role?: string;
    sessionVersion?: number;
    isLoggedIn: boolean;
}

const WEAK_SECRETS = new Set([
    'fair_competition_secret_please_change_this',
    'dev_secret_only_for_local_development_environment',
]);

const DEV_FALLBACK_SECRET = 'dev_secret_only_for_local_development_environment';

const isCookieSecure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';

/**
 * Resolve iron-session options with strict production runtime validation.
 */
export function getSessionOptions(): SessionOptions {
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
    const sessionSecret = process.env.SESSION_SECRET;
    const secure = process.env.COOKIE_SECURE
        ? process.env.COOKIE_SECURE === 'true'
        : process.env.NODE_ENV === 'production';

    if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
        if (!sessionSecret || sessionSecret.length < 32 || WEAK_SECRETS.has(sessionSecret)) {
            throw new Error('CRITICAL: Production SESSION_SECRET is missing or weak (>= 32 random chars required).');
        }
    }

    return {
        password: sessionSecret || DEV_FALLBACK_SECRET,
        cookieName: 'fair_competition_session',
        cookieOptions: {
            // 默认公网生产环境强制 HTTPS，内网纯 HTTP 部署可通过 COOKIE_SECURE=false 关闭
            secure,
            httpOnly: true,
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        },
    };
}

export const sessionOptions: SessionOptions = {
    password: process.env.SESSION_SECRET || DEV_FALLBACK_SECRET,
    cookieName: 'fair_competition_session',
    cookieOptions: {
        // 默认公网生产环境强制 HTTPS，内网纯 HTTP 部署可通过 COOKIE_SECURE=false 关闭
        secure: isCookieSecure,
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
    },
};
