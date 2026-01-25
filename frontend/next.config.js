/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Remove 'standalone' for Vercel deployment
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  // Force new build ID to bust browser cache
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
}

module.exports = nextConfig
