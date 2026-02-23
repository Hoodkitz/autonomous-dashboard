import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // allowedDevices removed as it is not a valid Next.js config option
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
