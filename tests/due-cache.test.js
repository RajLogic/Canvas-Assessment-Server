import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import {
    buildDueCacheKey,
    clearDueCacheForUser,
    createEmptyCacheEntry,
    DUE_CACHE_MAX_ENTRIES,
    getDueCacheEntry,
    getDueCacheSize,
    setDueCacheEntry,
} from '../lib/due-cache.js';

const baseUrl = 'https://example.instructure.com/api/v1/';

beforeEach(() => {
    globalThis.__canvasDueCache.clear();
});

test('keeps each user and view in a separate entry', () => {
    const keys = new Set([
        buildDueCacheKey({ userId: 1, baseUrl, onlyActive: true }),
        buildDueCacheKey({ userId: 1, baseUrl, onlyActive: false }),
        buildDueCacheKey({ userId: 2, baseUrl, onlyActive: true }),
    ]);
    assert.equal(keys.size, 3);
});

test('clearing a user removes only that user, even with similar ids', () => {
    const userOne = buildDueCacheKey({ userId: 1, baseUrl, onlyActive: true });
    const userOneAll = buildDueCacheKey({ userId: 1, baseUrl, onlyActive: false });
    const userEleven = buildDueCacheKey({ userId: 11, baseUrl, onlyActive: true });
    for (const key of [userOne, userOneAll, userEleven]) setDueCacheEntry(key, createEmptyCacheEntry());

    clearDueCacheForUser(1);

    assert.equal(getDueCacheEntry(userOne), undefined);
    assert.equal(getDueCacheEntry(userOneAll), undefined);
    assert.ok(getDueCacheEntry(userEleven));
});

test('never grows past the maximum, evicting the least recently used entry', () => {
    const keyFor = (userId) => buildDueCacheKey({ userId, baseUrl, onlyActive: true });
    for (let userId = 0; userId < DUE_CACHE_MAX_ENTRIES; userId += 1) {
        setDueCacheEntry(keyFor(userId), createEmptyCacheEntry());
    }

    getDueCacheEntry(keyFor(0)); // User 0 is now recently used, so user 1 is the oldest.
    setDueCacheEntry(keyFor('new'), createEmptyCacheEntry());

    assert.equal(getDueCacheSize(), DUE_CACHE_MAX_ENTRIES);
    assert.ok(getDueCacheEntry(keyFor(0)));
    assert.equal(getDueCacheEntry(keyFor(1)), undefined);
});

test('new cache entries have nowhere to hold a token', () => {
    assert.deepEqual(Object.keys(createEmptyCacheEntry()).sort(), [
        'createdAt', 'data', 'error', 'isRefreshing', 'updatedAt',
    ]);
});
