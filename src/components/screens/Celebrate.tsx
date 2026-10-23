"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { GemConfig } from "@/config/hunt";
import { GemSvg, Icon } from "../art";

const PARTICLES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2;
  const dist = 110 + (i % 3) * 40;
  return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, delay: (i % 4) * 40, size: 8 + (i % 3) * 4 };
});

export function Celebrate({
  gem,
  index,
  total,
  photoUrl,
  fresh,
  isLast,
  simulated,
  onContinue,
}: {
  gem: GemConfig;
  index: number;
  total: number;
  photoUrl: string | null;
  fresh: boolean;
  isLast: boolean;
  simulated: boolean;
  onContinue: () => void;
}) {
  const [showStory, setShowStory] = useState(!fresh);

  useEffect(() => {
    if (!fresh) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setShowStory(true), reduce ? 300 : 1700);
    navigator.vibrate?.([30, 40, 60]);
    return () => clearTimeout(t);
  }, [fresh]);

  return (
    <main className="screen-scroll bg-navy-900" aria-labelledby="collect-title">
      {/* Radiant backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="animate-spin-slow absolute left-1/2 top-[22%] h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2 opacity-25"
          style={{ background: `repeating-conic-gradient(${gem.color} 0 10deg, transparent 10deg 24deg)` }}
        />
      </div>

      <div className="relative mx-auto flex min-h-full max-w-md flex-col px-4 pt-safe pb-safe">
        <div className="relative mt-6 flex h-52 items-center justify-center">
          {fresh
            ? PARTICLES.map((p, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="absolute rounded-full"
                  style={
                    {
                      width: p.size,
                      height: p.size,
                      background: i % 2 ? gem.color : "#fff5b8",
                      "--dx": `${p.dx}px`,
                      "--dy": `${p.dy}px`,
                      animation: `burst 900ms ${p.delay}ms cubic-bezier(.2,.8,.3,1) both`,
                    } as CSSProperties
                  }
                />
              ))
            : null}
          <div className="animate-pop-in relative overflow-hidden rounded-full p-3" style={{ boxShadow: `0 0 60px 10px ${gem.color}88` }}>
            <GemSvg color={gem.color} state="collected" size={150} title={`${gem.gemName}, collected`} />
            <span aria-hidden className="shine absolute inset-y-0 left-1/3 w-8 bg-white/70 blur-md" style={{ animation: "var(--animate-shine)" }} />
          </div>
        </div>

        <div className="text-center text-white">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">
            Gem {index + 1} of {total} collected
          </p>
          <h1 id="collect-title" className="font-display text-4xl font-bold">{gem.gemName}!</h1>
          {simulated ? (
            <p className="mt-1 inline-block rounded-full demo-stripes p-1 text-sm font-bold">
              <span className="block rounded-full bg-black/85 px-3 py-0.5 text-white">Demo Mode: simulated, not verified</span>
            </p>
          ) : null}
        </div>

        {showStory ? (
          <article className="card animate-rise-in mt-5 overflow-hidden" aria-labelledby="disc-title">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={`Your photo of ${gem.destinationName}`} className="h-48 w-full object-cover" />
            ) : null}
            <div className="p-4">
              <p className="font-display text-sm font-semibold uppercase tracking-widest text-orange-700">Discovery · {gem.destinationName}</p>
              <h2 id="disc-title" className="font-display mt-1 text-2xl font-semibold leading-tight text-navy-900">{gem.discovery.title}</h2>
              <p className="mt-2 text-[16px] leading-relaxed text-ink">{gem.discovery.body}</p>
              <div className="mt-3 rounded-2xl border-2 border-orange-300 bg-orange-100 p-3">
                <p className="font-display font-semibold text-orange-700">Look closer</p>
                <p className="text-[15px] text-ink">{gem.discovery.noticeThis}</p>
              </div>
              <p className="mt-3 text-sm text-ink-muted">
                Source:{" "}
                {gem.discovery.source.map((s, i) => (
                  <span key={s.url}>
                    {i > 0 ? "; " : ""}
                    <a className="font-semibold text-navy-700 underline underline-offset-2" href={s.url} target="_blank" rel="noreferrer">
                      {s.label}
                    </a>
                  </span>
                ))}
              </p>
            </div>
          </article>
        ) : (
          <p className="mt-6 text-center text-navy-200" aria-live="polite">Unlocking its story…</p>
        )}

        <div className="mt-auto pt-6">
          <button className="btn btn-primary w-full !min-h-14 text-xl" onClick={onContinue} disabled={!showStory}>
            {isLast ? (
              <>
                <Icon.Album /> Open my album
              </>
            ) : (
              <>Reveal the next clue</>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
