// This file is kept for backward compatibility with local development.
// For production (Vercel, etc.), use: npm start (runs 'next start').
// For development, use: npm run dev (runs 'next dev').

import dotenv from 'dotenv';
import { getServerRuntimeConfig } from './lib/config.js';

dotenv.config();

const runtimeConfig = getServerRuntimeConfig();

if (!runtimeConfig.encryptionKeyConfigured) {
    console.warn('ENCRYPTION_KEY is not set. User tokens and links will not be encrypted in the database.');
}

console.log('Canvas Assessment Server configured and ready.');
console.log(`Runtime: ${runtimeConfig.nodeEnv} on port ${runtimeConfig.port}`);
console.log('To start the server:');
console.log('  Development: npm run dev');
console.log('  Production:  npm start');
console.log('Note: Next.js handles all API routing automatically.');
