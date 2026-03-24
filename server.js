import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public"));

const canvasBaseUrl = "https://rmit.instructure.com/api/v1/";
const apiToken = process.env.API_KEY;

if (!apiToken) {
    console.error("API Key is missing! Set API_KEY in environment variables.");
    process.exit(1);
}





async function fetchAllCourses() {
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


app.get("/api/courses", async (req, res) => {
    try {
        const courses = await fetchAllCourses();


        console.log("Fetched courses:", courses.map(c => c.name));

        res.json(courses);
    } catch (error) {
        console.error("Fetch error:", error);
        res.status(500).json({ message: "Internal serv er error" });
    }
});


app.get("/api/courses/:courseId/assignments", async (req, res) => {
    try {
        const { courseId } = req.params;
        const assignmentsResponse = await fetch(
            `${canvasBaseUrl}courses/${courseId}/assignments`, {
            headers: { "Authorization": `Bearer ${apiToken}` },
        }
        );

        if (!assignmentsResponse.ok)
            throw new Error(`Error fetching assignments for course ${courseId}`);

        const assignments = await assignmentsResponse.json();
        res.json(assignments);
    } catch (error) {
        console.error("Fetch error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});



app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    app.get("/", async (req, res) => {
        try {
            const courses = await fetchAllCourses();
            res.json(courses);
        } catch (error) {
            console.error("Fetch error:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    });
});