import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // allowedDevices: undefined, // Removed invalid option
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
