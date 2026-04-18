import crypto from 'node:crypto';

// ─── AES-256-GCM Field Encryption ────────────────────────────────────────────
// Used to encrypt sensitive user data (Canvas API token, timetable link, Canvas
// base URL) before storing in the database. Requires ENCRYPTION_KEY env variable.
//
// Format stored in DB:  v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
//
// Key derivation: the raw ENCRYPTION_KEY (any length) is hashed through SHA-256
// to produce a stable 32-byte key, so you can use any memorable secret string.

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;   // 96-bit IV — GCM standard
const TAG_BYTES = 16;  // 128-bit auth tag

function getDerivedKey() {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw || raw.trim().length < 16) {
        throw new Error(
            'ENCRYPTION_KEY environment variable is missing or too short. ' +
            'Set a random string of at least 32 characters in your .env.local and Vercel settings.'
        );
    }
    // SHA-256 the raw key → always a 32-byte Buffer regardless of input length
    return crypto.createHash('sha256').update(raw.trim()).digest();
}

/**
 * Encrypt a plaintext string. Returns a compact tagged string safe for DB storage.
 * Returns null if value is null/empty.
 */
export function encryptField(plaintext) {
    if (!plaintext) return null;
    const key = getDerivedKey();
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const cipherBuf = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${cipherBuf.toString('hex')}`;
}

/**
 * Decrypt a value produced by encryptField. Returns the original plaintext.
 * Returns null if value is null/empty. Throws on tampered data (auth tag mismatch).
 */
export function decryptField(stored) {
    if (!stored) return null;

    // Legacy values (stored before encryption was introduced) are passed through
    // unchanged — they won't start with "v1:" so we detect them here.
    if (!stored.startsWith('v1:')) {
        return stored; // plain-text legacy value — return as-is, will be re-encrypted on next save
    }

    const parts = stored.split(':');
    if (parts.length !== 4) throw new Error('Invalid encrypted field format.');

    const [, ivHex, tagHex, cipherHex] = parts;
    const key = getDerivedKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const cipherBuf = Buffer.from(cipherHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const plainBuf = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
    return plainBuf.toString('utf8');
}

/**
 * Safely decrypt a field — returns null instead of throwing if decryption fails.
 * Use this when a missing/corrupt value should be treated as "not set" rather
 * than a fatal error.
 */
export function safeDecryptField(stored) {
    try {
        return decryptField(stored);
    } catch {
        return null;
    }
}