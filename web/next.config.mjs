import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  output: "standalone",
  // API proxying is handled at runtime by src/proxy.ts
  // so that the Electron build can inject a dynamic port.
  turbopack: {
    // Explicitly set the root to this directory so Next.js doesn't
    // mistake the parent node_modules (Electron deps) as a workspace root.
    root: __dirname,
  },
};

export default nextConfig;
