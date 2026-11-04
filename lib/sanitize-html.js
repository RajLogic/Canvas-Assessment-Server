import createDOMPurify from 'dompurify';

// Canvas assignment descriptions are third-party HTML, so they must never reach
// dangerouslySetInnerHTML without going through a real HTML parser.
const BRIEF_SANITIZE_CONFIG = {
    ALLOWED_TAGS: ['a', 'br', 'em', 'h2', 'h3', 'h4', 'li', 'ol', 'p', 'strong', 'ul'],
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
};

export function createBriefSanitizer(window) {
    const purify = createDOMPurify(window);

    purify.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'A' && node.hasAttribute('href')) {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        }
    });

    return (description) => (description
        ? purify.sanitize(String(description), BRIEF_SANITIZE_CONFIG)
        : '');
}

let browserSanitizer;

// Fails closed: without a DOM (server rendering) nothing is returned, because
// the HTML cannot be parsed safely there.
export function sanitizeBriefHtml(description) {
    if (typeof window === 'undefined') return '';
    browserSanitizer ??= createBriefSanitizer(window);
    return browserSanitizer(description);
}
