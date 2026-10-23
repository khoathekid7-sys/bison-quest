import type { NextConfig } from "next";

/**
 * Static export for GitHub Pages. `next build` writes plain HTML/CSS/JS to
 * `out/`. GitHub Pages serves a project site from `/<repo-name>`, so the deploy
 * workflow sets NEXT_PUBLIC_BASE_PATH to that (empty for local development).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/+$/, "") || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  // Cache Components / Partial Prefetching need a server, so they're off for static export.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
