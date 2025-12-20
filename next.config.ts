import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false, // 禁用 X-Powered-By: Next.js，防止指纹识别
  productionBrowserSourceMaps: false, // 禁用生产环境源码映射，防止代码泄露
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
