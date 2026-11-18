import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false, // 禁用 X-Powered-By: Next.js，防止指纹识别
  productionBrowserSourceMaps: false, // 禁用生产环境源码映射，防止代码泄露
  serverExternalPackages: ['@xenova/transformers', 'pdf-parse-fork'],
  webpack: (config) => {
    config.externals.push({
      '@xenova/transformers': 'commonjs @xenova/transformers',
      'sharp': 'commonjs sharp',
    });
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'self' blob:; base-uri 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
