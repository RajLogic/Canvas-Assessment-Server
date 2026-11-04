import dns from 'node:dns';
import https from 'node:https';
import net from 'node:net';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

const BLOCKED_IPV4_SUBNETS = [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
    ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
    ['224.0.0.0', 4], ['240.0.0.0', 4],
];

const BLOCKED_IPV6_SUBNETS = [
    ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['2001:db8::', 32],
    ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
];

const blockedAddresses = new net.BlockList();
for (const [address, prefix] of BLOCKED_IPV4_SUBNETS) blockedAddresses.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of BLOCKED_IPV6_SUBNETS) blockedAddresses.addSubnet(address, prefix, 'ipv6');

export class UnsafeUrlError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnsafeUrlError';
    }
}

export function isPrivateAddress(address) {
    const family = net.isIP(address);
    if (family === 0) return true; // Anything unrecognised is not safe to connect to.
    return blockedAddresses.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

/**
 * Checks a user-supplied URL without touching the network. Returns an error
 * message, or null when the URL may be attempted. Hostnames that only resolve
 * to private addresses are caught at connection time by safeHttpsGet.
 */
export function getUnsafeUrlReason(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        return 'URL is not valid.';
    }

    if (url.protocol !== 'https:') return 'URL must start with https://';
    if (url.username || url.password) return 'URL must not contain a username or password.';
    if (url.port && url.port !== '443') return 'URL must use the standard HTTPS port.';

    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        return 'URL must point to a public address.';
    }
    if (net.isIP(hostname) && isPrivateAddress(hostname)) {
        return 'URL must point to a public address.';
    }

    return null;
}

// Runs for every connection, so a hostname cannot pass an earlier check and then
// re-resolve to an internal address (DNS rebinding).
export function guardedLookup(hostname, options, callback) {
    dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
        if (error) return callback(error);
        if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
            return callback(new UnsafeUrlError('URL must point to a public address.'));
        }
        if (options.all) return callback(null, addresses);
        return callback(null, addresses[0].address, addresses[0].family);
    });
}

/**
 * GET a user-supplied URL with SSRF protections: HTTPS only, public addresses
 * only, redirects not followed, and limits on response size and duration.
 * Resolves with { status, statusText, redirected, body }.
 */
export function safeHttpsGet(rawUrl, {
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
} = {}) {
    const unsafeReason = getUnsafeUrlReason(rawUrl);
    if (unsafeReason) return Promise.reject(new UnsafeUrlError(unsafeReason));

    return new Promise((resolve, reject) => {
        const request = https.get(rawUrl, {
            headers,
            lookup: guardedLookup,
            signal: AbortSignal.timeout(timeoutMs),
        }, (response) => {
            const status = response.statusCode;
            if (status >= 300 && status < 400) {
                response.resume();
                resolve({ status, statusText: response.statusMessage, redirected: true, body: '' });
                return;
            }

            const chunks = [];
            let receivedBytes = 0;
            response.on('data', (chunk) => {
                receivedBytes += chunk.length;
                if (receivedBytes > maxBytes) {
                    request.destroy(new Error('Response is too large.'));
                    return;
                }
                chunks.push(chunk);
            });
            response.on('error', reject);
            response.on('end', () => {
                resolve({
                    status,
                    statusText: response.statusMessage,
                    redirected: false,
                    body: Buffer.concat(chunks).toString('utf8'),
                });
            });
        });
        request.on('error', reject);
    });
}
