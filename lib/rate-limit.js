const buckets = globalThis.__authRateLimitBuckets || new Map();
globalThis.__authRateLimitBuckets = buckets;

function cleanupBucket(bucket, now, windowMs) {
    while (bucket.length > 0 && now - bucket[0] > windowMs) {
        bucket.shift();
    }
}

export function getRequestIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
}

export function takeRateLimitToken({ key, limit, windowMs }) {
    const now = Date.now();
    const bucket = buckets.get(key) || [];

    cleanupBucket(bucket, now, windowMs);

    if (bucket.length >= limit) {
        const retryAfterMs = windowMs - (now - bucket[0]);
        buckets.set(key, bucket);
        return {
            allowed: false,
            remaining: 0,
            retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        };
    }

    bucket.push(now);
    buckets.set(key, bucket);

    return {
        allowed: true,
        remaining: Math.max(0, limit - bucket.length),
        retryAfterSec: 0,
    };
}

export function setRateLimitHeaders(res, { limit, remaining, retryAfterSec }) {
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    if (retryAfterSec > 0) {
        res.setHeader('Retry-After', String(retryAfterSec));
    }
}
