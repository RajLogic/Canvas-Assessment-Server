import { fetchDueAssessmentsByTerm } from '../../../lib/canvasApi';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cacheStore = globalThis.__canvasDueCache || new Map();
globalThis.__canvasDueCache = cacheStore;

function getCacheKey(termFilter, onlyActive) {
    return JSON.stringify({
        termFilter: termFilter || '',
        onlyActive: Boolean(onlyActive),
    });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    try {
        const { term, search, q, onlyActive, sync } = req.query;
        const termFilter =
            (typeof search === 'string' && search.trim() ? search.trim() : undefined) ||
            (typeof q === 'string' && q.trim() ? q.trim() : undefined) ||
            (typeof term === 'string' && term.trim() ? term.trim() : undefined);
        const includeOnlyActive = onlyActive !== 'false';
        const forceSync = sync === 'true' || sync === '1';

        const cacheKey = getCacheKey(termFilter, includeOnlyActive);
        const now = Date.now();
        const cachedEntry = cacheStore.get(cacheKey);

        if (!forceSync && cachedEntry && now - cachedEntry.createdAt < CACHE_TTL_MS) {
            return res.status(200).json({
                ...cachedEntry.data,
                _cache: {
                    source: 'server-memory',
                    ageMs: now - cachedEntry.createdAt,
                    ttlMs: CACHE_TTL_MS,
                },
            });
        }

        const result = await fetchDueAssessmentsByTerm({
            termFilter,
            onlyActive: includeOnlyActive,
        });

        cacheStore.set(cacheKey, { data: result, createdAt: now });

        return res.status(200).json({
            ...result,
            _cache: {
                source: 'origin',
                ageMs: 0,
                ttlMs: CACHE_TTL_MS,
            },
        });
    } catch (error) {
        console.error('Fetch due assessments error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}
