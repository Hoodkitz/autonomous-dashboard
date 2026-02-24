import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // allowedDevices: undefined, // Removed invalid config
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
