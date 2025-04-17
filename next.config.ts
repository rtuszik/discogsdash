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
  /* other config options can go here */
};

export default nextConfig;
