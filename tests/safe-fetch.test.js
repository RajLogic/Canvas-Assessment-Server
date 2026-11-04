import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getUnsafeUrlReason,
    guardedLookup,
    isPrivateAddress,
    safeHttpsGet,
    UnsafeUrlError,
} from '../lib/safe-fetch.js';

test('treats internal addresses as private', () => {
    const privateAddresses = [
        '127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254',
        '100.64.0.1', '0.0.0.0', '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1',
        '::ffff:127.0.0.1', '::ffff:169.254.169.254', 'not-an-ip',
    ];
    for (const address of privateAddresses) {
        assert.equal(isPrivateAddress(address), true, address);
    }
});

test('treats public addresses as public', () => {
    for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
        assert.equal(isPrivateAddress(address), false, address);
    }
});

test('rejects URLs that are unsafe to fetch', () => {
    const unsafeUrls = [
        'not a url',
        'http://example.com/calendar.ics',
        'file:///etc/passwd',
        'ftp://example.com/calendar.ics',
        'https://user:secret@example.com/calendar.ics',
        'https://example.com:8443/calendar.ics',
        'https://localhost/calendar.ics',
        'https://LOCALHOST./calendar.ics',
        'https://app.localhost/calendar.ics',
        'https://127.0.0.1/calendar.ics',
        'https://2130706433/calendar.ics', // 127.0.0.1 written as a decimal number
        'https://0x7f.0.0.1/calendar.ics',
        'https://169.254.169.254/latest/meta-data/',
        'https://[::1]/calendar.ics',
        'https://[::ffff:127.0.0.1]/calendar.ics',
    ];
    for (const url of unsafeUrls) {
        assert.equal(typeof getUnsafeUrlReason(url), 'string', url);
    }
});

test('accepts ordinary public HTTPS URLs', () => {
    const safeUrls = [
        'https://mytimetable.rmit.edu.au/even/rest/calendar/ical/abc',
        'https://rmit.instructure.com/api/v1/',
        'https://example.com:443/calendar.ics',
    ];
    for (const url of safeUrls) {
        assert.equal(getUnsafeUrlReason(url), null, url);
    }
});

test('safeHttpsGet refuses an unsafe URL before connecting', async () => {
    await assert.rejects(safeHttpsGet('https://127.0.0.1/secret'), UnsafeUrlError);
    await assert.rejects(safeHttpsGet('http://example.com/'), UnsafeUrlError);
});

test('the connection-time lookup blocks hostnames that resolve to private addresses', async () => {
    const error = await new Promise((resolve) => {
        guardedLookup('localhost', {}, (lookupError) => resolve(lookupError));
    });
    assert.ok(error instanceof UnsafeUrlError);
});
