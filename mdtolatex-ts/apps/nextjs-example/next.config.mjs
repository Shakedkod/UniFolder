/** @type {import('next').NextConfig} */
const nextConfig = {
  // `@mdtolatex/core` ships untranspiled ESM from the workspace, so let Next
  // compile it along with the app (needed for both server and client imports).
  transpilePackages: ['@mdtolatex/core'],
};

export default nextConfig;
