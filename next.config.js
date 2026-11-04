/** @type {import('next').NextConfig} */
import { buildSecurityHeaders } from './lib/config.js';

const nextConfig = {
    reactStrictMode: true,
    compress: true,
    poweredByHeader: false,
    images: {
        unoptimized: false,
    },
    webpack(config) {
        // package.json sets "type": "module", which makes webpack treat our .js files
        // as strict ESM. Default imports of CommonJS packages such as next/link then
        // resolve to an object instead of the component.
        config.module.rules.push({
            test: /\.js$/,
            exclude: /node_modules/,
            type: 'javascript/auto',
        });
        return config;
    },
    async headers() {
        return buildSecurityHeaders();
    },
};

export default nextConfig;
