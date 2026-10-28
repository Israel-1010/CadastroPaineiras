/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint não está instalado no projeto; a checagem de tipos do TypeScript continua ativa no build
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // exceljs e sharp devem rodar como módulos Node normais, sem bundle
    serverComponentsExternalPackages: ["exceljs", "sharp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ]
  },
}

export default nextConfig
