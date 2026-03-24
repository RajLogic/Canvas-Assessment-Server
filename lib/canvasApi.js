// Uses native fetch (Node.js 18+) — no node-fetch dependency needed on Vercel

const rawBaseUrl = process.env.CANVAS_BASE_URL || "https://rmit.instructure.com/api/v1/";
const canvasBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl : `${rawBaseUrl}/`;

function resolveApiToken() {
    const rawToken =
        process.env.API_KEY ||
        process.env.CANVAS_API_TOKEN ||
        process.env.CANVAS_TOKEN ||
        process.env.CANVAS_ACCESS_TOKEN ||
        '';

    const trimmed = rawToken.trim();
    if (!trimmed) return '';

    const withoutQuotes = trimmed.replace(/^['"]+|['"]+$/g, '');
    return withoutQuotes.replace(/^Bearer\s+/i, '').trim();
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
        const nextPageMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
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

export async function fetchAssignments(courseId) {
    const url = `${canvasBaseUrl}courses/${courseId}/assignments?per_page=100`;
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
                        courseId: course.id,
                        courseName: course.name,
                        termName,
                    };
                })
                .filter((assignment) => assignment.dueTimestamp >= now.getTime());
        })
        .filter((assessment) => {
            if (!termFilter) return true;
            return assessment.termName.toLowerCase().includes(termFilter.toLowerCase());
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