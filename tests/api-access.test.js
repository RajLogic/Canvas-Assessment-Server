import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';

import { getCanvasAccessError } from '../lib/middleware.js';
import dueHandler from '../pages/api/assessments/due.js';
import exportHandler from '../pages/api/assessments/export.ics.js';
import timetableHandler from '../pages/api/timetable.js';

function createResponse() {
    const res = {
        statusCode: null,
        body: null,
        headers: {},
        setHeader(name, value) { res.headers[name.toLowerCase()] = value; },
        status(code) { res.statusCode = code; return res; },
        json(body) { res.body = body; return res; },
        send(body) { res.body = body; return res; },
        end() { return res; },
    };
    return res;
}

function anonymousRequest(query = {}) {
    return { method: 'GET', headers: {}, query };
}

const savedEnv = {};

before(() => {
    // These would have exposed the owner's data before; they must now be ignored.
    for (const [key, value] of Object.entries({
        API_KEY: 'server-wide-token',
        TIMETABLE_LINK: 'https://example.com/owner.ics',
    })) {
        savedEnv[key] = process.env[key];
        process.env[key] = value;
    }
});

after(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

let fetchMock;

beforeEach(() => {
    fetchMock = mock.method(globalThis, 'fetch', async () => {
        throw new Error('No outbound request should be made');
    });
});

afterEach(() => {
    fetchMock.mock.restore();
});

for (const [name, handler] of [
    ['/api/assessments/due', dueHandler],
    ['/api/assessments/export.ics', exportHandler],
    ['/api/timetable', timetableHandler],
]) {
    test(`${name} rejects anonymous requests even when server-wide secrets are set`, async () => {
        const res = createResponse();
        await handler(anonymousRequest(), res);

        assert.equal(res.statusCode, 401);
        assert.equal(fetchMock.mock.callCount(), 0);
    });

    test(`${name} sends no wildcard CORS header`, async () => {
        const res = createResponse();
        await handler(anonymousRequest(), res);

        assert.equal(res.headers['access-control-allow-origin'], undefined);
    });
}

test('/api/timetable does not fetch a URL supplied in the query string', async () => {
    const res = createResponse();
    await timetableHandler(anonymousRequest({ link: 'https://169.254.169.254/latest/meta-data/' }), res);

    assert.equal(res.statusCode, 401);
    assert.equal(fetchMock.mock.callCount(), 0);
});

test('a signed-in user without a token is sent to setup, not given the server token', () => {
    const error = getCanvasAccessError({ id: 1, canvasApiToken: null });

    assert.equal(error.status, 401);
    assert.equal(error.body.requiresSetup, true);
});

test('a signed-in user with their own token may continue', () => {
    assert.equal(getCanvasAccessError({ id: 1, canvasApiToken: 'their-token' }), null);
});
