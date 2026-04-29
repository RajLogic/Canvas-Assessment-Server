export const DEFAULT_CANVAS_BASE_URL = 'https://rmit.instructure.com/api/v1/';

function ensureTrailingSlash(value) {
    return value.endsWith('/') ? value : `${value}/`;
}

export function validateCanvasBaseUrl(url) {
    if (!url) return null;

    let parsed;
    try {
        parsed = new URL(url.trim());
    } catch {
        return 'Canvas URL is not a valid URL.';
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return 'Canvas URL must start with https://';
    }

    if (parsed.protocol !== 'https:') {
        return 'Canvas URL must use HTTPS for security.';
    }

    if (!parsed.pathname.includes('/api/v1')) {
        return 'Canvas URL must include /api/v1/ (e.g. https://uni.instructure.com/api/v1/)';
    }

    return null;
}

export function normalizeCanvasBaseUrl(url, { fallback = DEFAULT_CANVAS_BASE_URL } = {}) {
    const source = (url || fallback || '').toString().trim();
    if (!source) return DEFAULT_CANVAS_BASE_URL;

    let parsed;
    try {
        parsed = new URL(source);
    } catch {
        return ensureTrailingSlash(DEFAULT_CANVAS_BASE_URL);
    }

    const apiIndex = parsed.pathname.indexOf('/api/v1');
    if (apiIndex === -1) {
        parsed.pathname = '/api/v1/';
    } else {
        parsed.pathname = `${parsed.pathname.slice(0, apiIndex)}/api/v1/`;
    }

    parsed.search = '';
    parsed.hash = '';

    return ensureTrailingSlash(parsed.toString());
}
