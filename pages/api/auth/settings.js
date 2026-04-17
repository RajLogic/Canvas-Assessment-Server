import { getAuthUser } from '../../../lib/middleware.js';
import { updateUserTokens } from '../../../lib/db.js';

export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'PUT') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const user = await getAuthUser(req);
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized', redirect: '/login' });
    }

    const { canvasApiToken, timetableLink } = req.body || {};

    try {
        const updated = await updateUserTokens(user.id, {
            canvasApiToken: canvasApiToken || null,
            timetableLink: timetableLink || null,
        });

        return res.status(200).json({
            message: 'Settings saved.',
            user: {
                id: updated.id,
                email: updated.email,
                username: updated.username,
                hasCanvasToken: Boolean(updated.canvas_api_token),
                hasTimetableLink: Boolean(updated.timetable_link),
            },
        });
    } catch (err) {
        console.error('Update settings error:', err);
        return res.status(500).json({ message: 'Failed to save settings.' });
    }
}