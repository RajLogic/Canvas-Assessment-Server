import { clearSessionCookie, getSessionIdFromRequest } from './auth.js';
import { deleteSession, getSession } from './db.js';
import { clearDueCacheForUser } from './due-cache.js';

export async function getAuthUser(req) {
    try {
        const sessionId = getSessionIdFromRequest(req);
        if (!sessionId) return null;
        const session = await getSession(sessionId);
        if (!session) return null;
        return {
            id: session.user_id,
            email: session.email,
            username: session.username,
            canvasApiToken: session.canvas_api_token,  // already decrypted by db.js
            timetableLink: session.timetable_link,    // already decrypted by db.js
            canvasBaseUrl: session.canvas_base_url,   // already decrypted by db.js
        };
    } catch {
        return null;
    }
}

export function requireAuth(handler) {
    return async (req, res) => {
        const user = await getAuthUser(req);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized', redirect: '/login' });
        }
        req.user = user;
        return handler(req, res);
    };
}

/**
 * Canvas data is only ever read with the signed-in user's own token. Returns the
 * error response to send, or null when the user may continue.
 */
export function getCanvasAccessError(user) {
    if (!user) {
        return { status: 401, body: { message: 'Unauthorized', redirect: '/login' } };
    }
    if (!user.canvasApiToken) {
        return {
            status: 401,
            body: {
                message: 'No Canvas API token configured. Please add your token in Settings.',
                requiresSetup: true,
            },
        };
    }
    return null;
}

export async function endSession(req, res) {
    const sessionId = getSessionIdFromRequest(req);
    if (sessionId) {
        try {
            const session = await getSession(sessionId);
            clearDueCacheForUser(session?.user_id);
            await deleteSession(sessionId);
        } catch {
            // The cookie is still cleared below if the database is unavailable.
        }
    }
    clearSessionCookie(res);
    return res.status(200).json({ message: 'Logged out successfully.' });
}
