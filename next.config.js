/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    // Enable API routes
    serverRuntimeConfig: {
        // Will only be available on the server side
        API_KEY: process.env.API_KEY,
    },
    publicRuntimeConfig: {
        // Will be available on both server and client
        CANVAS_BASE_URL: process.env.CANVAS_BASE_URL || 'https://rmit.instructure.com/api/v1/',
    },
};

module.exports = nextConfig;
