// Uses native fetch (Node.js 18+) — no node-fetch dependency needed on Vercel
import crypto from 'node:crypto';
import { DEFAULT_CANVAS_BASE_URL, normalizeCanvasBaseUrl } from './canvas-url.js';

const canvasBaseUrl = normalizeCanvasBaseUrl(process.env.CANVAS_BASE_URL, {
    fallback: DEFAULT_CANVAS_BASE_URL,
});

function resolveApiToken() {
    const rawToken =
        process.env.API_KEY ||
        process.env.CANVAS_API_TOKEN ||
        process.env.CANVAS_TOKEN ||
        process.env.CANVAS_ACCESS_TOKEN ||
        '';

    const trimmed = rawToken.trim();
    if (!trimmed) return '';

    const assignmentMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    const assignmentValue = assignmentMatch ? assignmentMatch[2].trim() : trimmed;

    const withoutQuotes = assignmentValue.replace(/^['"]+|['"]+$/g, '');
    return withoutQuotes.replace(/^Bearer\s+/i, '').trim();
}

function getTokenSource() {
    if ((process.env.API_KEY || '').trim()) return 'API_KEY';
    if ((process.env.CANVAS_API_TOKEN || '').trim()) return 'CANVAS_API_TOKEN';
    if ((process.env.CANVAS_TOKEN || '').trim()) return 'CANVAS_TOKEN';
    if ((process.env.CANVAS_ACCESS_TOKEN || '').trim()) return 'CANVAS_ACCESS_TOKEN';
    return null;
}

function getTokenFingerprint(token) {
    if (!token) return null;
    return crypto.createHash('sha256').update(token).digest('hex').slice(0, 12);
}

const apiToken = resolveApiToken();

if (!apiToken) {
    console.warn("Canvas API token is missing! Set API_KEY (or CANVAS_API_TOKEN / CANVAS_TOKEN / CANVAS_ACCESS_TOKEN).");
}

async function fetchPaginatedCanvasResource(initialUrl) {
    let items = [];
    let url = initialUrl;

    while (url) {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${apiToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401) {
                throw new Error(
                    `Canvas API unauthorized (401): invalid or malformed token. ` +
                    `Check API_KEY/CANVAS_API_TOKEN in environment variables and ensure it is the raw token only (no 'Bearer ' prefix). ` +
                    `Canvas response: ${errorText}`
                );
            }
            throw new Error(`Canvas API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        items = items.concat(data);

        const linkHeader = response.headers.get("link");
        const nextPageMatch = new RegExp(/<([^>]+)>;\s*rel="next"/).exec(linkHeader);
        url = nextPageMatch ? nextPageMatch[1] : null;
    }

    return items;
}

export async function fetchAllCourses() {
    if (!apiToken) {
        throw new Error("Canvas API token is not set. Use API_KEY (or CANVAS_API_TOKEN / CANVAS_TOKEN / CANVAS_ACCESS_TOKEN).");
    }
    const url = `${canvasBaseUrl}courses?per_page=100&include[]=enrollments&include[]=term&enrollment_state[]=active&enrollment_state[]=completed&enrollment_state[]=past`;
    return fetchPaginatedCanvasResource(url);
}

export function getCanvasAuthDiagnostics() {
    let baseUrlStatus = 'valid';
    try {
        const parsed = new URL(canvasBaseUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            baseUrlStatus = 'invalid-protocol';
        }
    } catch {
        baseUrlStatus = 'invalid-url';
    }

    return {
        hasToken: Boolean(apiToken),
        tokenSource: getTokenSource(),
        tokenFingerprint: getTokenFingerprint(apiToken),
        tokenLength: apiToken?.length || 0,
        baseUrl: canvasBaseUrl,
        baseUrlStatus,
    };
}

export async function fetchAssignments(courseId) {
    const url = `${canvasBaseUrl}courses/${courseId}/assignments?per_page=100&include[]=submission`;
    return fetchPaginatedCanvasResource(url);
}

function isActiveCourse(course) {
    const hasActiveEnrollment = Array.isArray(course.enrollments) &&
        course.enrollments.some((enrollment) => enrollment.enrollment_state === 'active');
    return hasActiveEnrollment || course.workflow_state === 'available';
}

function getTermName(course) {
    return course?.term?.name || 'Uncategorized Term';
}

export async function fetchDueAssessmentsByTerm({ termFilter, onlyActive = true } = {}) {
    const allCourses = await fetchAllCourses();
    const courses = onlyActive ? allCourses.filter(isActiveCourse) : allCourses;
    const now = new Date();
    const normalizedFilter = termFilter?.toLowerCase().trim();

    const assignmentResults = await Promise.allSettled(
        courses.map(async (course) => {
            const assignments = await fetchAssignments(course.id);
            return { course, assignments };
        })
    );

    const dueAssessments = assignmentResults
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => {
            const { course, assignments } = result.value;
            const termName = getTermName(course);

            return assignments
                .filter((assignment) => assignment?.due_at)
                .map((assignment) => {
                    const dueAt = new Date(assignment.due_at);
                    return {
                        id: assignment.id,
                        name: assignment.name,
                        dueAt: assignment.due_at,
                        dueTimestamp: dueAt.getTime(),
                        htmlUrl: assignment.html_url,
                        pointsPossible: assignment.points_possible,
                        hasSubmitted: Boolean(assignment.has_submitted_submissions),
                        grade: assignment?.submission?.grade ?? null,
                        score: assignment?.submission?.score ?? null,
                        submittedAt: assignment?.submission?.submitted_at ?? null,
                        description: assignment?.description ?? null,
                        rubricUrl: assignment?.html_url ? `${assignment.html_url}#rubric` : null,
                        submissionTypes: Array.isArray(assignment?.submission_types) ? assignment.submission_types : [],
                        courseId: course.id,
                        courseName: course.name,
                        termName,
                    };
                })
                .filter((assignment) => assignment.dueTimestamp >= now.getTime());
        })
        .filter((assessment) => {
            if (!normalizedFilter) return true;
            return [assessment.termName, assessment.courseName, assessment.name]
                .some((value) => (value || '').toLowerCase().includes(normalizedFilter));
        })
        .sort((a, b) => a.dueTimestamp - b.dueTimestamp);

    const groupedByTerm = dueAssessments.reduce((accumulator, assessment) => {
        if (!accumulator[assessment.termName]) {
            accumulator[assessment.termName] = {};
        }
        if (!accumulator[assessment.termName][assessment.courseName]) {
            accumulator[assessment.termName][assessment.courseName] = [];
        }
        accumulator[assessment.termName][assessment.courseName].push(assessment);
        return accumulator;
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

        const totalAssessments = coursesInTerm.reduce((sum, course) => sum + course.totalAssessments, 0);

        return { termName, totalAssessments, courses: coursesInTerm };
    });

    terms.sort((a, b) => {
        const nextDueA = a.courses[0]?.assessments[0]?.dueTimestamp || Number.MAX_SAFE_INTEGER;
        const nextDueB = b.courses[0]?.assessments[0]?.dueTimestamp || Number.MAX_SAFE_INTEGER;
        return nextDueA - nextDueB;
    });

    return {
        generatedAt: new Date().toISOString(),
        totalAssessments: dueAssessments.length,
        totalTerms: terms.length,
        terms,
    };
}