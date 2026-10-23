"use client";

import { HUNT } from "@/config/hunt";
import { BisonMascot, GemSvg, Icon } from "../art";

const STEPS = [
  { n: 1, title: "Solve", text: "Read a riddle about a real campus spot.", icon: <Icon.Bulb size={22} /> },
  { n: 2, title: "Explore", text: "Walk there with the live map.", icon: <Icon.Pin size={22} /> },
  { n: 3, title: "Photograph", text: "Snap the place to prove you found it.", icon: <Icon.Camera size={22} /> },
  { n: 4, title: "Collect", text: "Earn a gem and a hidden story.", icon: <GemSvg color="#F28C28" state="active" size={24} /> },
];

export function Welcome({
  onStart,
  onPrivacy,
  onInstall,
}: {
  onStart: () => void;
  onPrivacy: () => void;
  /** Present only when the app isn't already installed. */
  onInstall?: () => void;
}) {
  return (
    <main className="screen-scroll bg-navy-900 text-white">
      {/* Illustrated "map horizon" backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] overflow-hidden">
        <div className="absolute -left-1/4 bottom-0 h-full w-[150%] rounded-t-[50%] bg-grass-500" />
        <div className="absolute -left-1/4 bottom-0 h-[82%] w-[150%] rounded-t-[50%] bg-grass-300" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="none">
          <path d="M-10 290 C 80 250, 120 200, 200 190 S 330 120, 420 100" stroke="#fff8e6" strokeWidth="14" fill="none" strokeLinecap="round" />
          <path d="M-10 290 C 80 250, 120 200, 200 190 S 330 120, 420 100" stroke="#e3cc9f" strokeWidth="2" strokeDasharray="2 14" fill="none" />
        </svg>
        <div className="gem-float absolute left-[14%] top-[30%]"><GemSvg color="#F28C28" state="active" size={44} /></div>
        <div className="gem-float absolute right-[12%] top-[12%]" style={{ animationDelay: "-1.3s" }}><GemSvg color="#2EC4B6" state="active" size={38} /></div>
      </div>

      <div className="relative mx-auto flex min-h-full max-w-md flex-col px-5 pt-safe pb-safe">
        <div className="mt-6 flex flex-col items-center text-center">
          <div className="animate-pop-in flex h-40 w-40 items-center justify-center rounded-full bg-cream-100 shadow-[0_0_0_8px_rgba(242,140,40,0.9),0_0_60px_18px_rgba(242,140,40,0.35)]">
            <BisonMascot size={136} />
          </div>
          <p className="font-display mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">Bucknell University</p>
          <h1 className="font-display text-[3.2rem] leading-none font-bold tracking-tight">
            Bison <span className="text-orange-500">Quest</span>
          </h1>
          <p className="mt-3 max-w-xs text-lg font-semibold text-cream-100">{HUNT.tagline}</p>
        </div>

        <ol className="card mt-6 grid grid-cols-2 gap-2 p-3 text-ink" aria-label="How to play">
          {STEPS.map((s) => (
            <li key={s.n} className="flex flex-col gap-1 rounded-2xl bg-cream-100 p-3">
              <div className="flex items-center gap-2 text-navy-800">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-orange-300">{s.icon}</span>
                <span className="font-display text-lg font-semibold">{s.title}</span>
              </div>
              <p className="text-[14px] leading-snug text-ink-muted">{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-auto flex flex-col items-center gap-3 pt-8">
          <p className="rounded-full bg-navy-950/80 px-4 py-1.5 text-sm font-bold text-white">2 gems · short walk · no account</p>
          <button className="btn btn-primary w-full !min-h-14 text-xl" onClick={onStart}>
            Start exploring
          </button>
          <div className="flex flex-wrap justify-center gap-2">
            {onInstall ? (
              <button className="btn btn-ghost min-h-11 rounded-full bg-cream-50/90 px-4 text-sm font-bold text-navy-900" onClick={onInstall}>
                <Icon.Download size={18} /> Add to Home Screen
              </button>
            ) : null}
            <button className="btn btn-ghost min-h-11 rounded-full bg-cream-50/90 px-4 text-sm font-bold text-navy-900" onClick={onPrivacy}>
              Privacy
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
