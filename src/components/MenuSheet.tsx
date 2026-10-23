"use client";

import { useEffect, useState } from "react";
import { HUNT } from "@/config/hunt";
import { checkPlacementRule } from "@/lib/geo";
import { fetchServerStatus, type ServerStatus } from "@/lib/client/verify-api";
import type { InstallState } from "@/lib/client/pwa";
import { VERIFY_URL } from "@/lib/site";
import { Icon } from "./art";
import { Modal } from "./ui";

export type MenuPage = "main" | "privacy" | "howto" | "setup" | "demo" | "install";

export function MenuSheet({
  open,
  page,
  setPage,
  onClose,
  demo,
  albumCount,
  persistent,
  onOpenAlbum,
  onToggleDemo,
  onRestart,
  onDeleteAll,
  install,
}: {
  open: boolean;
  page: MenuPage;
  setPage: (p: MenuPage) => void;
  onClose: () => void;
  demo: boolean;
  albumCount: number;
  persistent: boolean;
  onOpenAlbum: () => void;
  onToggleDemo: () => void;
  onRestart: () => void;
  onDeleteAll: () => void;
  install: InstallState;
}) {
  const title =
    page === "main" ? "Menu" : page === "privacy" ? "Privacy & your data" : page === "howto" ? "How to play" : page === "setup" ? "Setup status" : page === "install" ? "Add to Home Screen" : "Demo Mode";
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {page !== "main" ? (
        <button className="btn btn-ghost !min-h-11 -mt-2 mb-2 !px-0 text-navy-700" onClick={() => setPage("main")}>
          ← Back to menu
        </button>
      ) : null}
      {page === "main" ? (
        <nav className="flex flex-col gap-2" aria-label="Menu">
          <button className="btn btn-cream justify-start" onClick={onOpenAlbum}>
            <Icon.Album /> My album ({albumCount})
          </button>
          {!install.installed ? (
            <button className="btn btn-cream justify-start" onClick={() => setPage("install")}>
              <Icon.Download /> Add to Home Screen
            </button>
          ) : null}
          <button className="btn btn-cream justify-start" onClick={() => setPage("howto")}>
            <Icon.Question /> How to play
          </button>
          <button className="btn btn-cream justify-start" onClick={() => setPage("privacy")}>
            <Icon.Pin /> Privacy &amp; your data
          </button>
          <button className="btn btn-cream justify-start" onClick={() => setPage("demo")}>
            <span className="h-5 w-5 rounded demo-stripes" aria-hidden /> Demo Mode: {demo ? "ON" : "off"}
          </button>
          <button className="btn btn-cream justify-start" onClick={() => setPage("setup")}>
            <Icon.Route /> Setup status (organizers)
          </button>
          {!persistent ? (
            <p className="rounded-2xl bg-warn-bg p-3 text-sm font-semibold text-warn">
              This browser blocked saving, so progress is only kept until you close this tab.
            </p>
          ) : null}
          <hr className="my-2 border-cream-200" />
          <button className="btn btn-cream justify-start text-bad" onClick={onRestart}>
            <Icon.Refresh /> Restart this hunt
          </button>
          <button className="btn btn-cream justify-start text-bad" onClick={onDeleteAll}>
            <Icon.Close /> Delete my hunt data
          </button>
        </nav>
      ) : null}
      {page === "howto" ? <HowTo /> : null}
      {page === "privacy" ? <Privacy /> : null}
      {page === "setup" ? <SetupStatus /> : null}
      {page === "demo" ? <DemoInfo demo={demo} onToggle={onToggleDemo} /> : null}
      {page === "install" ? <InstallHelp install={install} /> : null}
    </Modal>
  );
}

export function InstallHelp({ install }: { install: InstallState }) {
  const [result, setResult] = useState<string | null>(null);
  if (install.installed) {
    return <p className="rounded-2xl bg-ok-bg p-3 font-bold text-ok">You&apos;re using the home-screen app. You&apos;re all set!</p>;
  }
  return (
    <div className="space-y-3 text-[15px] text-ink">
      <p>Add Bison Quest to your home screen and it opens full-screen like a regular app, even without signal once it&apos;s loaded.</p>
      {install.canPrompt ? (
        <button
          className="btn btn-primary w-full"
          onClick={async () => setResult((await install.prompt()) ? "Installed! Open Bison Quest from your home screen." : "No problem. You can install it later from this menu.")}
        >
          <Icon.Download /> Install Bison Quest
        </button>
      ) : null}
      {result ? <p className="rounded-2xl bg-cream-100 p-3 font-semibold">{result}</p> : null}
      <details className="rounded-xl bg-cream-100 p-3" open={install.ios}>
        <summary className="cursor-pointer font-bold">iPhone or iPad (Safari)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Open this page in <strong>Safari</strong>.</li>
          <li>Tap the <strong>Share</strong> button (the square with an arrow).</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
        </ol>
      </details>
      <details className="rounded-xl bg-cream-100 p-3" open={!install.ios && !install.canPrompt}>
        <summary className="cursor-pointer font-bold">Android (Chrome)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Tap the <strong>⋮</strong> menu at the top right.</li>
          <li>Tap <strong>Add to Home screen</strong> (or <strong>Install app</strong>), then <strong>Install</strong>.</li>
        </ol>
      </details>
      <p className="rounded-2xl bg-warn-bg p-3 text-sm font-semibold text-warn">
        Install before you start: on iPhone, the home-screen app and Safari keep separate progress and albums.
      </p>
    </div>
  );
}

function HowTo() {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-[15px] text-ink">
      <li><strong>Solve</strong> the clue in the card at the bottom of the map.</li>
      <li><strong>Explore:</strong> the dashed circle is the search area. It shrinks as you use hints. Distances are straight-line estimates, not walking routes, so use paths and crosswalks.</li>
      <li><strong>Photograph</strong> the spot when the card says you&apos;re in range. Follow the &ldquo;What to capture&rdquo; tip.</li>
      <li><strong>Collect:</strong> we check your location and your photo separately. You get the gem only when both pass.</li>
      <li>Stuck? Hint 1 nudges you; Hint 2 names the place.</li>
    </ol>
  );
}

function Privacy() {
  return (
    <div className="space-y-3 text-[15px] text-ink">
      <p><strong>No account, no tracking.</strong> There are no analytics and no public photo feed.</p>
      <p><strong>Location</strong> is read only while the map or a check is on screen. It&apos;s used to show you on the map and to check you&apos;re at a checkpoint. When you submit a photo, your current coordinates are sent with it for the check. We don&apos;t store them.</p>
      <p><strong>Photos</strong> you submit are resized on your phone (which also removes hidden location data), then sent through our photo checker to Anthropic&apos;s Claude vision model to confirm the place. Our checker doesn&apos;t store them. Anthropic handles them under its API data policies.</p>
      <p><strong>Your album</strong> (accepted photos and progress) is saved only in this browser on this device. Use &ldquo;Delete my hunt data&rdquo; in the menu to erase it.</p>
      <p className="text-sm text-ink-muted">Browser location can be faked by a determined person. This is a friendly game, not a security system.</p>
    </div>
  );
}

function DemoInfo({ demo, onToggle }: { demo: boolean; onToggle: () => void }) {
  return (
    <div className="space-y-3 text-[15px] text-ink">
      <div className="h-3 rounded demo-stripes" aria-hidden />
      <p>Demo Mode lets you try the whole hunt away from campus. You move by tapping the map and choose what the photo check answers.</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Nothing is really verified.</strong> GPS and photo checks are simulated.</li>
        <li>Demo progress is stored separately and never counts toward a real hunt.</li>
        <li>A striped banner stays on screen the whole time.</li>
      </ul>
      <button className={`btn w-full ${demo ? "btn-navy" : "btn-primary"}`} onClick={onToggle}>
        {demo ? "Exit Demo Mode (back to live play)" : "Turn on Demo Mode"}
      </button>
    </div>
  );
}

function SetupStatus() {
  const [status, setStatus] = useState<ServerStatus | null | "loading">("loading");
  useEffect(() => {
    fetchServerStatus().then(setStatus);
  }, []);
  const placement = checkPlacementRule(HUNT);
  const badge = (ok: boolean, okText: string, badText: string) => (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ok ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"}`}>{ok ? okText : badText}</span>
  );
  return (
    <div className="space-y-4 text-[15px] text-ink">
      <section>
        <h3 className="font-display text-lg font-semibold">First checkpoint placement rule</h3>
        <p>
          {HUNT.gems[0].destinationName} checkpoint → {placement.referenceName}:{" "}
          <strong>{placement.distanceMeters.toFixed(1)} m ({placement.distanceFeet.toFixed(0)} ft)</strong> straight-line. Limit {placement.limitMeters} m (500 ft).{" "}
          {badge(placement.passes, "Within limit", "Too far")}
        </p>
        <p className="text-sm text-ink-muted">This is straight-line (Haversine) distance, not walking distance. Reference: {HUNT.placementRule.referenceSource}.</p>
      </section>
      <section>
        <h3 className="font-display text-lg font-semibold">Photo verification</h3>
        {status === "loading" ? (
          <p>Checking server…</p>
        ) : status ? (
          <p>
            {badge(status.verificationConfigured, "API key set", "API key missing")} Model: <code>{status.model}</code>
          </p>
        ) : !VERIFY_URL ? (
          <p className="text-warn">No photo checker address was set when this site was built (NEXT_PUBLIC_VERIFY_URL). See DEPLOYING.md.</p>
        ) : (
          <p className="text-warn">Couldn&apos;t reach the photo checker at {VERIFY_URL}.</p>
        )}
      </section>
      <section>
        <h3 className="font-display text-lg font-semibold">Checkpoints</h3>
        <ul className="space-y-2">
          {HUNT.gems.map((g) => (
            <li key={g.id} className="rounded-xl bg-cream-100 p-3">
              <p className="font-bold">{g.destinationName}</p>
              <p className="text-sm">
                Coordinates: {badge(g.checkpoint.status === "field-verified", "field-verified", g.checkpoint.status)}{" "}
                <span className="text-ink-muted">({g.checkpoint.lat.toFixed(6)}, {g.checkpoint.lng.toFixed(6)})</span>
              </p>
              <p className="text-sm">
                Reference photos: {badge(g.photo.referenceImages.length > 0, `${g.photo.referenceImages.length} configured`, "none yet")}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-ink-muted">Edit these in src/config/hunt.ts. See CONFIGURING.md.</p>
      </section>
    </div>
  );
}
