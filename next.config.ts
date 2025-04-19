import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add webpack configuration here
  webpack: (config, { isServer }) => {
    // Only apply this configuration on the server-side
    if (isServer) {
      // Mark 'better-sqlite3' as external so it's not bundled
      config.externals = [...config.externals, 'better-sqlite3'];
      // Also tell Webpack not to parse this module (useful for native modules)
      config.module = config.module || {};
      config.module.noParse = /better-sqlite3/;
    }

    // Important: return the modified config
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.discogs.com',
        port: '',
        pathname: '/**', // Allow any path under this hostname
      },
    ],
  },
  output: 'standalone', // Add this line for standalone build output
};

export default nextConfig;
