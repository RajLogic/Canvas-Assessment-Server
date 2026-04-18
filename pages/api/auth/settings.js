import { getAuthUser } from '../../../lib/middleware.js';
import { updateUserSettings } from '../../../lib/db.js';

// Known Canvas LMS university base URLs for validation hint
const KNOWN_CANVAS_PATTERNS = [
    'instructure.com',
    'canvas.edu',
    'canvaslms.com',
];

function validateCanvasBaseUrl(url) {
    if (!url) return null; // empty = use default, that's fine
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return 'Canvas URL must start with https://';
        }
        if (parsed.protocol !== 'https:') {
            return 'Canvas URL must use HTTPS for security.';
        }
        // Must end in /api/v1/ or /api/v1 so we can append paths cleanly
        const path = parsed.pathname;
        if (!path.includes('/api/v1')) {
            return 'Canvas URL must include /api/v1/ (e.g. https://uni.instructure.com/api/v1/)';
        }
        return null; // valid
    } catch {
        return 'Canvas URL is not a valid URL.';
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'PUT') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const user = await getAuthUser(req);
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized', redirect: '/login' });
    }

    const { canvasApiToken, timetableLink, canvasBaseUrl } = req.body || {};

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
            // Normalise: ensure trailing slash before /api/v1
            let normalised = canvasBaseUrl || null;
            if (normalised) {
                normalised = normalised.trim();
                if (!normalised.endsWith('/')) normalised += '/';
            }
            updatePayload.canvasBaseUrl = normalised;
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
                canvasBaseUrl: updated.canvas_base_url || null,
            },
        });
    } catch (err) {
        console.error('Update settings error:', err);
        return res.status(500).json({ message: 'Failed to save settings. ' + (err.message || '') });
    }
}