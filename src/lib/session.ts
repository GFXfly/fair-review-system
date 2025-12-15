import { SessionOptions } from 'iron-session';

export interface SessionData {
    userId?: number;
    username?: string;
    role?: string;
    isLoggedIn: boolean;
}

export const sessionOptions: SessionOptions = {
    password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_for_production',
    cookieName: 'fair_competition_session',
    cookieOptions: {
        secure: false, // process.env.NODE_ENV === 'production', // FIXME: Temporarily disabled for HTTP deployment
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
    },
};
