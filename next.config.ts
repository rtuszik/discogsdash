import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "i.discogs.com",
                port: "",
                pathname: "/**",
            },
        ],
    },
    output: "standalone",
};

export default nextConfig;
