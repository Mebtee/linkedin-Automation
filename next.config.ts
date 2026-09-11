import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to every route.
        source: "/(.*)",
        headers: [
          // Prevent the app from being embedded in a <frame> or <iframe>.
          // This removes one clickjacking attack surface without any trade-off
          // because the app never relies on being embedded in other origins.
          { key: "X-Frame-Options", value: "DENY" },

          // Prevent browsers from MIME-sniffing a response away from its
          // declared Content-Type (e.g. interpreting a text/plain file as a
          // script). Always safe to enable.
          { key: "X-Content-Type-Options", value: "nosniff" },

          // Send the full origin only to same-origin requests; send the origin
          // (without path) to cross-origin HTTPS requests; send nothing to
          // HTTP destinations. Safe for LinkedIn OAuth redirects and Supabase
          // API calls because Supabase reads the Authorization header, not
          // Referer, and LinkedIn only needs the OAuth code/state parameters.
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },

          // Disable browser features the app does not use. The microphone,
          // camera, and geolocation restrictions are conservative defaults;
          // none of these are required by this application.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },

          // NOTE: Content-Security-Policy is intentionally NOT set here.
          //
          // A correct CSP for Next.js requires nonce-based script-src
          // directives (Next.js injects inline scripts that cannot be
          // sha256-hashed at build time). Additionally, the application
          // connects to Supabase, LinkedIn, and Google Fonts — all of which
          // would need explicit allow-listing. An overly-broad CSP provides no
          // protection; an under-specified one breaks the app. Implementing a
          // safe CSP is tracked as a follow-up architectural task.
          //
          // NOTE: Strict-Transport-Security is intentionally NOT set here.
          // Vercel automatically adds HSTS headers for all custom domains in
          // production. Adding it manually would be redundant.
        ],
      },
    ];
  },
};

export default nextConfig;
