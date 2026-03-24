import { fetchAssignments } from '../../../../lib/canvasApi';

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
        const { courseId } = req.query;

        if (!courseId) {
            return res.status(400).json({ message: 'Course ID is required' });
        }

        const assignments = await fetchAssignments(courseId);
        res.status(200).json(assignments);
    } catch (error) {
        console.error("Fetch error:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
}
