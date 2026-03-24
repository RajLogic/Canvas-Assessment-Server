// This file is kept for backward compatibility with local development
// For production (Vercel, etc.), use: npm start (runs 'next start')
// For development, use: npm run dev (runs 'next dev')

import dotenv from 'dotenv';
dotenv.config();

const apiToken = process.env.API_KEY;

if (!apiToken) {
    console.warn("API Key is missing! Set API_KEY in environment variables.");
}

console.log('Canvas Assessment Server configured and ready.');
console.log('\nTo start the server:');
console.log('  Development: npm run dev');
console.log('  Production:  npm start');
console.log('\nNote: Next.js handles all API routing automatically.');
