"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HUNT, type LatLng } from "@/config/hunt";
import { evaluateFix, haversineMeters, searchZoneFor } from "@/lib/geo";
import { getFreshFix, useForegroundPosition } from "@/lib/client/geolocation";
import { photoLooksBlank } from "@/lib/client/image";
import { registerServiceWorker, useInstall } from "@/lib/client/pwa";
import { verifyRemote } from "@/lib/client/verify-api";
import { DEMO_START, demoFix, simulatedVerify, type DemoGps, type DemoOutcome } from "@/lib/demo";
import { MemoryHuntStore, type HuntStoreLike } from "@/lib/memory-store";
import { currentGem, initialProgress, isComplete, revealHint, type PlayMode, type Progress } from "@/lib/progress";
import { deleteAllHuntData, HuntStore, type StoredPhoto } from "@/lib/storage";
import { submitCheckpoint } from "@/lib/submission";
import { BisonMascot } from "./art";
import { DemoPanel } from "./DemoPanel";
import type { MapGem } from "./ExploreMap";
import { MenuSheet, type MenuPage } from "./MenuSheet";
import { AlbumScreen, type AlbumItem } from "./screens/AlbumScreen";
import { CameraScreen } from "./screens/CameraScreen";
import { Celebrate } from "./screens/Celebrate";
import { ExploreScreen } from "./screens/ExploreScreen";
import { Permissions } from "./screens/Permissions";
import { VerifyScreen } from "./screens/VerifyScreen";
import { Welcome } from "./screens/Welcome";
import { ConfirmDialog, Toast } from "./ui";

type Screen =
  | { name: "loading" }
  | { name: "welcome" }
  | { name: "permissions" }
  | { name: "explore" }
  | { name: "camera"; useSaved: boolean }
  | { name: "verify"; photo: Blob; attempt: number }
  | { name: "celebrate"; gemId: string; fresh: boolean }
  | { name: "album" };

type Confirm = "restart" | "delete" | null;

const MODE_KEY = "bison-quest-mode";

function readMode(): PlayMode {
  try {
    return localStorage.getItem(MODE_KEY) === "demo" ? "demo" : "live";
  } catch {
    return "live";
  }
}
function writeMode(m: PlayMode) {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* per-viewer convenience only */
  }
}

function screenFor(p: Progress): Screen {
  if (!p.onboarded) return { name: "welcome" };
  if (p.unseenDiscovery) return { name: "celebrate", gemId: p.unseenDiscovery, fresh: false };
  if (isComplete(p, HUNT)) return { name: "album" };
  return { name: "explore" };
}

export default function BisonQuestApp() {
  const [mode, setMode] = useState<PlayMode | null>(null);
  const [store, setStore] = useState<HuntStoreLike | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [pending, setPending] = useState<Blob | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "loading" });
  const [menu, setMenu] = useState<{ open: boolean; page: MenuPage }>({ open: false, page: "main" });
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [demoGps, setDemoGps] = useState<DemoGps>({ position: DEMO_START, accuracy: 8, ageMs: 0 });
  const [demoOutcome, setDemoOutcome] = useState<DemoOutcome>("pass");
  // 0 until mounted; set in the boot effect so prerendering stays deterministic.
  const [now, setNow] = useState(0);

  const install = useInstall();
  const demo = mode === "demo";
  const gem = progress ? currentGem(progress, HUNT) : null;

  // ---- boot ---------------------------------------------------------------
  useEffect(() => {
    queueMicrotask(() => {
      setNow(Date.now());
      setMode(readMode());
    });
    registerServiceWorker();
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    const t = setInterval(() => setNow(Date.now()), 3000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      clearInterval(t);
    };
  }, []);

  // ---- load the store for the current mode ---------------------------------
  useEffect(() => {
    if (!mode) return;
    let cancelled = false;
    (async () => {
      let s: HuntStoreLike = new HuntStore(HUNT, mode);
      let p: Progress;
      let list: StoredPhoto[] = [];
      try {
        p = await s.loadProgress();
        list = await s.listPhotos();
      } catch {
        s = new MemoryHuntStore(HUNT, mode);
        p = await s.loadProgress();
        if (!cancelled) setToast("This browser blocked saving. You can play, but progress won't survive closing the tab.");
      }
      if (mode === "demo" && !p.onboarded) {
        p = { ...p, onboarded: true };
        await s.saveProgress(p).catch(() => {});
      }
      const g = currentGem(p, HUNT);
      const pend = g ? await s.getPending(g.id).catch(() => undefined) : undefined;
      if (cancelled) return;
      setStore(s);
      setProgress(p);
      setPhotos(list);
      setPending(pend ? new Blob([pend.data], { type: pend.type }) : null);
      setScreen(screenFor(p));
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // ---- location -------------------------------------------------------------
  const watching = !demo && (screen.name === "explore" || screen.name === "camera");
  const live = useForegroundPosition(watching);
  const fix = useMemo(() => (demo ? demoFix(demoGps, now) : live.fix), [demo, demoGps, now, live.fix]);
  const locationCheck = useMemo(() => (gem ? evaluateFix(fix, gem, HUNT.gps, now, HUNT.placementRule) : null), [fix, gem, now]);
  const farFromCampus = !!fix && haversineMeters(fix, HUNT.mapCenter) > 2000;

  // ---- photos → object URLs ----------------------------------------------
  const photoUrls = useMemo(() => new Map(photos.map((p) => [p.gemId, URL.createObjectURL(new Blob([p.data], { type: p.type }))])), [photos]);
  useEffect(() => () => photoUrls.forEach((u) => URL.revokeObjectURL(u)), [photoUrls]);

  const albumItems: AlbumItem[] = useMemo(() => {
    if (!progress) return [];
    return progress.collected.flatMap((c) => {
      const g = HUNT.gems.find((x) => x.id === c.gemId);
      const ph = photos.find((p) => p.id === c.photoId);
      const url = photoUrls.get(c.gemId);
      if (!g || !ph || !url) return [];
      return [
        {
          gemId: g.id,
          gemName: g.gemName,
          destinationName: g.destinationName,
          caption: g.discovery.albumCaption,
          collectedAt: c.collectedAt,
          color: g.color,
          photo: new Blob([ph.data], { type: ph.type }),
          url,
          simulated: c.verification === "simulated",
        },
      ];
    });
  }, [progress, photos, photoUrls]);

  const mapGems: MapGem[] = useMemo(() => {
    if (!progress) return [];
    const out: MapGem[] = progress.collected.flatMap((c) => {
      const g = HUNT.gems.find((x) => x.id === c.gemId);
      return g ? [{ id: g.id, label: g.destinationName, color: g.color, state: "collected" as const, exact: g.checkpoint, zone: null }] : [];
    });
    if (gem) {
      const level = progress.hintLevels[gem.id] ?? 0;
      const zone = searchZoneFor(gem, level);
      const revealed = level >= 2 || locationCheck?.status === "in_range";
      out.push({
        id: gem.id,
        label: level >= 2 ? gem.destinationName : gem.gemName,
        color: gem.color,
        state: "active",
        exact: revealed ? gem.checkpoint : null,
        zone,
      });
    }
    return out;
  }, [progress, gem, locationCheck?.status]);

  // ---- actions ---------------------------------------------------------------
  const save = useCallback(
    async (p: Progress) => {
      setProgress(p);
      try {
        await store?.saveProgress(p);
      } catch {
        setToast("Couldn't save progress on this phone.");
      }
    },
    [store],
  );

  const runSubmission = useCallback(
    (photo: Blob) => {
      if (!store || !gem) return Promise.resolve({ kind: "not_current" } as const);
      return submitCheckpoint(
        {
          hunt: HUNT,
          store,
          getFreshFix: demo ? async () => demoFix(demoGps, Date.now()) : () => getFreshFix(),
          verifyPhoto: demo ? ({ gem: g, fix: f }) => simulatedVerify(HUNT, g, f, demoOutcome) : verifyRemote,
          isOnline: () => navigator.onLine,
          precheckPhoto: async (p) =>
            (await photoLooksBlank(p))
              ? {
                  verdict: "retry",
                  reason: "This photo looks blank or almost a single colour.",
                  feedback: "Make sure nothing covers the lens, then photograph the checkpoint again.",
                  source: "precheck",
                }
              : null,
        },
        gem.id,
        photo,
      );
    },
    [store, gem, demo, demoGps, demoOutcome],
  );

  const onAwarded = useCallback(
    async (p: Progress) => {
      setProgress(p);
      setPending(null);
      if (store) setPhotos(await store.listPhotos().catch(() => photos));
      setScreen({ name: "celebrate", gemId: p.unseenDiscovery ?? p.collected.at(-1)!.gemId, fresh: true });
    },
    [store, photos],
  );

  const doRestart = async () => {
    setConfirm(null);
    setMenu({ open: false, page: "main" });
    if (!store) return;
    try {
      await store.deleteAll();
    } catch {
      setToast("Couldn't clear saved data. Please try again.");
      return;
    }
    const fresh = { ...initialProgress(HUNT, store.mode), onboarded: true };
    await save(fresh);
    setPhotos([]);
    setPending(null);
    setScreen({ name: "explore" });
    setToast("New hunt started. Good luck!");
  };

  const doDeleteAll = async () => {
    setConfirm(null);
    store?.close();
    try {
      await deleteAllHuntData();
      localStorage.removeItem(MODE_KEY);
    } catch {
      /* ignore and reload anyway */
    }
    window.location.reload();
  };

  const switchMode = (m: PlayMode) => {
    setConfirm(null);
    setMenu({ open: false, page: "main" });
    store?.close();
    writeMode(m);
    setScreen({ name: "loading" });
    setProgress(null);
    setStore(null);
    setMode(m);
    setToast(m === "demo" ? "Demo Mode on: nothing is really verified." : "Back to live play.");
  };

  const onMapTap = useCallback((p: LatLng) => setDemoGps((g) => ({ ...g, position: p, ageMs: 0 })), []);

  // ---- render ------------------------------------------------------------------
  const overlays = (
    <>
      <MenuSheet
        open={menu.open}
        page={menu.page}
        setPage={(page) => setMenu({ open: true, page })}
        onClose={() => setMenu({ open: false, page: "main" })}
        demo={demo}
        albumCount={progress?.collected.length ?? 0}
        persistent={store?.persistent ?? true}
        onOpenAlbum={() => {
          setMenu({ open: false, page: "main" });
          setScreen({ name: "album" });
        }}
        onToggleDemo={() => switchMode(demo ? "live" : "demo")}
        onRestart={() => setConfirm("restart")}
        onDeleteAll={() => setConfirm("delete")}
        install={install}
      />
      <ConfirmDialog
        open={confirm === "restart"}
        title="Restart the hunt?"
        body={<>This erases your {demo ? "Demo Mode " : ""}progress and album photos on this phone. Save your album first if you want to keep it.</>}
        confirmLabel="Yes, restart"
        danger
        onConfirm={doRestart}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title="Delete all hunt data?"
        body="This permanently deletes live and Demo Mode progress, saved photos and your album from this browser. It can't be undone."
        confirmLabel="Delete everything"
        danger
        onConfirm={doDeleteAll}
        onCancel={() => setConfirm(null)}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );

  if (screen.name === "loading" || !progress || !store) {
    return (
      <main className="screen flex flex-col items-center justify-center gap-3 bg-navy-900 text-white" aria-busy="true">
        <div className="gem-float"><BisonMascot size={96} /></div>
        <p className="font-display text-lg">Loading your quest…</p>
        {overlays}
      </main>
    );
  }

  const openMenu = (page: MenuPage = "main") => setMenu({ open: true, page });

  let view: React.ReactNode = null;
  switch (screen.name) {
    case "welcome":
      view = (
        <Welcome
          onStart={() => setScreen({ name: "permissions" })}
          onPrivacy={() => openMenu("privacy")}
          onInstall={install.installed ? undefined : () => openMenu("install")}
        />
      );
      break;
    case "permissions":
      view = (
        <Permissions
          onPrivacy={() => openMenu("privacy")}
          onDone={async () => {
            await save({ ...progress, onboarded: true });
            setScreen({ name: "explore" });
          }}
        />
      );
      break;
    case "explore":
      view = (
        <ExploreScreen
          progress={progress}
          gem={gem}
          fix={fix}
          geoError={demo ? null : live.error}
          locationCheck={locationCheck}
          online={online}
          demo={demo}
          mapGems={mapGems}
          hasPending={!!pending}
          farFromCampus={farFromCampus}
          persistent={store.persistent}
          demoControls={<DemoPanel gem={gem} outcome={demoOutcome} setOutcome={setDemoOutcome} setGps={setDemoGps} />}
          onMapTap={demo ? onMapTap : undefined}
          onCamera={() => setScreen({ name: "camera", useSaved: true })}
          onHint={(level) => gem && save(revealHint(progress, gem.id, level))}
          onMenu={() => openMenu()}
          onAlbum={() => setScreen({ name: "album" })}
          onExitDemo={() => switchMode("live")}
        />
      );
      break;
    case "camera":
      view = gem ? (
        <CameraScreen
          gem={gem}
          locationCheck={locationCheck}
          initialPhoto={screen.useSaved ? pending : null}
          demo={demo}
          onCaptured={(b) => {
            setPending(b);
            b.arrayBuffer()
              .then((data) => store.savePending({ gemId: gem.id, type: b.type || "image/jpeg", data, capturedAt: Date.now() }))
              .catch(() => setToast("Couldn't save the photo on this phone. Keep this screen open."));
          }}
          onSubmit={(photo) => setScreen({ name: "verify", photo, attempt: Date.now() })}
          onClose={() => setScreen({ name: "explore" })}
        />
      ) : null;
      break;
    case "verify":
      view = gem ? (
        <VerifyScreen
          key={screen.attempt}
          gem={gem}
          photo={screen.photo}
          demo={demo}
          online={online}
          run={() => runSubmission(screen.photo)}
          onAwarded={onAwarded}
          onRetake={() => setScreen({ name: "camera", useSaved: false })}
          onBackToMap={() => setScreen({ name: "explore" })}
          onShowDemoInfo={() => openMenu("demo")}
        />
      ) : null;
      break;
    case "celebrate": {
      const idx = HUNT.gems.findIndex((g) => g.id === screen.gemId);
      const g = HUNT.gems[idx];
      const record = progress.collected.find((c) => c.gemId === screen.gemId);
      view = g ? (
        <Celebrate
          gem={g}
          index={idx}
          total={HUNT.gems.length}
          photoUrl={photoUrls.get(g.id) ?? null}
          fresh={screen.fresh}
          isLast={idx === HUNT.gems.length - 1}
          simulated={record?.verification === "simulated"}
          onContinue={async () => {
            const next = { ...progress, unseenDiscovery: null };
            await save(next);
            setScreen(isComplete(next, HUNT) ? { name: "album" } : { name: "explore" });
          }}
        />
      ) : null;
      break;
    }
    case "album":
      view = (
        <AlbumScreen
          items={albumItems}
          complete={isComplete(progress, HUNT)}
          demo={demo}
          onBack={() => setScreen({ name: "explore" })}
          onRestart={() => setConfirm("restart")}
          notify={setToast}
        />
      );
      break;
  }

  return (
    <>
      {view}
      {demo && screen.name !== "explore" ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1500] h-2 demo-stripes" aria-hidden />
      ) : null}
      {overlays}
    </>
  );
}
