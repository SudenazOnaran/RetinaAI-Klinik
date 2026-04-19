import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /**
   * Manuel rapor + AI kaydında `saveAnalysisAction` gövdesinde hem orijinal görüntü
   * hem heatmap (base64/data URL) taşınır. Varsayılan ~1MB limit aşıldığında
   * eylem çalışmadan reddedilir ve istemci üretimde genel RSC/özet hata mesajı görür.
   */
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  async redirects() {
    return [
      { source: "/en/login", destination: "/login", permanent: true },
      { source: "/tr/login", destination: "/login", permanent: true },
    ];
  },
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
