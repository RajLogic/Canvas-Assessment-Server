import { getAuthUser } from '../../../lib/middleware.js';
import { DEFAULT_CANVAS_BASE_URL, normalizeCanvasBaseUrl } from '../../../lib/canvas-url.js';

function escapeIcsText(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

function formatUtcDate(dateLike) {
    const date = new Date(dateLike);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    const second = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

async function fetchPaginated(initialUrl, apiToken) {
    let items = [];
    let url = initialUrl;

    while (url) {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Canvas API error (${response.status}): ${text}`);
        }

        const pageItems = await response.json();
        items = items.concat(pageItems);

        const link = response.headers.get('link');
        const nextMatch = link?.match(/<([^>]+)>;\s*rel="next"/);
        url = nextMatch ? nextMatch[1] : null;
    }

    return items;
}

function isActiveCourse(course) {
    const activeEnrollment = Array.isArray(course.enrollments) &&
        course.enrollments.some((entry) => entry.enrollment_state === 'active');
    return activeEnrollment || course.workflow_state === 'available';
}

function toIcs(assessments) {
    const dtStamp = formatUtcDate(new Date());
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Final Reckoning//Canvas Assessments//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
    ];

    assessments.forEach((assessment) => {
        const start = new Date(assessment.dueAt);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const description = [
            `Course: ${assessment.courseName}`,
            `Points: ${assessment.pointsPossible ?? 'N/A'}`,
            `Submitted: ${assessment.hasSubmitted ? 'Yes' : 'No'}`,
        ].join('\n');

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${escapeIcsText(`${assessment.courseId}-${assessment.id}@finalreckoning`)}`);
        lines.push(`DTSTAMP:${dtStamp}`);
        lines.push(`DTSTART:${formatUtcDate(start)}`);
        lines.push(`DTEND:${formatUtcDate(end)}`);
        lines.push(`SUMMARY:${escapeIcsText(assessment.name)}`);
        lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
        lines.push(`URL:${escapeIcsText(assessment.htmlUrl)}`);
        lines.push(`CATEGORIES:${escapeIcsText(assessment.courseName)}`);
        lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    return `${lines.join('\r\n')}\r\n`;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const user = await getAuthUser(req);
    const apiToken = user?.canvasApiToken || process.env.API_KEY || '';
    const canvasBaseUrl = normalizeCanvasBaseUrl(user?.canvasBaseUrl, {
        fallback: normalizeCanvasBaseUrl(process.env.CANVAS_BASE_URL, { fallback: DEFAULT_CANVAS_BASE_URL }),
    });

    if (!apiToken) {
        return res.status(401).json({ message: 'No Canvas API token configured.' });
    }

    try {
        const coursesUrl = `${canvasBaseUrl}courses?per_page=100&include[]=enrollments&include[]=term&enrollment_state[]=active&enrollment_state[]=completed&enrollment_state[]=past`;
        const allCourses = await fetchPaginated(coursesUrl, apiToken);
        const courses = allCourses.filter(isActiveCourse);

        const assignmentResults = await Promise.allSettled(
            courses.map(async (course) => {
                const assignments = await fetchPaginated(`${canvasBaseUrl}courses/${course.id}/assignments?per_page=100`, apiToken);
                return { course, assignments };
            })
        );

        const now = Date.now();
        const dueAssessments = assignmentResults
            .filter((result) => result.status === 'fulfilled')
            .flatMap((result) => {
                const { course, assignments } = result.value;
                return assignments
                    .filter((assignment) => assignment?.due_at)
                    .map((assignment) => ({
                        id: assignment.id,
                        name: assignment.name,
                        dueAt: assignment.due_at,
                        dueTimestamp: new Date(assignment.due_at).getTime(),
                        htmlUrl: assignment.html_url,
                        pointsPossible: assignment.points_possible,
                        hasSubmitted: Boolean(assignment.has_submitted_submissions),
                        courseId: course.id,
                        courseName: course.name,
                    }))
                    .filter((assignment) => assignment.dueTimestamp >= now);
            })
            .sort((a, b) => a.dueTimestamp - b.dueTimestamp);

        const ics = toIcs(dueAssessments);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="final-reckoning-assessments-${timestamp}.ics"`);
        return res.status(200).send(ics);
    } catch (error) {
        console.error('ICS export error:', error);
        return res.status(500).json({ message: 'Failed to export assessments calendar.' });
    }
}
