"use client";

import { useEffect, useState } from "react";
import { getFreshFix, GeoError, queryGeoPermission, type GeoErrorKind } from "@/lib/client/geolocation";
import { BisonMascot, Icon } from "../art";

type LocState = "idle" | "asking" | "granted" | GeoErrorKind;

export function LocationHelp({ kind }: { kind: GeoErrorKind }) {
  if (kind === "insecure") {
    return (
      <p className="text-[15px] text-ink">
        Location only works on a secure <strong>https://</strong> address. Open the app from its https link (see the README for phone testing).
      </p>
    );
  }
  if (kind === "unsupported") return <p className="text-[15px] text-ink">This browser doesn&apos;t support location. Try Safari on iPhone or Chrome on Android.</p>;
  if (kind === "timeout" || kind === "unavailable") {
    return (
      <p className="text-[15px] text-ink">
        Your phone couldn&apos;t find a GPS signal. Step outside, away from tall walls, make sure Location Services are on, then try again.
      </p>
    );
  }
  return (
    <div className="space-y-2 text-[15px] text-ink">
      <p>Location access is blocked. To turn it back on:</p>
      <details className="rounded-xl bg-cream-100 p-3" open>
        <summary className="cursor-pointer font-bold">iPhone (Safari)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Tap <strong>aA</strong> (or the page icon) in the address bar → <strong>Website Settings</strong> → <strong>Location</strong> → <strong>Allow</strong>.</li>
          <li>If that&apos;s missing: Settings → Privacy &amp; Security → Location Services → Safari Websites → <strong>While Using</strong>, with Precise Location on.</li>
        </ol>
      </details>
      <details className="rounded-xl bg-cream-100 p-3">
        <summary className="cursor-pointer font-bold">Android (Chrome)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Tap the icon left of the address → <strong>Permissions</strong> → <strong>Location</strong> → <strong>Allow</strong>.</li>
          <li>Also check Android Settings → Location is on, with Google Location Accuracy enabled.</li>
        </ol>
      </details>
      <p>Then come back and tap <strong>Try again</strong>.</p>
    </div>
  );
}

export function Permissions({ onDone, onPrivacy }: { onDone: () => void; onPrivacy: () => void }) {
  const [loc, setLoc] = useState<LocState>("idle");

  useEffect(() => {
    queryGeoPermission().then((s) => {
      if (s === "granted") setLoc("granted");
      if (s === "denied") setLoc("denied");
    });
  }, []);

  const askLocation = async () => {
    setLoc("asking");
    try {
      await getFreshFix(20_000);
      setLoc("granted");
    } catch (e) {
      setLoc(e instanceof GeoError ? e.kind : "unavailable");
    }
  };

  const locFailed = loc !== "idle" && loc !== "asking" && loc !== "granted";

  return (
    <main className="screen-scroll bg-navy-900">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pt-safe pb-safe">
        <div className="mt-4 flex items-center gap-3 text-white">
          <BisonMascot size={64} />
          <div>
            <p className="font-display text-sm font-semibold uppercase tracking-widest text-orange-300">Before you set out</p>
            <h1 className="font-display text-3xl font-bold leading-tight">Gear up, explorer</h1>
          </div>
        </div>

        <section className="card mt-5 p-4" aria-labelledby="perm-loc">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-900 text-orange-300"><Icon.Pin /></span>
            <div className="min-w-0 flex-1">
              <h2 id="perm-loc" className="font-display text-xl font-semibold text-navy-900">Location</h2>
              <p className="text-[15px] text-ink-muted">
                Shows you on the map and confirms you&apos;re really at each spot. We only check while the map is open. No background tracking, and your location is never stored.
              </p>
            </div>
          </div>
          <div className="mt-3" aria-live="polite">
            {loc === "granted" ? (
              <p className="flex items-center gap-2 rounded-xl bg-ok-bg p-3 font-bold text-ok"><Icon.Check /> Location is on</p>
            ) : locFailed ? (
              <div className="space-y-3 rounded-xl border-2 border-bad/30 bg-bad-bg/50 p-3">
                <p className="flex items-center gap-2 font-bold text-bad"><Icon.Cross /> Location isn&apos;t available yet</p>
                <LocationHelp kind={loc as GeoErrorKind} />
                <button className="btn btn-navy w-full" onClick={askLocation}>Try again</button>
              </div>
            ) : (
              <button className="btn btn-navy w-full" onClick={askLocation} disabled={loc === "asking"}>
                {loc === "asking" ? "Waiting for your answer…" : "Allow location"}
              </button>
            )}
          </div>
        </section>

        <section className="card mt-3 p-4" aria-labelledby="perm-cam">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-900 text-orange-300"><Icon.Camera /></span>
            <div>
              <h2 id="perm-cam" className="font-display text-xl font-semibold text-navy-900">Camera</h2>
              <p className="text-[15px] text-ink-muted">
                We&apos;ll ask the first time you take a photo. If you&apos;d rather not, you can use your phone&apos;s own camera app instead.
              </p>
            </div>
          </div>
        </section>

        <p className="mt-3 px-1 text-sm text-navy-200">
          Photos you submit are sent through our photo checker to Anthropic&apos;s Claude to confirm the place. Our checker doesn&apos;t store them. Your album stays on this phone.{" "}
          <button className="font-bold text-orange-300 underline underline-offset-2" onClick={onPrivacy}>Details</button>
        </p>

        <div className="mt-auto pt-6">
          <button className="btn btn-primary w-full !min-h-14 text-xl" onClick={onDone}>
            {loc === "granted" ? "To the map!" : "Continue to the map"}
          </button>
          {loc !== "granted" ? (
            <p className="mt-2 text-center text-sm text-navy-200">You can turn location on later. You&apos;ll need it to collect gems.</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
