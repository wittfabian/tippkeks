import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server (.next/standalone) for a minimal production
  // container image — see Dockerfile.
  output: "standalone",
};

export default nextConfig;
