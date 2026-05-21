import { neon } from '@neondatabase/serverless';
import { encryptField, safeDecryptField } from './encrypt.js';

let sql;

export function getDb() {
    if (!sql) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is not set. Please add your Neon database URL.');
        }
        sql = neon(connectionString);
    }
    return sql;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

export async function initializeDatabase() {
    const sql = getDb();

    await sql`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            username VARCHAR(100) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            canvas_api_token TEXT,
            timetable_link TEXT,
            canvas_base_url TEXT,
            dashboard_version TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `;

    await sql`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_base_url TEXT
    `;

    await sql`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_version TEXT
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS sessions (
            id VARCHAR(255) PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `;

    return true;
}

// ─── Decryption helpers ───────────────────────────────────────────────────────

/**
 * Decrypt sensitive fields on a raw DB row.
 * canvas_api_token and timetable_link are AES-256-GCM encrypted.
 * canvas_base_url is stored as plaintext — it's not sensitive and
 * needs to be readable to show which university is selected.
 */
function decryptUserRow(row) {
    if (!row) return null;
    return {
        ...row,
        canvas_api_token: safeDecryptField(row.canvas_api_token),
        timetable_link: safeDecryptField(row.timetable_link),
        canvas_base_url: row.canvas_base_url || null,  // plaintext — no decryption needed
        dashboard_version: row.dashboard_version || null,
    };
}

// ─── User queries ─────────────────────────────────────────────────────────────

export async function getUserByEmail(email) {
    const sql = getDb();
    const result = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
    return decryptUserRow(result[0]) || null;
}

export async function getUserByUsername(username) {
    const sql = getDb();
    const result = await sql`SELECT * FROM users WHERE username = ${username.trim()} LIMIT 1`;
    return decryptUserRow(result[0]) || null;
}

export async function getUserById(id) {
    const sql = getDb();
    const result = await sql`
        SELECT id, email, username, canvas_api_token, timetable_link, canvas_base_url, dashboard_version, created_at
        FROM users WHERE id = ${id} LIMIT 1
    `;
    return decryptUserRow(result[0]) || null;
}

export async function createUser({ email, username, passwordHash }) {
    const sql = getDb();
    const result = await sql`
        INSERT INTO users (email, username, password_hash)
        VALUES (${email.toLowerCase().trim()}, ${username.trim()}, ${passwordHash})
        RETURNING id, email, username, created_at
    `;
    return result[0];
}

/**
 * Save per-user settings.
 * canvas_api_token and timetable_link are encrypted with AES-256-GCM before storage.
 * canvas_base_url is saved as plain text — it's a non-secret URL (e.g. a university
 * Canvas domain) and needs to be readable to display which institution is selected.
 */
export async function updateUserSettings(userId, { canvasApiToken, timetableLink, canvasBaseUrl, dashboardVersion }) {
    const sql = getDb();

    const normalizeValue = (value, transform) => {
        if (value === undefined) return undefined;
        return transform(value);
    };

    const encToken = normalizeValue(canvasApiToken, value => (value ? encryptField(value) : null));
    const encTimetable = normalizeValue(timetableLink, value => (value ? encryptField(value) : null));
    // canvas_base_url stored as-is — not sensitive, needs to be human-readable
    const plainBaseUrl = normalizeValue(canvasBaseUrl, value => value || null);
    const plainDashboardVersion = normalizeValue(dashboardVersion, value => (
        value === 'v1' || value === 'base' ? value : null
    ));

    const hasToken = encToken !== undefined;
    const hasTimetable = encTimetable !== undefined;
    const hasBaseUrl = plainBaseUrl !== undefined;
    const hasDashboardVersion = plainDashboardVersion !== undefined;

    if (!hasToken && !hasTimetable && !hasBaseUrl && !hasDashboardVersion) {
        return getUserById(userId);
    }

    const setClauses = [];
    const values = [];

    if (hasToken) {
        values.push(encToken);
        setClauses.push(`canvas_api_token = $${values.length}`);
    }

    if (hasTimetable) {
        values.push(encTimetable);
        setClauses.push(`timetable_link = $${values.length}`);
    }

    if (hasBaseUrl) {
        values.push(plainBaseUrl);
        setClauses.push(`canvas_base_url = $${values.length}`);
    }

    if (hasDashboardVersion) {
        values.push(plainDashboardVersion);
        setClauses.push(`dashboard_version = $${values.length}`);
    }

    setClauses.push('updated_at = NOW()');
    values.push(userId);

    const query = `
        UPDATE users
        SET ${setClauses.join(', ')}
        WHERE id = $${values.length}
        RETURNING id, email, username, canvas_api_token, timetable_link, canvas_base_url, dashboard_version
    `;

    const result = await sql.query(query, values);

    return decryptUserRow(result[0]);
}

// Backward-compat alias
export const updateUserTokens = (userId, opts) => updateUserSettings(userId, opts);

// ─── Session queries ──────────────────────────────────────────────────────────

export async function createSession(sessionId, userId, expiresAt) {
    const sql = getDb();
    await sql`INSERT INTO sessions (id, user_id, expires_at) VALUES (${sessionId}, ${userId}, ${expiresAt})`;
}

export async function getSession(sessionId) {
    const sql = getDb();
    const result = await sql`
        SELECT s.*, u.id as user_id, u.email, u.username,
               u.canvas_api_token, u.timetable_link, u.canvas_base_url, u.dashboard_version
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${sessionId} AND s.expires_at > NOW()
        LIMIT 1
    `;
    return decryptUserRow(result[0]) || null;
}

export async function deleteSession(sessionId) {
    const sql = getDb();
    await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
}

export async function cleanupExpiredSessions() {
    const sql = getDb();
    await sql`DELETE FROM sessions WHERE expires_at < NOW()`;
}