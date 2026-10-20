import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Keep garment images as ordinary remote assets. This deliberately avoids
  // Vercel Image Optimization transformations and their metered usage.
  images: { unoptimized: true },
};

export default nextConfig;
