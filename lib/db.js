import { neon } from '@neondatabase/serverless';

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
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
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

export async function getUserByEmail(email) {
    const sql = getDb();
    const result = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
    return result[0] || null;
}

export async function getUserByUsername(username) {
    const sql = getDb();
    const result = await sql`SELECT * FROM users WHERE username = ${username.trim()} LIMIT 1`;
    return result[0] || null;
}

export async function getUserById(id) {
    const sql = getDb();
    const result = await sql`SELECT id, email, username, canvas_api_token, timetable_link, created_at FROM users WHERE id = ${id} LIMIT 1`;
    return result[0] || null;
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

export async function updateUserTokens(userId, { canvasApiToken, timetableLink }) {
    const sql = getDb();
    const result = await sql`
        UPDATE users
        SET canvas_api_token = ${canvasApiToken || null},
            timetable_link = ${timetableLink || null},
            updated_at = NOW()
        WHERE id = ${userId}
        RETURNING id, email, username, canvas_api_token, timetable_link
    `;
    return result[0];
}

export async function createSession(sessionId, userId, expiresAt) {
    const sql = getDb();
    await sql`
        INSERT INTO sessions (id, user_id, expires_at)
        VALUES (${sessionId}, ${userId}, ${expiresAt})
    `;
}

export async function getSession(sessionId) {
    const sql = getDb();
    const result = await sql`
        SELECT s.*, u.id as user_id, u.email, u.username, u.canvas_api_token, u.timetable_link
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${sessionId}
          AND s.expires_at > NOW()
        LIMIT 1
    `;
    return result[0] || null;
}

export async function deleteSession(sessionId) {
    const sql = getDb();
    await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
}

export async function cleanupExpiredSessions() {
    const sql = getDb();
    await sql`DELETE FROM sessions WHERE expires_at < NOW()`;
}