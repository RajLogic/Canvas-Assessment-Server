import { verifyPassword, generateSessionId, setSessionCookie, getSessionExpiresAt } from '../../../lib/auth.js';
import { getUserByEmail, getUserByUsername, createSession, initializeDatabase } from '../../../lib/db.js';
import { getRequestIp, setRateLimitHeaders, takeRateLimitToken } from '../../../lib/rate-limit.js';

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const ip = getRequestIp(req);
    const limiter = takeRateLimitToken({
        key: `login:${ip}`,
        limit: LOGIN_LIMIT,
        windowMs: LOGIN_WINDOW_MS,
    });
    setRateLimitHeaders(res, {
        limit: LOGIN_LIMIT,
        remaining: limiter.remaining,
        retryAfterSec: limiter.retryAfterSec,
    });

    if (!limiter.allowed) {
        return res.status(429).json({
            message: `Too many login attempts. Try again in ${limiter.retryAfterSec} seconds.`,
        });
    }

    try {
        await initializeDatabase();
    } catch (err) {
        console.error('DB init error:', err);
        return res.status(500).json({ message: 'Database connection failed. Check DATABASE_URL environment variable.' });
    }

    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
        return res.status(400).json({ message: 'Email/username and password are required.' });
    }

    try {
        // Support login with either email or username
        let user = await getUserByEmail(identifier);
        if (!user) {
            user = await getUserByUsername(identifier);
        }

        if (!user) {
            // Generic message to avoid user enumeration
            return res.status(401).json({ message: 'Invalid credentials. Please check your email/username and password.' });
        }

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ message: 'Invalid credentials. Please check your email/username and password.' });
        }

        const sessionId = generateSessionId();
        const expiresAt = getSessionExpiresAt();
        await createSession(sessionId, user.id, expiresAt);
        setSessionCookie(res, sessionId);

        return res.status(200).json({
            message: 'Logged in successfully.',
            user: { id: user.id, email: user.email, username: user.username, dashboardVersion: user.dashboard_version || null },
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ message: 'Login failed. Please try again.' });
    }
}