import { getSessionIdFromRequest, clearSessionCookie } from '../../../lib/auth.js';
import { deleteSession, getSession } from '../../../lib/db.js';

export default async function handler(req, res) {
    if (req.method === 'POST') {
        // Logout
        const sessionId = getSessionIdFromRequest(req);
        if (sessionId) {
            try {
                await deleteSession(sessionId);
            } catch {
                // Ignore DB errors on logout
            }
        }
        clearSessionCookie(res);
        return res.status(200).json({ message: 'Logged out successfully.' });
    }

    if (req.method === 'GET') {
        // Check current session
        const sessionId = getSessionIdFromRequest(req);
        if (!sessionId) {
            return res.status(401).json({ authenticated: false });
        }
        try {
            const session = await getSession(sessionId);
            if (!session) {
                return res.status(401).json({ authenticated: false });
            }
            return res.status(200).json({
                authenticated: true,
                user: {
                    id: session.user_id,
                    email: session.email,
                    username: session.username,
                    hasCanvasToken: Boolean(session.canvas_api_token),
                    hasTimetableLink: Boolean(session.timetable_link),
                },
            });
        } catch (err) {
            console.error('Session check error:', err);
            return res.status(500).json({ authenticated: false });
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
}