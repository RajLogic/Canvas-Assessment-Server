import { getAuthUser } from '../../../lib/middleware.js';
import { DEFAULT_CANVAS_BASE_URL, normalizeCanvasBaseUrl } from '../../../lib/canvas-url.js';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cacheStore = globalThis.__canvasDueCache || new Map();
globalThis.__canvasDueCache = cacheStore;

const ENV_BASE_URL = normalizeCanvasBaseUrl(process.env.CANVAS_BASE_URL, {
    fallback: DEFAULT_CANVAS_BASE_URL,
});

function resolveBaseUrl(user) {
    // Priority: per-user setting → env var default
    return normalizeCanvasBaseUrl(user?.canvasBaseUrl, { fallback: ENV_BASE_URL });
}

function getCacheKey(userId, baseUrl, termFilter, onlyActive) {
    return JSON.stringify({ userId: userId || 'anon', baseUrl, termFilter: termFilter || '', onlyActive: Boolean(onlyActive) });
}

async function fetchPaginated(initialUrl, apiToken) {
    let items = [];
    let url = initialUrl;
    while (url) {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
            const text = await response.text();
            if (response.status === 401) {
                throw new Error('Canvas API token is invalid or expired. Please update it in Settings.');
            }
            throw new Error(`Canvas API error (${response.status}): ${text}`);
        }
        const data = await response.json();
        items = items.concat(data);
        const link = response.headers.get('link');
        const next = link?.match(/<([^>]+)>;\s*rel="next"/);
        url = next ? next[1] : null;
    }
    return items;
}

function isActive(course) {
    const activeEnroll = Array.isArray(course.enrollments) &&
        course.enrollments.some((e) => e.enrollment_state === 'active');
    return activeEnroll || course.workflow_state === 'available';
}

function termName(course) {
    return course?.term?.name || 'Uncategorised Term';
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    const user = await getAuthUser(req);
    const apiToken = user?.canvasApiToken || process.env.API_KEY || '';
    const canvasBaseUrl = resolveBaseUrl(user);

    if (!apiToken) {
        return res.status(401).json({
            message: 'No Canvas API token configured. Please add your token in Settings.',
            requiresSetup: true,
        });
    }

    try {
        const { term, search, q, onlyActive, sync } = req.query;
        const termFilter =
            (typeof search === 'string' && search.trim() ? search.trim() : undefined) ||
            (typeof q === 'string' && q.trim() ? q.trim() : undefined) ||
            (typeof term === 'string' && term.trim() ? term.trim() : undefined);
        const includeOnlyActive = onlyActive !== 'false';
        const forceSync = sync === 'true' || sync === '1';

        const cacheKey = getCacheKey(user?.id, canvasBaseUrl, termFilter, includeOnlyActive);
        const now = Date.now();
        const cached = cacheStore.get(cacheKey);

        if (!forceSync && cached && now - cached.createdAt < CACHE_TTL_MS) {
            return res.status(200).json({
                ...cached.data,
                _cache: { source: 'server-memory', ageMs: now - cached.createdAt, ttlMs: CACHE_TTL_MS },
            });
        }

        const coursesUrl = `${canvasBaseUrl}courses?per_page=100&include[]=enrollments&include[]=term&enrollment_state[]=active&enrollment_state[]=completed&enrollment_state[]=past`;
        const allCourses = await fetchPaginated(coursesUrl, apiToken);
        const courses = includeOnlyActive ? allCourses.filter(isActive) : allCourses;
        const currentTime = Date.now();
        const normalizedFilter = termFilter?.toLowerCase().trim();

        const assignmentResults = await Promise.allSettled(
            courses.map(async (course) => {
                const assignments = await fetchPaginated(
                    `${canvasBaseUrl}courses/${course.id}/assignments?per_page=100&include[]=submission`,
                    apiToken
                );
                return { course, assignments };
            })
        );

        const dueAssessments = assignmentResults
            .filter((r) => r.status === 'fulfilled')
            .flatMap((r) => {
                const { course, assignments } = r.value;
                const term = termName(course);
                return assignments
                    .filter((a) => a?.due_at)
                    .map((a) => {
                        const dueAt = new Date(a.due_at);
                        return {
                            id: a.id, name: a.name, dueAt: a.due_at,
                            dueTimestamp: dueAt.getTime(), htmlUrl: a.html_url,
                            pointsPossible: a.points_possible, courseId: course.id,
                            hasSubmitted: Boolean(a.has_submitted_submissions),
                            grade: a?.submission?.grade ?? null,
                            score: a?.submission?.score ?? null,
                            submittedAt: a?.submission?.submitted_at ?? null,
                            description: a?.description ?? null,
                            rubricUrl: a?.html_url ? `${a.html_url}#rubric` : null,
                            submissionTypes: Array.isArray(a?.submission_types) ? a.submission_types : [],
                            courseName: course.name, termName: term,
                        };
                    })
                    .filter((a) => a.dueTimestamp >= currentTime);
            })
            .filter((a) => {
                if (!normalizedFilter) return true;
                return [a.termName, a.courseName, a.name].some((v) =>
                    (v || '').toLowerCase().includes(normalizedFilter)
                );
            })
            .sort((a, b) => a.dueTimestamp - b.dueTimestamp);

        const groupedByTerm = dueAssessments.reduce((acc, a) => {
            if (!acc[a.termName]) acc[a.termName] = {};
            if (!acc[a.termName][a.courseName]) acc[a.termName][a.courseName] = [];
            acc[a.termName][a.courseName].push(a);
            return acc;
        }, {});

        const terms = Object.entries(groupedByTerm).map(([tName, courseMap]) => {
            const coursesInTerm = Object.entries(courseMap).map(([cName, assessments]) => ({
                courseName: cName, courseId: assessments[0].courseId,
                totalAssessments: assessments.length, assessments,
            }));
            coursesInTerm.sort((a, b) =>
                (a.assessments[0]?.dueTimestamp || Infinity) - (b.assessments[0]?.dueTimestamp || Infinity)
            );
            return {
                termName: tName,
                totalAssessments: coursesInTerm.reduce((s, c) => s + c.totalAssessments, 0),
                courses: coursesInTerm,
            };
        });

        terms.sort((a, b) =>
            (a.courses[0]?.assessments[0]?.dueTimestamp || Infinity) -
            (b.courses[0]?.assessments[0]?.dueTimestamp || Infinity)
        );

        const result = {
            generatedAt: new Date().toISOString(),
            totalAssessments: dueAssessments.length,
            totalTerms: terms.length,
            canvasBaseUrl,
            terms,
        };

        cacheStore.set(cacheKey, { data: result, createdAt: now });
        return res.status(200).json({ ...result, _cache: { source: 'origin', ageMs: 0, ttlMs: CACHE_TTL_MS } });

    } catch (error) {
        console.error('Fetch due assessments error:', error);
        return res.status(500).json({ message: error.message || 'Internal server error' });
    }
}