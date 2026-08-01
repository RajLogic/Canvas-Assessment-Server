/** @type {import('next').NextConfig} */
import { buildSecurityHeaders } from './lib/config.js';

const nextConfig = {
    reactStrictMode: true,
    compress: true,
    poweredByHeader: false,
    images: {
        unoptimized: false,
    },
    async headers() {
        return buildSecurityHeaders();
    },
};

export default nextConfig;