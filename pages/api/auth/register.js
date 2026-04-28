import { hashPassword, validateEmail, validatePassword, validateUsername, generateSessionId, setSessionCookie, getSessionExpiresAt } from '../../../lib/auth.js';
import { getUserByEmail, getUserByUsername, createUser, createSession, initializeDatabase } from '../../../lib/db.js';
import { getRequestIp, setRateLimitHeaders, takeRateLimitToken } from '../../../lib/rate-limit.js';

const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 30 * 60 * 1000;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const ip = getRequestIp(req);
    const limiter = takeRateLimitToken({
        key: `register:${ip}`,
        limit: REGISTER_LIMIT,
        windowMs: REGISTER_WINDOW_MS,
    });
    setRateLimitHeaders(res, {
        limit: REGISTER_LIMIT,
        remaining: limiter.remaining,
        retryAfterSec: limiter.retryAfterSec,
    });

    if (!limiter.allowed) {
        return res.status(429).json({
            message: `Too many registration attempts. Try again in ${limiter.retryAfterSec} seconds.`,
        });
    }

    try {
        // Ensure tables exist
        await initializeDatabase();
    } catch (err) {
        console.error('DB init error:', err);
        return res.status(500).json({ message: 'Database connection failed. Check DATABASE_URL environment variable.' });
    }

    const { email, username, password } = req.body || {};

    // ─── Validation ───
    if (!email || !username || !password) {
        return res.status(400).json({ message: 'Email, username, and password are required.' });
    }

    if (!validateEmail(email)) {
        return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
        return res.status(400).json({ message: usernameError });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
        return res.status(400).json({ message: passwordError });
    }

    try {
        // ─── Check duplicates ───
        const existingEmail = await getUserByEmail(email);
        if (existingEmail) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        const existingUsername = await getUserByUsername(username);
        if (existingUsername) {
            return res.status(409).json({ message: 'This username is already taken.' });
        }

        // ─── Create user ───
        const passwordHash = await hashPassword(password);
        const user = await createUser({ email, username, passwordHash });

        // ─── Create session ───
        const sessionId = generateSessionId();
        const expiresAt = getSessionExpiresAt();
        await createSession(sessionId, user.id, expiresAt);
        setSessionCookie(res, sessionId);

        return res.status(201).json({
            message: 'Account created successfully.',
            user: { id: user.id, email: user.email, username: user.username, dashboardVersion: user.dashboard_version || null },
        });
    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
}