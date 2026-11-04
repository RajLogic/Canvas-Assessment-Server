// In-process cache of each user's Canvas assessments. Entries hold assessment
// data only: Canvas tokens must never be stored here.
const CACHE_VERSION = 4;
export const DUE_CACHE_MAX_ENTRIES = 500;

const cacheStore = globalThis.__canvasDueCache || new Map();
globalThis.__canvasDueCache = cacheStore;

function userKeyPrefix(userId) {
    return `v${CACHE_VERSION}:${userId}:`;
}

export function buildDueCacheKey({ userId, baseUrl, onlyActive }) {
    return `${userKeyPrefix(userId)}${onlyActive ? 'active' : 'all'}:${baseUrl}`;
}

export function createEmptyCacheEntry() {
    return {
        data: null,
        createdAt: 0,
        updatedAt: 0,
        isRefreshing: false,
        error: null,
    };
}

// Reading or writing an entry moves it to the end of the Map's insertion order,
// so the first key is always the least recently used.
export function getDueCacheEntry(key) {
    const entry = cacheStore.get(key);
    if (entry) {
        cacheStore.delete(key);
        cacheStore.set(key, entry);
    }
    return entry;
}

export function setDueCacheEntry(key, entry) {
    cacheStore.delete(key);
    cacheStore.set(key, entry);
    while (cacheStore.size > DUE_CACHE_MAX_ENTRIES) {
        cacheStore.delete(cacheStore.keys().next().value);
    }
}

export function clearDueCacheForUser(userId) {
    if (userId === undefined || userId === null) return;
    const prefix = userKeyPrefix(userId);
    for (const key of cacheStore.keys()) {
        if (key.startsWith(prefix)) cacheStore.delete(key);
    }
}

export function getDueCacheSize() {
    return cacheStore.size;
}
