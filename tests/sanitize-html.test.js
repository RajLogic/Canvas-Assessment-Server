import assert from 'node:assert/strict';
import test from 'node:test';

import { JSDOM } from 'jsdom';

import { createBriefSanitizer, sanitizeBriefHtml } from '../lib/sanitize-html.js';

const sanitize = createBriefSanitizer(new JSDOM('').window);

const attackPayloads = [
    '<img src=x onerror=alert(1)>',
    '<img/src=x onerror=alert(1)>',
    '<img/src="x"/onerror=alert(1)>',
    '<svg/onload=alert(1)>',
    '<script>alert(1)</script>',
    '<p onclick="alert(1)">text</p>',
    '<a href="javascript:alert(1)">link</a>',
    '<a href="JaVaScRiPt:alert(1)">link</a>',
    '<a href="data:text/html,<script>alert(1)</script>">link</a>',
    '<iframe src="https://example.com"></iframe>',
    '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
];

for (const payload of attackPayloads) {
    test(`removes active content from ${payload}`, () => {
        const parsed = new JSDOM(`<body>${sanitize(payload)}</body>`).window.document;

        assert.equal(parsed.querySelector('img, svg, script, iframe, math, style'), null);
        for (const element of parsed.body.querySelectorAll('*')) {
            for (const attribute of element.attributes) {
                assert.ok(!attribute.name.startsWith('on'), `kept handler ${attribute.name}`);
            }
            const href = element.getAttribute('href');
            if (href) assert.match(href, /^(?:https?:|mailto:)/i);
        }
    });
}

test('keeps the formatting allowed in assignment briefs', () => {
    const html = '<h2>Task</h2><p>Read <strong>this</strong> and <em>that</em>.<br></p><ul><li>One</li></ul>';
    assert.equal(sanitize(html), html);
});

test('keeps the text of tags that are not allowed', () => {
    assert.equal(sanitize('<div><span>Hello</span></div>'), 'Hello');
});

test('opens safe links in a new tab without exposing the opener', () => {
    const link = new JSDOM(sanitize('<a href="https://example.com/a" onclick="x()">Go</a>'))
        .window.document.querySelector('a');

    assert.equal(link.getAttribute('href'), 'https://example.com/a');
    assert.equal(link.getAttribute('target'), '_blank');
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(link.hasAttribute('onclick'), false);
});

test('returns an empty string when there is no description', () => {
    assert.equal(sanitize(null), '');
    assert.equal(sanitize(''), '');
});

test('returns nothing when no DOM is available to parse with', () => {
    assert.equal(sanitizeBriefHtml('<p>Hello</p>'), '');
});
