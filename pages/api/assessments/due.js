import { fetchDueAssessmentsByTerm } from '../../../lib/canvasApi';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { term, onlyActive } = req.query;

        const result = await fetchDueAssessmentsByTerm({
            termFilter: typeof term === 'string' && term.trim() ? term.trim() : undefined,
            onlyActive: onlyActive !== 'false',
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('Fetch due assessments error:', error);
        return res.status(500).json({
            message: 'Internal server error',
            error: error.message,
        });
    }
}
