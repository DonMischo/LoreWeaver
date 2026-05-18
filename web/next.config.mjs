/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  output: "standalone",
  // API proxying is handled at runtime by src/middleware.ts
  // so that the Electron build can inject a dynamic port.
};

export default nextConfig;
