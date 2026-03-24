import fetch from 'node-fetch';

const canvasBaseUrl = process.env.CANVAS_BASE_URL || "https://rmit.instructure.com/api/v1/";
const apiToken = process.env.API_KEY;

if (!apiToken) {
    console.warn("API Key is missing! Set API_KEY in environment variables.");
}

export async function fetchAllCourses() {
    let courses = [];
    let url = `${canvasBaseUrl}courses?per_page=100&include[]=enrollments&enrollment_state[]=active&enrollment_state[]=completed&enrollment_state[]=past`;

    while (url) {
        console.log(`Fetching: ${url}`);

        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${apiToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("API Error Response:", errorText);
            throw new Error(`Error fetching courses: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        courses = courses.concat(data);

        const linkHeader = response.headers.get("link");
        const nextPageMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
        url = nextPageMatch ? nextPageMatch[1] : null;
    }

    return courses;
}

export async function fetchAssignments(courseId) {
    const response = await fetch(
        `${canvasBaseUrl}courses/${courseId}/assignments`,
        {
            headers: {
                "Authorization": `Bearer ${apiToken}`,
                "Content-Type": "application/json",
            },
        }
    );

    if (!response.ok) {
        throw new Error(`Error fetching assignments for course ${courseId}: ${response.status}`);
    }

    return await response.json();
}
