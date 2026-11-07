import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    '*': [
      './public/vault/**/*.pdf',
      './public/vault-images/**/*',
      './public/cmaps/**/*',
      './public/standard_fonts/**/*',
      './temp_vault/**/*',
    ],
  },
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
