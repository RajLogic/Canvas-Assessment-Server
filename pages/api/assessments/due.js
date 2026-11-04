import { getAuthUser, getCanvasAccessError } from '../../../lib/middleware.js';
import { DEFAULT_CANVAS_BASE_URL, normalizeCanvasBaseUrl } from '../../../lib/canvas-url.js';
import {
    buildDueCacheKey,
    createEmptyCacheEntry,
    getDueCacheEntry,
    setDueCacheEntry,
} from '../../../lib/due-cache.js';

const CACHE_TTL_MS = 30 * 60 * 1000;

const ENV_BASE_URL = normalizeCanvasBaseUrl(process.env.CANVAS_BASE_URL, {
    fallback: DEFAULT_CANVAS_BASE_URL,
});

function resolveBaseUrl(user) {
    // Priority: per-user setting → env var default
    return normalizeCanvasBaseUrl(user?.canvasBaseUrl, { fallback: ENV_BASE_URL });
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
        const nextLink = link?.split(',').find((part) => part.includes('; rel="next"'));
        const nextMatch = nextLink && /^<([^>]+)>/.exec(nextLink.trim());
        url = nextMatch ? nextMatch[1] : null;
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

function matchesAssessmentFilter(assessment, normalizedFilter) {
    return [assessment.termName, assessment.courseName, assessment.name]
        .some((value) => (value || '').toLowerCase().includes(normalizedFilter));
}

function groupAssessmentsByTermAndCourse(filteredAssessments) {
    return filteredAssessments.reduce((acc, assessment) => {
        if (!acc[assessment.termName]) acc[assessment.termName] = {};
        if (!acc[assessment.termName][assessment.courseName]) acc[assessment.termName][assessment.courseName] = [];
        acc[assessment.termName][assessment.courseName].push(assessment);
        return acc;
    }, {});
}

function filterCachedTerms(cachedData, normalizedFilter) {
    if (!normalizedFilter) {
        return cachedData.terms;
    }

    const filteredAssessments = (cachedData.terms || []).flatMap((term) =>
        (term.courses || []).flatMap((course) =>
            (course.assessments || []).filter((assessment) => matchesAssessmentFilter(assessment, normalizedFilter))
        )
    );

    const groupedByTerm = groupAssessmentsByTermAndCourse(filteredAssessments);

    const terms = Object.entries(groupedByTerm).map(([tName, courseMap]) => {
        const coursesInTerm = Object.entries(courseMap).map(([cName, assessments]) => ({
            courseName: cName,
            courseId: assessments[0].courseId,
            totalAssessments: assessments.length,
            assessments,
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

    return terms;
}

async function buildDueAssessmentsResult({ canvasBaseUrl, apiToken, includeOnlyActive }) {
    const coursesUrl = `${canvasBaseUrl}courses?per_page=100&include[]=enrollments&include[]=term&enrollment_state[]=active&enrollment_state[]=completed&enrollment_state[]=past`;
    const allCourses = await fetchPaginated(coursesUrl, apiToken);
    const courses = includeOnlyActive ? allCourses.filter(isActive) : allCourses;

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
            const currentTermName = termName(course);
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
                        hasSubmitted: Boolean(a.has_submitted_submissions),
                        grade: a?.submission?.grade ?? null,
                        score: a?.submission?.score ?? null,
                        submittedAt: a?.submission?.submitted_at ?? null,
                        description: a?.description ?? null,
                        rubricUrl: a?.html_url ? `${a.html_url}#rubric` : null,
                        submissionTypes: Array.isArray(a?.submission_types) ? a.submission_types : [],
                        courseName: course.name,
                        termName: currentTermName,
                    };
                });
        })
        .filter((a) => (includeOnlyActive ? a.dueTimestamp >= Date.now() : true))
        .sort((a, b) => a.dueTimestamp - b.dueTimestamp);

    const groupedByTerm = dueAssessments.reduce((acc, a) => {
        if (!acc[a.termName]) acc[a.termName] = {};
        if (!acc[a.termName][a.courseName]) acc[a.termName][a.courseName] = [];
        acc[a.termName][a.courseName].push(a);
        return acc;
    }, {});

    const terms = Object.entries(groupedByTerm).map(([tName, courseMap]) => {
        const coursesInTerm = Object.entries(courseMap).map(([cName, assessments]) => ({
            courseName: cName,
            courseId: assessments[0].courseId,
            totalAssessments: assessments.length,
            assessments,
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

    return {
        generatedAt: new Date().toISOString(),
        totalAssessments: dueAssessments.length,
        totalTerms: terms.length,
        canvasBaseUrl,
        terms,
    };
}

async function refreshCacheEntry(cacheKey, { canvasBaseUrl, apiToken, includeOnlyActive }) {
    const entry = getDueCacheEntry(cacheKey) || createEmptyCacheEntry();

    if (entry.isRefreshing) {
        return entry;
    }

    entry.isRefreshing = true;
    setDueCacheEntry(cacheKey, entry);

    try {
        const data = await buildDueAssessmentsResult({ canvasBaseUrl, apiToken, includeOnlyActive });
        entry.data = data;
        entry.createdAt = entry.createdAt || Date.now();
        entry.updatedAt = Date.now();
        entry.error = null;
    } catch (error) {
        entry.error = error?.message || String(error);
    } finally {
        // The entry was stored above and is deliberately not stored again here: if a
        // logout or token change cleared it while Canvas was responding, the finished
        // request must not put that user's data back.
        entry.isRefreshing = false;
    }

    return entry;
}

async function processGet(req, res, user, apiToken, canvasBaseUrl) {
    try {
        const { term, search, q, onlyActive, sync } = req.query;
        const termFilter =
            (typeof search === 'string' && search.trim() ? search.trim() : undefined) ||
            (typeof q === 'string' && q.trim() ? q.trim() : undefined) ||
            (typeof term === 'string' && term.trim() ? term.trim() : undefined);
        const includeOnlyActive = onlyActive !== 'false';
        const forceSync = sync === 'true' || sync === '1';

        const cacheKey = buildDueCacheKey({ userId: user.id, baseUrl: canvasBaseUrl, onlyActive: includeOnlyActive });
        const now = Date.now();
        const normalizedFilter = termFilter?.toLowerCase().trim();
        const cachePayload = { canvasBaseUrl, apiToken, includeOnlyActive };
        const cached = getDueCacheEntry(cacheKey) || createEmptyCacheEntry();

        const isFresh = cached.updatedAt && (now - cached.updatedAt < CACHE_TTL_MS);

        if (forceSync || !cached.data) {
            const fresh = await refreshCacheEntry(cacheKey, cachePayload);
            const terms = filterCachedTerms(fresh.data, normalizedFilter);
            const result = {
                ...fresh.data,
                totalTerms: terms.length,
                terms,
            };
            return res.status(200).json({
                ...result,
                _cache: { source: 'origin', ageMs: 0, ttlMs: CACHE_TTL_MS, refreshedAt: fresh.updatedAt || Date.now() },
            });
        }

        if (!isFresh && !cached.isRefreshing) {
            refreshCacheEntry(cacheKey, cachePayload).catch(() => { });
        }

        const terms = filterCachedTerms(cached.data, normalizedFilter);
        const result = {
            ...cached.data,
            totalTerms: terms.length,
            terms,
        };

        return res.status(200).json({
            ...result,
            _cache: {
                source: isFresh ? 'server-memory' : 'stale-server-memory',
                ageMs: cached.updatedAt ? now - cached.updatedAt : 0,
                ttlMs: CACHE_TTL_MS,
            },
        });

    } catch (error) {
        console.error('Fetch due assessments error:', error);
        return res.status(500).json({ message: 'Failed to load assessments.' });
    }
}

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    const user = await getAuthUser(req);
    const accessError = getCanvasAccessError(user);
    if (accessError) return res.status(accessError.status).json(accessError.body);

    return processGet(req, res, user, user.canvasApiToken, resolveBaseUrl(user));
}