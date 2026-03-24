import { fetchAssignments } from '../../../../lib/canvasApi';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    try {
        const { courseId } = req.query;
        if (!courseId) return res.status(400).json({ message: 'Course ID is required' });
        const assignments = await fetchAssignments(courseId);
        return res.status(200).json(assignments);
    } catch (error) {
        console.error('Fetch assignments error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}