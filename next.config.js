/** @type {import('next').NextConfig} */

// ─── Security headers applied to every response ───────────────────────────────
const BASE_HEADERS = [
  // Prevent clickjacking — allow same-origin framing only
  { key: 'X-Frame-Options',        value: 'SAMEORIGIN' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Control referrer information
  { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
  // DNS prefetch for performance (safe to enable)
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // Restrict browser features
  {
    key:   'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
]

const PROD_HEADERS = [
  // HSTS — only meaningful over HTTPS
  {
    key:   'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
]

const nextConfig = {
  // ── Standalone output for Docker deployment ────────────────────────────────
  // Produces a minimal self-contained build in .next/standalone/
  output: 'standalone',

  // ── Public env vars for client components ─────────────────────────────────
  env: {
    NEXT_PUBLIC_SESSION_TIMEOUT: process.env.SESSION_TIMEOUT_MINUTES ?? '480',
  },

  // ── Security headers ───────────────────────────────────────────────────────
  async headers() {
    const headers = [
      ...BASE_HEADERS,
      ...(process.env.NODE_ENV === 'production' ? PROD_HEADERS : []),
    ]
    return [{ source: '/(.*)', headers }]
  },

  // ── Image optimization ─────────────────────────────────────────────────────
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Supabase storage — add your project ref below
      // { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },

      // AWS S3 — add your bucket region below
      // { protocol: 'https', hostname: '*.s3.*.amazonaws.com' },

      // Cloudflare R2 — add your account subdomain below
      // { protocol: 'https', hostname: '*.r2.dev' },
    ],
  },

  // ── Build & runtime ────────────────────────────────────────────────────────
  // Fail fast on type errors and lint errors during build
  typescript: { ignoreBuildErrors: false },
  eslint:     { ignoreDuringBuilds: false },

  // Compress responses
  compress: true,

  // Power-by header removal (Next.js strips X-Powered-By by default)
  poweredByHeader: false,

  // ── Webpack ────────────────────────────────────────────────────────────────
  webpack(config, { isServer }) {
    // Tree-shake lucide-react icons (ensure only used icons are bundled)
    // This is a no-op override — Next.js handles this automatically
    return config
  },

  // ── Logging ────────────────────────────────────────────────────────────────
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
}

module.exports = nextConfig
