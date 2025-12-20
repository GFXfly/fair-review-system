import { SessionOptions } from 'iron-session';

export interface SessionData {
    userId?: number;
    username?: string;
    role?: string;
    isLoggedIn: boolean;
}

const sessionSecret = process.env.SESSION_SECRET;

if (process.env.NODE_ENV === 'production' && !sessionSecret) {
    console.error('CRITICAL: SESSION_SECRET must be set in production!');
}

export const sessionOptions: SessionOptions = {
    password: sessionSecret || 'dev_secret_only_for_local_development_environment',
    cookieName: 'fair_competition_session',
    cookieOptions: {
        // 生产环境必须使用HTTPS，开发环境允许HTTP
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
    },
};
