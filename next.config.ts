import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@mdtolatex/core'],
  headers: async () => {
    return [
      {
        source: "/vault/:path*",
        headers: [{ key: 'Content-Type', value: 'application/pdf' }]
      }
    ];
  },
};

export default nextConfig;
