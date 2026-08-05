import type { NextConfig } from "next";

// Baseline security headers for the whole app. Deliberately NO `Permissions-Policy`
// or `Content-Security-Policy`: the POS needs Web Bluetooth (BLE printing) and
// Next's inline runtime, and a wrong policy there silently breaks the printer.
const securityHeaders = [
  // The till is never meant to be embedded in another site.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS in production (ignored on localhost/http, so dev is unaffected).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
