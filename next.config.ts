import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // allowedDevices removed as it is invalid
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
