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
        apiKeyConfigured: Boolean((env.API_KEY || env.CANVAS_API_TOKEN || env.CANVAS_TOKEN || env.CANVAS_ACCESS_TOKEN || '').trim()),
        encryptionKeyConfigured: Boolean((env.ENCRYPTION_KEY || '').trim()),
        databaseConfigured: Boolean((env.DATABASE_URL || '').trim()),
    };
}

export function buildSecurityHeaders() {
    const isProduction = (process.env.NODE_ENV || 'development') === 'production';

    return [
        {
            source: '/(.*)',
            headers: [
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
