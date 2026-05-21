import { getAuthUser } from '../../../lib/middleware.js';
import { updateUserSettings } from '../../../lib/db.js';
import { normalizeCanvasBaseUrl, validateCanvasBaseUrl } from '../../../lib/canvas-url.js';

function validateCanvasBaseUrlField(canvasBaseUrl) {
    if (canvasBaseUrl !== undefined && canvasBaseUrl !== null && canvasBaseUrl !== '') {
        const urlError = validateCanvasBaseUrl(canvasBaseUrl);
        if (urlError) {
            return urlError;
        }
    }
    return null;
}

function validateTimetableLinkField(timetableLink) {
    if (timetableLink !== undefined && timetableLink !== null && timetableLink !== '') {
        try {
            const parsed = new URL(timetableLink);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return 'Timetable link must be a valid http/https URL.';
            }
        } catch {
            return 'Timetable link is not a valid URL.';
        }
    }
    return null;
}

function validateDashboardVersionField(dashboardVersion) {
    if (dashboardVersion !== undefined && dashboardVersion !== null && dashboardVersion !== '' && !['base', 'v1'].includes(dashboardVersion)) {
        return 'Dashboard version must be either default (base) or old dashboard.';
    }
    return null;
}

function buildUpdatePayload(body, canvasBaseUrl) {
    const updatePayload = {};

    if ('canvasApiToken' in (body || {})) {
        updatePayload.canvasApiToken = body.canvasApiToken || null;
    }
    if ('timetableLink' in (body || {})) {
        updatePayload.timetableLink = body.timetableLink || null;
    }
    if ('canvasBaseUrl' in (body || {})) {
        let normalised = canvasBaseUrl || null;
        if (normalised) {
            normalised = normalizeCanvasBaseUrl(normalised);
        }
        updatePayload.canvasBaseUrl = normalised;
    }
    if ('dashboardVersion' in (body || {})) {
        updatePayload.dashboardVersion = body.dashboardVersion || null;
    }

    return updatePayload;
}

export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'PUT') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const user = await getAuthUser(req);
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized', redirect: '/login' });
    }

    const { timetableLink, canvasBaseUrl, dashboardVersion } = req.body || {};

    const canvasBaseUrlError = validateCanvasBaseUrlField(canvasBaseUrl);
    if (canvasBaseUrlError) {
        return res.status(400).json({ message: canvasBaseUrlError });
    }

    const timetableLinkError = validateTimetableLinkField(timetableLink);
    if (timetableLinkError) {
        return res.status(400).json({ message: timetableLinkError });
    }

    const dashboardVersionError = validateDashboardVersionField(dashboardVersion);
    if (dashboardVersionError) {
        return res.status(400).json({ message: dashboardVersionError });
    }

    try {
        const updatePayload = buildUpdatePayload(req.body, canvasBaseUrl);
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