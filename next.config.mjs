/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // Canonical /slug/ URLs. Without this, static export serves /slug while a
  // request for /slug/ (or vice-versa) 308-redirects — and a redirect breaks
  // the cross-document View Transition. Trailing-slash keeps every nav direct.
  trailingSlash: true,
};

export default nextConfig;
