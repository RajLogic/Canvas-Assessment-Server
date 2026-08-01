import { getCanvasAuthDiagnostics } from '../../../lib/canvasApi';
import { getServerRuntimeConfig } from '../../../lib/config.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    const diagnostics = getCanvasAuthDiagnostics();

    return res.status(200).json({
        ok: diagnostics.hasToken && diagnostics.baseUrlStatus === 'valid',
        generatedAt: new Date().toISOString(),
        runtime: getServerRuntimeConfig(),
        diagnostics,
    });
}
