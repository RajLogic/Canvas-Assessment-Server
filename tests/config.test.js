import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSecurityHeaders, getServerRuntimeConfig } from '../lib/config.js';

test('getServerRuntimeConfig resolves production defaults', () => {
    const config = getServerRuntimeConfig({
        NODE_ENV: 'production',
        PORT: '4000',
        HOST: '0.0.0.0',
        CANVAS_BASE_URL: 'https://example.instructure.com/api/v1/',
    });

    assert.equal(config.nodeEnv, 'production');
    assert.equal(config.port, 4000);
    assert.equal(config.host, '0.0.0.0');
    assert.equal(config.canvasBaseUrl, 'https://example.instructure.com/api/v1/');
});

test('buildSecurityHeaders adds production-safe headers', () => {
    const [rule] = buildSecurityHeaders();
    assert.equal(rule.source, '/(.*)');

    const headers = Object.fromEntries(rule.headers.map((header) => [header.key, header.value]));
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
});
