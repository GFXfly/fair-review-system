import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@xenova/transformers'],
  webpack: (config) => {
    config.externals.push({
      '@xenova/transformers': 'commonjs @xenova/transformers',
      'sharp': 'commonjs sharp',
    });
    return config;
  },
};

export default nextConfig;
