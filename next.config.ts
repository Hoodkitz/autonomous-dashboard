import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevices: undefined, // Allow all devices
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
