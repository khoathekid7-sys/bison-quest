"use client";

import { useEffect, useState } from "react";
import type { GeoFix } from "@/lib/geo";

export type GeoErrorKind = "denied" | "unavailable" | "timeout" | "unsupported" | "insecure";

export class GeoError extends Error {
  constructor(public kind: GeoErrorKind) {
    super(kind);
  }
}

export function geoSupport(): GeoErrorKind | null {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (!("geolocation" in navigator)) return "unsupported";
  return null;
}

const toFix = (p: GeolocationPosition): GeoFix => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: p.coords.accuracy,
  timestamp: p.timestamp,
});

const toKind = (e: GeolocationPositionError): GeoErrorKind =>
  e.code === e.PERMISSION_DENIED ? "denied" : e.code === e.TIMEOUT ? "timeout" : "unavailable";

/** One fresh, high-accuracy reading. Never returns a cached position. */
export function getFreshFix(timeoutMs = 15_000): Promise<GeoFix> {
  const unsupported = geoSupport();
  if (unsupported) return Promise.reject(new GeoError(unsupported));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(toFix(p)),
      (e) => reject(new GeoError(toKind(e))),
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );
  });
}

export async function queryGeoPermission(): Promise<PermissionState | "unknown"> {
  try {
    const s = await navigator.permissions.query({ name: "geolocation" });
    return s.state;
  } catch {
    return "unknown";
  }
}

/**
 * Watches position ONLY while `active` is true and the page is visible.
 * Stops as soon as the explore screen closes or the tab is hidden, so there is
 * no background tracking.
 */
export function useForegroundPosition(active: boolean) {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [error, setError] = useState<GeoErrorKind | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!active || !visible) return;
    const unsupported = geoSupport();
    if (unsupported) {
      queueMicrotask(() => setError(unsupported));
      return;
    }
    let lastUpdate = 0;
    const onFix = (p: GeolocationPosition) => {
      lastUpdate = Date.now();
      setFix(toFix(p));
      setError(null);
    };
    const id = navigator.geolocation.watchPosition(onFix, (e) => setError(toKind(e)), {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 20_000,
    });
    // Phones often stop sending watch updates while you stand still. While the
    // screen is open, ask for a fresh reading whenever the last one is >8 s old
    // so the "you're here" status doesn't go stale.
    const refresh = setInterval(() => {
      if (Date.now() - lastUpdate < 8_000) return;
      navigator.geolocation.getCurrentPosition(onFix, (e) => setError(toKind(e)), {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15_000,
      });
    }, 4_000);
    return () => {
      navigator.geolocation.clearWatch(id);
      clearInterval(refresh);
    };
  }, [active, visible]);

  return { fix, error };
}
