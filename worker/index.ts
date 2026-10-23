/**
 * Bison Quest photo checker: a Cloudflare Worker.
 *
 * GitHub Pages can only serve static files and can't keep secrets, so this
 * small Worker is the one piece that runs on a server. It holds the Anthropic
 * API key and answers two requests from the app:
 *
 *   POST /verify  → re-checks location, then checks the photo with Claude
 *   GET  /status  → setup report (no secrets)
 *
 * Settings (see wrangler.jsonc and DEPLOYING.md):
 *   ANTHROPIC_API_KEY  secret  — set with `npx wrangler secret put ANTHROPIC_API_KEY`
 *   ALLOWED_ORIGINS    var     — comma-separated sites allowed to call this Worker
 *   SITE_URL           var     — where the app is published (to load reference photos)
 *   BISON_VISION_MODEL var     — optional, default claude-opus-5-5
 *   BISON_VISION_EFFORT var    — optional: low | medium | high
 */
import type { GemConfig } from "@/config/hunt";
import type { VerifyResponse } from "@/lib/verification-types";
import {
  handleVerify,
  makeClaudeProvider,
  parseEffort,
  rateLimited,
  sniffImageType,
  statusReport,
  toBase64,
  type ReferenceImageData,
  type VisionProvider,
} from "@/lib/verify-core";

export type Env = {
  ANTHROPIC_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  SITE_URL?: string;
  BISON_VISION_MODEL?: string;
  BISON_VISION_EFFORT?: string;
};

/** Reference photos must be pre-shrunk (scripts/prepare-references.mjs); the API limit is 5 MB each. */
const MAX_REFERENCE_BYTES = 3.5 * 1024 * 1024;
const refCache = new Map<string, Promise<ReferenceImageData[]>>();

export function referenceLoader(siteUrl: string | undefined, fetcher: typeof fetch = fetch) {
  return (gem: GemConfig): Promise<ReferenceImageData[]> => {
    if (!gem.photo.referenceImages.length) return Promise.resolve([]);
    if (!siteUrl) return Promise.reject(new Error("SITE_URL is not set, so reference photos can't be loaded"));
    const base = siteUrl.replace(/\/+$/, "");
    const key = base + JSON.stringify(gem.photo.referenceImages.map((r) => r.src));
    let p = refCache.get(key);
    if (!p) {
      p = Promise.all(
        gem.photo.referenceImages.map(async (ref) => {
          const res = await fetcher(`${base}/${ref.src.replace(/^\/+/, "")}`);
          if (!res.ok) throw new Error(`Reference photo ${ref.src} returned HTTP ${res.status}`);
          const bytes = new Uint8Array(await res.arrayBuffer());
          const mediaType = sniffImageType(bytes);
          if (!mediaType) throw new Error(`Reference photo ${ref.src} isn't a JPEG/PNG/WebP`);
          if (bytes.length > MAX_REFERENCE_BYTES) throw new Error(`Reference photo ${ref.src} is too large; run the prepare-references script`);
          return { base64: toBase64(bytes), mediaType, description: ref.description };
        }),
      );
      p.catch(() => refCache.delete(key));
      refCache.set(key, p);
    }
    return p;
  };
}

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function json(body: unknown, status: number, origin: string | null): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin" });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return new Response(JSON.stringify(body), { status, headers });
}

export async function handleRequest(
  request: Request,
  env: Env,
  overrides: { provider?: VisionProvider; fetcher?: typeof fetch; now?: () => number } = {},
): Promise<Response> {
  const url = new URL(request.url);
  const origin = allowedOrigin(request, env);

  if (request.method === "OPTIONS") {
    if (!origin) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      },
    });
  }

  if (url.pathname === "/status" && request.method === "GET") {
    return json(statusReport({ apiKey: env.ANTHROPIC_API_KEY, model: env.BISON_VISION_MODEL }), 200, origin);
  }

  if (url.pathname === "/verify" && request.method === "POST") {
    // Browsers always send Origin on cross-site POSTs. Only the configured app may spend the API budget.
    if (!origin) {
      return json(
        { ok: false, error: "bad_request", message: "This photo checker only accepts requests from the Bison Quest app.", retryable: false } satisfies VerifyResponse,
        403,
        null,
      );
    }
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (rateLimited(ip, overrides.now?.())) {
      return json(
        { ok: false, error: "rate_limited", message: "Too many photo checks in a short time. Wait a few minutes and try again.", retryable: true } satisfies VerifyResponse,
        429,
        origin,
      );
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ ok: false, error: "bad_request", message: "The upload didn't arrive intact. Please try again.", retryable: true } satisfies VerifyResponse, 400, origin);
    }
    const provider =
      overrides.provider ??
      makeClaudeProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.BISON_VISION_MODEL, effort: parseEffort(env.BISON_VISION_EFFORT) });
    const { status, body } = await handleVerify(form, {
      provider,
      loadReferences: referenceLoader(env.SITE_URL, overrides.fetcher),
      now: overrides.now,
    });
    return json(body, status, origin);
  }

  return json({ error: "not_found" }, 404, origin);
}

const worker = {
  fetch: (request: Request, env: Env) => handleRequest(request, env),
};
export default worker;
