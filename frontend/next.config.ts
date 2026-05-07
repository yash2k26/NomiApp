import type { NextConfig } from "next";
import path from "node:path";

// pin turbopack to the frontend folder so next does not climb up to
// the parent NomiApp react-native package-lock.json and treat that as root
const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
