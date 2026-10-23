/** Build-time site settings (inlined by Next.js at build). */

/** "" locally, "/<repo-name>" on GitHub Pages. */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

/** Address of the Cloudflare Worker photo checker, e.g. https://bison-quest-checker.you.workers.dev */
export const VERIFY_URL = (process.env.NEXT_PUBLIC_VERIFY_URL ?? "").trim().replace(/\/+$/, "");

/** Prefix a path inside /public with the base path. */
export const asset = (path: string) => `${BASE_PATH}/${path.replace(/^\/+/, "")}`;
