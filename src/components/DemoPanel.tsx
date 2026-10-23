"use client";

import { useState } from "react";
import type { GemConfig } from "@/config/hunt";
import { demoPresets, type DemoGps, type DemoOutcome } from "@/lib/demo";

const OUTCOMES: { id: DemoOutcome; label: string }[] = [
  { id: "pass", label: "Pass" },
  { id: "wrong_photo", label: "Wrong photo" },
  { id: "uncertain", label: "Uncertain" },
  { id: "network_error", label: "Network fails" },
  { id: "server_error", label: "Server error" },
];

/** Floating Demo Mode controls. Only rendered in Demo Mode. */
export function DemoPanel({
  gem,
  outcome,
  setOutcome,
  setGps,
}: {
  gem: GemConfig | null;
  outcome: DemoOutcome;
  setOutcome: (o: DemoOutcome) => void;
  setGps: (g: DemoGps) => void;
}) {
  const [open, setOpen] = useState(false);
  const p = demoPresets(gem);
  const go = (g: DemoGps | null) => {
    if (!g) return;
    setGps(g);
    setOpen(false);
  };
  return (
    <div className="pointer-events-auto">
      <button
        className="btn demo-stripes !min-h-11 !px-1.5 text-sm"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="rounded-full bg-black/85 px-3 py-1.5 text-white">Demo controls</span>
      </button>
      {open ? (
        <div className="card animate-rise-in absolute right-0 mt-2 max-h-[60dvh] w-[min(19rem,calc(100vw-2rem))] overflow-y-auto p-3 text-ink">
          <p className="text-sm font-bold">Simulated position</p>
          <p className="text-xs text-ink-muted">Or tap anywhere on the map to move there.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button className="btn btn-cream !min-h-11 !px-2 text-sm" onClick={() => go(p.taylor)}>Taylor Hall</button>
            <button className="btn btn-cream !min-h-11 !px-2 text-sm" disabled={!p.atCheckpoint} onClick={() => go(p.atCheckpoint)}>At checkpoint</button>
            <button className="btn btn-cream !min-h-11 !px-2 text-sm" disabled={!p.nearby} onClick={() => go(p.nearby)}>150 m away</button>
            <button className="btn btn-cream !min-h-11 !px-2 text-sm" disabled={!p.poorGps} onClick={() => go(p.poorGps)}>Poor GPS ±85 m</button>
            <button className="btn btn-cream !min-h-11 !px-2 text-sm col-span-2" disabled={!p.staleGps} onClick={() => go(p.staleGps)}>Stale GPS (2 min old)</button>
          </div>
          <p className="mt-3 text-sm font-bold">Next photo check answers</p>
          <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Simulated photo check result">
            {OUTCOMES.map((o) => (
              <button
                key={o.id}
                role="radio"
                aria-checked={outcome === o.id}
                onClick={() => setOutcome(o.id)}
                className={`min-h-11 rounded-full border-2 px-3 text-sm font-bold ${outcome === o.id ? "border-navy-900 bg-navy-900 text-white" : "border-cream-300 bg-white text-ink"}`}
              >
                {outcome === o.id ? "✓ " : ""}
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
