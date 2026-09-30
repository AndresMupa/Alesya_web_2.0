import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained Node.js server that can run under cPanel/Passenger.
  output: "standalone",
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
