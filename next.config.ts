import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma + pg out of the browser bundle (Node-only modules: dns, net, tls, fs).
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "pg-native",
  ],
  // DB dump / SQL restore payloads (maintenance console)
  experimental: {
    serverActions: {
      bodySizeLimit: "64mb",
    },
  },
};

export default nextConfig;
