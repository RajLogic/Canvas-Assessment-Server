/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    compress: true,
    swcMinify: true,
    images: {
        unoptimized: false,
    },
};

export default nextConfig;