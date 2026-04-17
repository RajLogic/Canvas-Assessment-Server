import { getAuthUser } from '../../../lib/middleware.js';
import crypto from 'node:crypto';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cacheStore = globalThis.__canvasDueCache || new Map();
globalThis.__canvasDueCache = cacheStore;

const rawBaseUrl = process.env.CANVAS_BASE_URL || 'https://rmit.instructure.com/api/v1/';
const canvasBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl : `${rawBaseUrl}/`;

function getCacheKey(userId, termFilter, onlyActive) {
    return JSON.stringify({ userId, termFilter: termFilter || '', onlyActive: Boolean(onlyActive) });
}

async function fetchPaginatedCanvasResource(initialUrl, apiToken) {
    let items = [];
    let url = initialUrl;

    while (url) {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401) {
                throw new Error(`Canvas API unauthorized (401): invalid or expired token. Please update your Canvas API token in Settings.`);
            }
            throw new Error(`Canvas API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        items = items.concat(data);

        const linkHeader = response.headers.get('link');
        const nextPageMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
        url = nextPageMatch ? nextPageMatch[1] : null;
    }

    return items;
}

function isActiveCourse(course) {
    const hasActiveEnrollment = Array.isArray(course.enrollments) &&
        course.enrollments.some((e) => e.enrollment_state === 'active');
    return hasActiveEnrollment || course.workflow_state === 'available';
}

function getTermName(course) {
    return course?.term?.name || 'Uncategorized Term';
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    // Determine API token: per-user (from session) or server-wide env fallback
    const user = await getAuthUser(req);
    const apiToken = user?.canvasApiToken || process.env.API_KEY || '';

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

        const cacheKey = getCacheKey(user?.id || 'anon', termFilter, includeOnlyActive);
        const now = Date.now();
        const cachedEntry = cacheStore.get(cacheKey);

        if (!forceSync && cachedEntry && now - cachedEntry.createdAt < CACHE_TTL_MS) {
            return res.status(200).json({
                ...cachedEntry.data,
                _cache: { source: 'server-memory', ageMs: now - cachedEntry.createdAt, ttlMs: CACHE_TTL_MS },
            });
        }

        const url = `${canvasBaseUrl}courses?per_page=100&include[]=enrollments&include[]=term&enrollment_state[]=active&enrollment_state[]=completed&enrollment_state[]=past`;
        const allCourses = await fetchPaginatedCanvasResource(url, apiToken);
        const courses = includeOnlyActive ? allCourses.filter(isActiveCourse) : allCourses;
        const currentTime = Date.now();
        const normalizedFilter = termFilter?.toLowerCase().trim();

        const assignmentResults = await Promise.allSettled(
            courses.map(async (course) => {
                const assignments = await fetchPaginatedCanvasResource(
                    `${canvasBaseUrl}courses/${course.id}/assignments?per_page=100`,
                    apiToken
                );
                return { course, assignments };
            })
        );

        const dueAssessments = assignmentResults
            .filter((r) => r.status === 'fulfilled')
            .flatMap((r) => {
                const { course, assignments } = r.value;
                const termName = getTermName(course);
                return assignments
                    .filter((a) => a?.due_at)
                    .map((a) => {
                        const dueAt = new Date(a.due_at);
                        return {
                            id: a.id,
                            name: a.name,
                            dueAt: a.due_at,
                            dueTimestamp: dueAt.getTime(),
                            htmlUrl: a.html_url,
                            pointsPossible: a.points_possible,
                            courseId: course.id,
                            courseName: course.name,
                            termName,
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

        const terms = Object.entries(groupedByTerm).map(([termName, courseMap]) => {
            const coursesInTerm = Object.entries(courseMap).map(([courseName, assessments]) => ({
                courseName,
                courseId: assessments[0].courseId,
                totalAssessments: assessments.length,
                assessments,
            }));
            coursesInTerm.sort((a, b) => {
                const nextDueA = a.assessments[0]?.dueTimestamp || Number.MAX_SAFE_INTEGER;
                const nextDueB = b.assessments[0]?.dueTimestamp || Number.MAX_SAFE_INTEGER;
                return nextDueA - nextDueB;
            });
            return {
                termName,
                totalAssessments: coursesInTerm.reduce((s, c) => s + c.totalAssessments, 0),
                courses: coursesInTerm,
            };
        });

        terms.sort((a, b) => {
            const nextDueA = a.courses[0]?.assessments[0]?.dueTimestamp || Number.MAX_SAFE_INTEGER;
            const nextDueB = b.courses[0]?.assessments[0]?.dueTimestamp || Number.MAX_SAFE_INTEGER;
            return nextDueA - nextDueB;
        });

        const result = {
            generatedAt: new Date().toISOString(),
            totalAssessments: dueAssessments.length,
            totalTerms: terms.length,
            terms,
        };

        cacheStore.set(cacheKey, { data: result, createdAt: now });

        return res.status(200).json({
            ...result,
            _cache: { source: 'origin', ageMs: 0, ttlMs: CACHE_TTL_MS },
        });
    } catch (error) {
        console.error('Fetch due assessments error:', error);
        return res.status(500).json({ message: error.message || 'Internal server error' });
    }
}