"use client";

import { useEffect, useRef, useState } from "react";
import type { GemConfig } from "@/config/hunt";
import type { LocationCheck } from "@/lib/geo";
import type { Progress } from "@/lib/progress";
import type { SubmissionResult } from "@/lib/submission";
import type { PhotoCheck } from "@/lib/verification-types";
import { Icon } from "../art";
import { CheckRow, type CheckState } from "../ui";

function locState(l: LocationCheck | null | undefined): CheckState {
  if (!l) return "pending";
  if (l.passed) return "pass";
  return l.status === "low_accuracy" || l.status === "stale" ? "warn" : "fail";
}

function photoState(p: PhotoCheck | null | undefined): CheckState {
  if (!p) return "skipped";
  return p.verdict === "pass" ? "pass" : p.verdict === "uncertain" ? "warn" : "fail";
}

export function VerifyScreen({
  gem,
  photo,
  demo,
  online,
  run,
  onAwarded,
  onRetake,
  onBackToMap,
  onShowDemoInfo,
}: {
  gem: GemConfig;
  photo: Blob;
  demo: boolean;
  online: boolean;
  run: () => Promise<SubmissionResult>;
  onAwarded: (p: Progress) => void;
  onRetake: () => void;
  onBackToMap: (reason?: "collected") => void;
  onShowDemoInfo: () => void;
}) {
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const runRef = useRef(run);
  const onAwardedRef = useRef(onAwarded);
  /** One submission per attempt, even if React re-runs the effect. */
  const runs = useRef(new Map<number, Promise<SubmissionResult>>());
  const awardHandled = useRef(false);

  useEffect(() => {
    runRef.current = run;
    onAwardedRef.current = onAwarded;
  }, [run, onAwarded]);

  useEffect(() => {
    const u = URL.createObjectURL(photo);
    queueMicrotask(() => setUrl(u));
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  useEffect(() => {
    let p = runs.current.get(attempt);
    if (!p) {
      p = runRef.current();
      runs.current.set(attempt, p);
    }
    let alive = true;
    queueMicrotask(() => alive && setResult(null));
    p.then((r) => {
      if (!alive || r.kind === "busy") return;
      setResult(r);
      if (r.kind === "awarded" && !awardHandled.current) {
        awardHandled.current = true;
        setTimeout(() => onAwardedRef.current(r.progress), 900);
      }
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = () => setAttempt((a) => a + 1);
  const r = result;

  const location: LocationCheck | null = r && "location" in r ? r.location : null;
  const photoCheck: PhotoCheck | null = r && "photo" in r ? r.photo : null;
  const checking = !r;

  let headline = "Checking your discovery…";
  let body: string | null = null;
  if (r) {
    switch (r.kind) {
      case "awarded":
        headline = "Both checks passed!";
        break;
      case "location_failed":
        headline = r.location.status === "out_of_range" ? "Almost there" : "Let's fix your location";
        body = "Your photo is saved. Move closer or improve GPS, then check again. No need to retake.";
        break;
      case "photo_failed":
        headline = "That photo doesn't show the spot yet";
        body = "You're in the right place. Try another shot.";
        break;
      case "uncertain":
        headline = "We couldn't tell for sure";
        body = "To be fair to everyone, we only award gems when we're confident. A clearer shot usually fixes it.";
        break;
      case "offline":
        headline = "You're offline";
        body = "Checking photos needs an internet connection. Your photo is saved on this phone. Reconnect, then tap Try again.";
        break;
      case "service_error":
        headline = "The photo checker didn't answer";
        body = r.message;
        break;
      case "storage_error":
        headline = "Couldn't save to your phone";
        body = r.message;
        break;
      case "already_collected":
        headline = "Already collected!";
        body = "This gem is already in your album.";
        break;
      case "not_current":
        headline = "That gem isn't active";
        body = "Head back to the map for your current clue.";
        break;
    }
  }

  const pendingWarning = r && "pendingSaved" in r && r.pendingSaved === false;

  return (
    <main className="screen-scroll bg-navy-900">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pt-safe pb-safe">
        <div className="mt-2 flex items-center gap-3">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Your submitted photo" className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-lg" />
          ) : null}
          <div className="text-white">
            <p className="font-display text-sm font-semibold uppercase tracking-widest text-orange-300">{gem.gemName}</p>
            <h1 className="font-display text-2xl font-bold leading-tight" aria-live="polite">{headline}</h1>
          </div>
        </div>

        <div className="card mt-4 space-y-3 p-4">
          <CheckRow
            title="Location check"
            state={checking ? "pending" : locState(location)}
            detail={location ? location.message : checking ? "Getting a fresh GPS reading…" : undefined}
          />
          <CheckRow
            title="Photo check"
            state={checking ? (location?.passed ? "pending" : "skipped") : photoState(photoCheck)}
            detail={
              photoCheck ? (
                <>
                  <span>{photoCheck.reason}</span>
                  {photoCheck.feedback ? <span className="mt-1 block font-bold text-navy-800">Tip: {photoCheck.feedback}</span> : null}
                  {photoCheck.source === "simulated" ? <span className="mt-1 block text-sm font-bold text-warn">Simulated result (Demo Mode)</span> : null}
                </>
              ) : checking ? (
                "Comparing your photo with the checkpoint…"
              ) : r?.kind === "location_failed" ? (
                "We check the photo once your location passes."
              ) : undefined
            }
          />
          {body ? <p className="rounded-2xl bg-cream-100 p-3 text-[15px] text-ink">{body}</p> : null}
          {pendingWarning ? (
            <p className="rounded-2xl bg-warn-bg p-3 text-sm font-semibold text-warn">
              Heads up: your phone wouldn&apos;t let us save this photo, so it&apos;s only kept while this screen is open.
            </p>
          ) : null}
          <p className="text-xs text-ink-muted">
            {demo
              ? "Demo Mode: GPS and photo checks are simulated, not real."
              : "Location is checked with your browser's GPS (not tamper-proof). Your photo is checked by Anthropic's Claude and isn't stored by our checker."}
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-6">
          {r?.kind === "photo_failed" || r?.kind === "uncertain" ? (
            <>
              <button className="btn btn-primary !min-h-14 text-lg" onClick={onRetake}><Icon.Camera /> Retake photo</button>
              {r.kind === "uncertain" ? <button className="btn btn-cream" onClick={retry}><Icon.Refresh /> Check this photo again</button> : null}
              <button className="btn btn-ghost !min-h-11 text-white" onClick={() => onBackToMap()}>Back to map</button>
            </>
          ) : null}
          {r?.kind === "location_failed" ? (
            <>
              <button className="btn btn-primary !min-h-14 text-lg" onClick={retry}><Icon.Locate /> Check location again</button>
              <button className="btn btn-cream" onClick={() => onBackToMap()}>Back to map (photo saved)</button>
            </>
          ) : null}
          {r?.kind === "offline" || r?.kind === "service_error" || r?.kind === "storage_error" ? (
            <>
              <button
                className="btn btn-primary !min-h-14 text-lg"
                onClick={retry}
                disabled={(r.kind === "offline" && !online) || (r.kind === "service_error" && !r.retryable)}
              >
                <Icon.Refresh /> {r.kind === "offline" && !online ? "Waiting for connection…" : "Try again"}
              </button>
              {r.kind === "service_error" && !r.retryable && !demo ? (
                <button className="btn btn-cream" onClick={onShowDemoInfo}>What is Demo Mode?</button>
              ) : null}
              <button className="btn btn-cream" onClick={() => onBackToMap()}>Back to map (photo saved)</button>
            </>
          ) : null}
          {r?.kind === "already_collected" || r?.kind === "not_current" ? (
            <button className="btn btn-primary" onClick={() => onBackToMap(r.kind === "already_collected" ? "collected" : undefined)}>Back to map</button>
          ) : null}
        </div>
      </div>
    </main>
  );
}
