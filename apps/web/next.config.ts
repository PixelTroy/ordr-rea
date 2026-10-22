import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ordr/shared'],
  async rewrites() {
    return []
  },
}

export default nextConfig
