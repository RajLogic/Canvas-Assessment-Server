import { DEFAULT_CANVAS_BASE_URL, normalizeCanvasBaseUrl } from './canvas-url.js';

export function getServerRuntimeConfig(overrides = {}) {
    const env = { ...process.env, ...overrides };

    return {
        nodeEnv: env.NODE_ENV || 'development',
        port: Number.parseInt(env.PORT || '3000', 10),
        host: env.HOST || '0.0.0.0',
        canvasBaseUrl: normalizeCanvasBaseUrl(env.CANVAS_BASE_URL, {
            fallback: DEFAULT_CANVAS_BASE_URL,
        }),
        encryptionKeyConfigured: Boolean((env.ENCRYPTION_KEY || '').trim()),
        databaseConfigured: Boolean((env.DATABASE_URL || '').trim()),
    };
}

export function buildContentSecurityPolicy({ isProduction }) {
    return [
        "default-src 'self'",
        // Production stays strict, which relies on the --webpack flag in package.json:
        // Turbopack adds an inline script to every page that this policy would block.
        // The development server needs inline scripts and eval for hot reloading.
        `script-src 'self'${isProduction ? '' : " 'unsafe-inline' 'unsafe-eval'"}`,
        // Inline style attributes are used throughout; Google Fonts supplies the typefaces.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        `connect-src 'self'${isProduction ? '' : ' ws:'}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ].join('; ');
}

export function buildSecurityHeaders() {
    const isProduction = (process.env.NODE_ENV || 'development') === 'production';

    return [
        {
            source: '/(.*)',
            headers: [
                { key: 'Content-Security-Policy', value: buildContentSecurityPolicy({ isProduction }) },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                ...(isProduction
                    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
                    : []),
            ],
        },
    ];
}
