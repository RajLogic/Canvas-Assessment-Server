/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    compress: true,
    images: {
        unoptimized: false,
    },
    allowedDevOrigins: ['100.116.153.4'],
};

export default nextConfig;