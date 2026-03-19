/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Fix wagmi porto connector missing module
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'porto/internal': false,
    };
    // Ignore node-specific modules in client bundle
    config.externals = [...(config.externals || []), 'pino-pretty', 'lokijs', 'encoding'];
    return config;
  },
  // Suppress server-only module warnings for dynamic imports
  experimental: {
    serverComponentsExternalPackages: ['ethers', 'openai', 'merkletreejs'],
  },
};

export default nextConfig;
