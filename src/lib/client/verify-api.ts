"use client";

import type { GemConfig } from "@/config/hunt";
import type { GeoFix } from "@/lib/geo";
import { VERIFY_URL } from "@/lib/site";
import type { VerifyResponse } from "@/lib/verification-types";

/** Calls the photo checker (Cloudflare Worker). Throws on network failure (caller keeps the photo). */
export async function verifyRemote({ gem, photo, fix }: { gem: GemConfig; photo: Blob; fix: GeoFix }): Promise<VerifyResponse> {
  if (!VERIFY_URL) {
    return {
      ok: false,
      error: "not_configured",
      message: "Photo verification isn't set up on this site yet (no photo checker address). Organizers: see DEPLOYING.md.",
      retryable: false,
    };
  }
  const form = new FormData();
  form.set("gemId", gem.id);
  form.set("photo", photo, `${gem.id}.jpg`);
  form.set("lat", String(fix.lat));
  form.set("lng", String(fix.lng));
  form.set("accuracy", String(fix.accuracy));
  form.set("fixAgeMs", String(Math.max(0, Date.now() - fix.timestamp)));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75_000);
  try {
    const res = await fetch(`${VERIFY_URL}/verify`, { method: "POST", body: form, signal: controller.signal });
    const body = (await res.json().catch(() => null)) as VerifyResponse | null;
    if (!body || typeof body !== "object" || !("ok" in body)) {
      return { ok: false, error: "server_error", message: "The server sent an unexpected reply. Please try again.", retryable: true };
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export type ServerStatus = {
  verificationConfigured: boolean;
  model: string;
  placement: {
    gemId: string;
    referenceName: string;
    distanceMeters: number;
    distanceFeet: number;
    limitMeters: number;
    limitFeet: number;
    passes: boolean;
    checkpointStatus: string;
  };
  gems: { id: string; name: string; coordinateStatus: string; referenceImageCount: number; requireReferenceImages: boolean }[];
};

export async function fetchServerStatus(): Promise<ServerStatus | null> {
  if (!VERIFY_URL) return null;
  try {
    const res = await fetch(`${VERIFY_URL}/status`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as ServerStatus) : null;
  } catch {
    return null;
  }
}
