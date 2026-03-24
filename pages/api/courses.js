import { fetchAllCourses } from '../../lib/canvasApi';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )
    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const courses = await fetchAllCourses();
        console.log("Fetched courses:", courses.map(c => c.name));
        res.status(200).json(courses);
    } catch (error) {
        console.error("Fetch error:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
}
