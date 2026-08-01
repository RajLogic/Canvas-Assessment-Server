import crypto from 'node:crypto';

// ─── Password Hashing ────────────────────────────────────────────────────────
// Uses PBKDF2 (built-in Node crypto) — no bcrypt dependency needed on edge/serverless

const ITERATIONS = 100_000;
const KEY_LEN = 64;
const DIGEST = 'sha512';
const SALT_BYTES = 32;

export async function hashPassword(password) {
    const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
    const hash = await new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, ITERATIONS, KEY_LEN, DIGEST, (err, key) => {
            if (err) reject(err);
            else resolve(key.toString('hex'));
        });
    });
    return `pbkdf2:${ITERATIONS}:${salt}:${hash}`;
}

export async function verifyPassword(password, stored) {
    try {
        const parts = stored.split(':');
        if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
        const [, iterations, salt, storedHash] = parts;
        const hash = await new Promise((resolve, reject) => {
            crypto.pbkdf2(password, salt, Number.parseInt(iterations), KEY_LEN, DIGEST, (err, key) => {
                if (err) reject(err);
                else resolve(key.toString('hex'));
            });
        });
        // Constant-time comparison
        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
    } catch {
        return false;
    }
}

// ─── Session ID Generation ────────────────────────────────────────────────────

export function generateSessionId() {
    return crypto.randomBytes(48).toString('hex');
}

// ─── Cookie Helpers ───────────────────────────────────────────────────────────

const SESSION_COOKIE = 'ct_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function setSessionCookie(res, sessionId) {
    const expires = new Date(Date.now() + SESSION_DURATION_MS);
    const isProduction = (process.env.NODE_ENV || 'development') === 'production';
    const cookieValue = [
        `${SESSION_COOKIE}=${sessionId}`,
        `Expires=${expires.toUTCString()}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        ...(isProduction ? ['Secure'] : []),
    ].join('; ');
    res.setHeader('Set-Cookie', cookieValue);
    return expires;
}

export function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`);
}

export function getSessionIdFromRequest(req) {
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.match(new RegExp(String.raw`(?:^|;\s*)${SESSION_COOKIE}=([^;]+)`));
    return match ? match[1] : null;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password) {
    if (!password || password.length < 8) return 'Password must be at least 8 characters.';
    return null;
}

export function validateUsername(username) {
    if (!username || username.length < 3) return 'Username must be at least 3 characters.';
    if (username.length > 30) return 'Username must be 30 characters or less.';
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return 'Username can only contain letters, numbers, underscores, and hyphens.';
    return null;
}

// ─── Session Duration ─────────────────────────────────────────────────────────

export function getSessionExpiresAt() {
    return new Date(Date.now() + SESSION_DURATION_MS);
}