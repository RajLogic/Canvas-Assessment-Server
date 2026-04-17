import { getSessionIdFromRequest } from './auth.js';
import { getSession } from './db.js';

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
            canvasApiToken: session.canvas_api_token,
            timetableLink: session.timetable_link,
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