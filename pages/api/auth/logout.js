import { getSessionIdFromRequest, clearSessionCookie } from '../../../lib/auth.js';
import { deleteSession } from '../../../lib/db.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

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