import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Pin the workspace root to this folder: otherwise Next.js walks up looking for lockfiles
// (one lives in the user's home) and warns; it also keeps `.next/standalone/server.js` flat.
const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Produce a self-contained Node.js server that can run under cPanel/Passenger.
  output: "standalone",
  outputFileTracingRoot: root,
  turbopack: { root },
  // Seeded SQLite file for demo previews (DEMO_DATABASE=1); absent in normal builds.
  outputFileTracingIncludes: { "/**": ["./.demo/**/*"] },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};

export default nextConfig;
