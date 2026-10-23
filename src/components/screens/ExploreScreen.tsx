"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HUNT, type GemConfig, type LatLng } from "@/config/hunt";
import { formatApproxDistance, warmthFor, type GeoFix, type LocationCheck } from "@/lib/geo";
import type { GeoErrorKind } from "@/lib/client/geolocation";
import { gemState, type Progress } from "@/lib/progress";
import type { MapGem } from "../ExploreMap";
import { BisonMascot, GemSvg, Icon } from "../art";
import { Modal } from "../ui";
import { LocationHelp } from "./Permissions";

const ExploreMap = dynamic(() => import("../ExploreMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-grass-300" aria-hidden />,
});

const WARMTH_TEXT = { far: "Far away", warmer: "Getting warmer", close: "Very close!", here: "You're here!" } as const;

function LocationStatus({
  check,
  geoError,
  demo,
  onFix,
}: {
  check: LocationCheck | null;
  geoError: GeoErrorKind | null;
  demo: boolean;
  onFix: () => void;
}) {
  let tone = "bg-cream-200 text-ink";
  let text: ReactNode = "Finding your location…";
  let action: ReactNode = null;
  if (!demo && geoError && (geoError !== "timeout" || !check)) {
    tone = "bg-bad-bg text-bad";
    text = geoError === "denied" ? "Location is off" : geoError === "insecure" ? "Location needs https" : "No GPS signal yet";
    action = (
      <button className="ml-auto shrink-0 rounded-full bg-bad px-3 py-1.5 text-sm font-bold text-white min-h-11" onClick={onFix}>
        How to fix
      </button>
    );
  } else if (check) {
    switch (check.status) {
      case "in_range":
        tone = "bg-ok-bg text-ok";
        text = <><Icon.Check size={18} /> You&apos;re here! Take the photo.</>;
        break;
      case "out_of_range":
        tone = "bg-navy-200/60 text-navy-900";
        text = (
          <span>
            <strong>{WARMTH_TEXT[warmthFor(check.distanceMeters ?? 9999, check.radiusMeters)]}</strong> · {formatApproxDistance(check.distanceMeters ?? 0)} straight-line
          </span>
        );
        break;
      case "low_accuracy":
        tone = "bg-warn-bg text-warn";
        text = `GPS is fuzzy (±${Math.round(check.accuracyMeters ?? 0)} m). Step into the open and wait a moment.`;
        break;
      case "stale":
        tone = "bg-warn-bg text-warn";
        text = "Location reading is out of date. Waiting for a fresh one…";
        break;
      default:
        break;
    }
  }
  return (
    <div className={`flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-[15px] font-semibold ${tone}`} role="status" aria-live="polite">
      <Icon.Pin size={18} className="shrink-0" />
      <span className="flex items-center gap-1">{text}</span>
      {action}
    </div>
  );
}

export function ExploreScreen({
  progress,
  gem,
  fix,
  geoError,
  locationCheck,
  online,
  demo,
  mapGems,
  hasPending,
  farFromCampus,
  persistent,
  demoControls,
  onMapTap,
  onCamera,
  onHint,
  onMenu,
  onAlbum,
  onExitDemo,
}: {
  progress: Progress;
  gem: GemConfig | null;
  fix: GeoFix | null;
  geoError: GeoErrorKind | null;
  locationCheck: LocationCheck | null;
  online: boolean;
  demo: boolean;
  mapGems: MapGem[];
  hasPending: boolean;
  farFromCampus: boolean;
  persistent: boolean;
  demoControls: ReactNode;
  onMapTap?: (p: LatLng) => void;
  onCamera: () => void;
  onHint: (level: 1 | 2) => void;
  onMenu: () => void;
  onAlbum: () => void;
  onExitDemo: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [recenterKey, setRecenterKey] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const hintLevel = gem ? progress.hintLevels[gem.id] ?? 0 : 0;
  const index = progress.collected.length;
  const inRange = locationCheck?.status === "in_range";
  const sheetRef = useRef<HTMLElement>(null);
  const [sheetHeight, setSheetHeight] = useState(320);
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setSheetHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const activeZone = mapGems.find((g) => g.state === "active")?.zone ?? null;

  return (
    <main className="screen bg-grass-300" aria-label="Explore">
      <ExploreMap
        center={HUNT.mapCenter}
        player={fix}
        gems={mapGems}
        recenterKey={recenterKey}
        focus={activeZone?.center ?? null}
        focusRadius={activeZone?.radiusMeters ?? 100}
        focusKey={gem?.id ?? "done"}
        bottomInset={sheetHeight}
        onMapTap={onMapTap}
        playerLabel={demo ? "Your simulated position" : "Your position"}
      />
      <div className="map-vignette pointer-events-none absolute inset-0 z-[500]" aria-hidden />

      {/* Top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1100]">
        {demo ? (
          <div className="pointer-events-auto demo-stripes flex items-center justify-between gap-2 px-3 pb-1.5 pt-safe text-white [text-shadow:0_1px_2px_#000]">
            <span className="font-display text-[15px] font-semibold leading-tight">DEMO MODE · nothing is really verified</span>
            <button className="min-h-11 rounded-full bg-black/80 px-3 text-sm font-bold" onClick={onExitDemo}>Exit</button>
          </div>
        ) : null}
        <div className={`flex items-start justify-between gap-2 px-3 ${demo ? "pt-2" : "pt-safe"}`}>
          <button
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-navy-900/90 py-1 pl-1 pr-3 text-white shadow-lg min-h-12"
            onClick={onAlbum}
            aria-label={`Progress: ${progress.collected.length} of ${HUNT.gems.length} gems collected. Open album.`}
          >
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-orange-500">
              <BisonMascot size={44} aria-hidden />
            </span>
            <span className="flex items-center gap-0.5" aria-hidden>
              {HUNT.gems.map((g) => (
                <GemSvg key={g.id} color={g.color} state={gemState(progress, HUNT, g.id)} size={28} />
              ))}
            </span>
            <span className="font-display text-lg font-semibold" aria-hidden>
              {progress.collected.length}/{HUNT.gems.length}
            </span>
          </button>
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <button className="btn btn-cream !min-h-12 !min-w-12 !p-0" onClick={onMenu} aria-label="Open menu">
              <Icon.Menu />
            </button>
            <button className="btn btn-cream !min-h-12 !min-w-12 !p-0" onClick={() => setRecenterKey((k) => k + 1)} aria-label="Center map on me">
              <Icon.Locate />
            </button>
            {demo ? <div className="relative">{demoControls}</div> : null}
          </div>
        </div>
        <div className="mt-2 flex flex-col items-center gap-2 px-3">
          {!online ? (
            <p className="pointer-events-auto flex items-center gap-2 rounded-full bg-navy-950 px-3 py-1.5 text-sm font-bold text-white" role="status">
              <Icon.Offline size={18} /> Offline: you can explore, but checks need internet
            </p>
          ) : null}
          {!persistent ? (
            <p className="pointer-events-auto rounded-full bg-warn-bg px-3 py-1.5 text-sm font-bold text-warn" role="status">
              Saving is blocked in this browser: progress lasts until you close the tab
            </p>
          ) : null}
        </div>
      </div>

      {/* Bottom sheet */}
      <section
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 z-[1000] mx-auto max-w-lg px-2 pb-safe sm:inset-x-auto sm:left-4 sm:mx-0 sm:w-[26rem] sm:px-0"
        aria-label={gem ? `Clue for gem ${index + 1}` : "Quest complete"}
      >
        {gem ? (
          <div className="relative flex justify-center">
            <div className="absolute -top-[68px] flex flex-col items-center">
              <button
                onClick={onCamera}
                className={`focus-ring relative flex h-[76px] items-center justify-center gap-2 rounded-full border-[5px] border-white text-navy-950 shadow-[0_8px_20px_rgba(7,26,51,.45)] transition-all active:scale-95 ${inRange ? "bg-orange-500 px-6" : "w-[76px] bg-cream-100"}`}
                aria-label={hasPending ? "Open camera: you have a saved photo for this gem" : inRange ? "Take photo: you're in range" : "Open camera"}
              >
                {inRange ? <span className="player-ring !h-[76px] !w-full !rounded-full !bg-orange-500/40" aria-hidden /> : null}
                <Icon.Camera size={34} className="relative" />
                {inRange ? <span className="font-display relative text-xl font-semibold">Take photo</span> : null}
                {hasPending ? <span className="absolute -right-1 -top-1 h-5 w-5 rounded-full border-2 border-white bg-teal-400" aria-hidden /> : null}
              </button>
            </div>
          </div>
        ) : null}

        <div className="card relative px-4 pb-3 pt-2">
          <button
            className="mx-auto flex min-h-11 w-full items-center justify-between text-left"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-controls="clue-body"
          >
            <span className="flex items-center gap-2">
              {gem ? <GemSvg color={gem.color} state="active" size={30} /> : <GemSvg color="#1d7a38" state="collected" size={30} />}
              <span className="font-display text-sm font-semibold uppercase tracking-wider text-orange-700">
                {gem ? `Gem ${index + 1} of ${HUNT.gems.length} · ${gem.gemName}` : "Quest complete"}
              </span>
            </span>
            <span className="flex items-center gap-1 text-sm font-bold text-navy-700">
              {expanded ? "Hide" : "Show clue"} {expanded ? <Icon.ChevronDown size={20} /> : <Icon.ChevronUp size={20} />}
            </span>
          </button>

          {gem ? (
            <div id="clue-body" className={expanded ? "mt-1 max-h-[min(46dvh,calc(100dvh-300px))] overflow-y-auto overscroll-contain pr-1" : "hidden"}>
              <blockquote className="font-display text-[18px] leading-snug text-navy-900">
                {gem.clue.map((line, i) => (
                  <span key={i} className="block">{line}</span>
                ))}
              </blockquote>
              <div className="mt-3">
                <LocationStatus check={locationCheck} geoError={geoError} demo={demo} onFix={() => setHelpOpen(true)} />
              </div>
              {farFromCampus && !demo ? (
                <p className="mt-2 rounded-2xl bg-warn-bg p-3 text-sm font-semibold text-warn">
                  You seem to be away from Bucknell. This hunt is played on campus in Lewisburg, PA. To preview it from here, turn on Demo Mode in the menu.
                </p>
              ) : null}
              {hintLevel > 0 ? (
                <div className="mt-3 space-y-2">
                  {gem.hints.slice(0, hintLevel).map((h, i) => (
                    <p key={i} className="rounded-2xl border-2 border-orange-300 bg-orange-100 p-3 text-[15px] text-ink">
                      <strong className="text-orange-700">Hint {i + 1}:</strong> {h}
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {hintLevel < 2 ? (
                  <button className="btn btn-cream !min-h-11 flex-1 text-base" onClick={() => onHint(hintLevel === 0 ? 1 : 2)}>
                    <Icon.Bulb size={20} /> {hintLevel === 0 ? "Need a hint?" : "Hint 2: name the place"}
                  </button>
                ) : (
                  <a
                    className="btn btn-cream !min-h-11 flex-1 text-base"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${gem.checkpoint.lat},${gem.checkpoint.lng}&travelmode=walking`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon.Route size={20} /> Walking directions (Google Maps)
                  </a>
                )}
              </div>
              <p className="mt-2 text-center text-xs text-ink-muted">
                {hintLevel === 0 ? "The dashed circle shows the search area. Hints make it smaller." : "Stay on paths: the map doesn't show a walking route."}
              </p>
            </div>
          ) : (
            <div id="clue-body" className={expanded ? "mt-2" : "hidden"}>
              <p className="text-[15px] text-ink">Every gem is collected. Your album is ready to save and share.</p>
              <button className="btn btn-primary mt-3 w-full" onClick={onAlbum}><Icon.Album /> Open my album</button>
            </div>
          )}
        </div>
      </section>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Turn on location">
        <LocationHelp kind={geoError ?? "denied"} />
        <button className="btn btn-primary mt-4 w-full" onClick={() => location.reload()}>I&apos;ve changed it: reload</button>
      </Modal>
    </main>
  );
}
