import { getAuthUser } from '../../../lib/middleware.js';
import { updateUserSettings } from '../../../lib/db.js';
import { normalizeCanvasBaseUrl, validateCanvasBaseUrl } from '../../../lib/canvas-url.js';

export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'PUT') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const user = await getAuthUser(req);
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized', redirect: '/login' });
    }

    const { canvasApiToken, timetableLink, canvasBaseUrl, dashboardVersion } = req.body || {};

    // ─── Validate Canvas base URL if provided ───
    if (canvasBaseUrl !== undefined && canvasBaseUrl !== null && canvasBaseUrl !== '') {
        const urlError = validateCanvasBaseUrl(canvasBaseUrl);
        if (urlError) {
            return res.status(400).json({ message: urlError });
        }
    }

    // ─── Validate timetable link if provided ───
    if (timetableLink !== undefined && timetableLink !== null && timetableLink !== '') {
        try {
            const parsed = new URL(timetableLink);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return res.status(400).json({ message: 'Timetable link must be a valid http/https URL.' });
            }
        } catch {
            return res.status(400).json({ message: 'Timetable link is not a valid URL.' });
        }
    }

    if (dashboardVersion !== undefined && dashboardVersion !== null && dashboardVersion !== '' && !['base', 'v1'].includes(dashboardVersion)) {
        return res.status(400).json({ message: 'Dashboard version must be either default (base) or old dashboard.' });
    }

    try {
        // Only pass fields that were explicitly included in the request body
        // so we don't accidentally overwrite fields the user didn't touch
        const updatePayload = {};

        if ('canvasApiToken' in (req.body || {})) {
            updatePayload.canvasApiToken = canvasApiToken || null;
        }
        if ('timetableLink' in (req.body || {})) {
            updatePayload.timetableLink = timetableLink || null;
        }
        if ('canvasBaseUrl' in (req.body || {})) {
            let normalised = canvasBaseUrl || null;
            if (normalised) {
                normalised = normalizeCanvasBaseUrl(normalised);
            }
            updatePayload.canvasBaseUrl = normalised;
        }
        if ('dashboardVersion' in (req.body || {})) {
            updatePayload.dashboardVersion = dashboardVersion || null;
        }

        const updated = await updateUserSettings(user.id, updatePayload);

        return res.status(200).json({
            message: 'Settings saved successfully.',
            user: {
                id: updated.id,
                email: updated.email,
                username: updated.username,
                hasCanvasToken: Boolean(updated.canvas_api_token),
                hasTimetableLink: Boolean(updated.timetable_link),
                hasCanvasBaseUrl: Boolean(updated.canvas_base_url),
                dashboardVersion: updated.dashboard_version || null,
                canvasBaseUrl: updated.canvas_base_url || null,
            },
        });
    } catch (err) {
        console.error('Update settings error:', err);
        return res.status(500).json({ message: 'Failed to save settings. ' + (err.message || '') });
    }
}