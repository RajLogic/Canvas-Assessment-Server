import { getSessionIdFromRequest } from '../../../lib/auth.js';
import { getSession } from '../../../lib/db.js';
import { endSession } from '../../../lib/middleware.js';
import { DEFAULT_CANVAS_BASE_URL, normalizeCanvasBaseUrl } from '../../../lib/canvas-url.js';

export default async function handler(req, res) {
    if (req.method === 'POST') {
        return endSession(req, res);
    }

    if (req.method === 'GET') {
        const sessionId = getSessionIdFromRequest(req);
        if (!sessionId) return res.status(401).json({ authenticated: false });
        try {
            const session = await getSession(sessionId);
            if (!session) return res.status(401).json({ authenticated: false });

            const envBaseUrl = normalizeCanvasBaseUrl(process.env.CANVAS_BASE_URL, {
                fallback: DEFAULT_CANVAS_BASE_URL,
            });

            return res.status(200).json({
                authenticated: true,
                user: {
                    id: session.user_id,
                    email: session.email,
                    username: session.username,
                    hasCanvasToken: Boolean(session.canvas_api_token),
                    hasTimetableLink: Boolean(session.timetable_link),
                    hasCanvasBaseUrl: Boolean(session.canvas_base_url),
                    dashboardVersion: session.dashboard_version || null,
                    // Return the resolved URL the client can display, but NOT the raw token
                    canvasBaseUrl: session.canvas_base_url || envBaseUrl,
                },
            });
        } catch (err) {
            console.error('Session check error:', err);
            return res.status(500).json({ authenticated: false });
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
}