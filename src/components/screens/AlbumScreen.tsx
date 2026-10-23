"use client";

import { useState } from "react";
import { HUNT } from "@/config/hunt";
import { composeAlbumImage, downloadBlob, formatCollectedAt, shareOrDownload, type AlbumEntry } from "@/lib/client/album-export";
import { BisonMascot, GemSvg, Icon } from "../art";

export type AlbumItem = AlbumEntry & { gemId: string; url: string; simulated: boolean };

export function AlbumScreen({
  items,
  complete,
  demo,
  onBack,
  onRestart,
  notify,
}: {
  items: AlbumItem[];
  complete: boolean;
  demo: boolean;
  onBack: () => void;
  onRestart: () => void;
  notify: (msg: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const canShareFiles = typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  const remaining = HUNT.gems.length - items.length;

  const fileName = (s: string) => `bison-quest-${s.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.jpg`;

  const exportAlbum = async (mode: "share" | "download") => {
    setBusy(mode);
    try {
      const blob = await composeAlbumImage(items, { title: HUNT.title, demo });
      if (mode === "download") {
        downloadBlob(blob, "bison-quest-album.jpg");
        notify("Album image saved to your downloads.");
      } else {
        const r = await shareOrDownload(blob, "bison-quest-album.jpg", "My Bison Quest album: I found the campus hiding in plain sight!");
        if (r === "downloaded") notify("Sharing isn't available here, so we downloaded the album instead.");
      }
    } catch {
      notify("Couldn't create the album image. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="screen-scroll bg-cream-100">
      <header className="bg-navy-900 px-4 pb-6 pt-safe text-white">
        <div className="mx-auto max-w-md">
          <button className="btn btn-cream !min-h-11 mt-1" onClick={onBack}>
            ← {complete ? "Map" : "Back to the hunt"}
          </button>
          <div className="mt-4 flex items-center gap-3">
            <BisonMascot size={72} />
            <div>
              <p className="font-display text-sm font-semibold uppercase tracking-widest text-orange-300">
                {complete ? "Quest complete" : `${items.length} of ${HUNT.gems.length} gems`}
              </p>
              <h1 className="font-display text-3xl font-bold leading-tight">{complete ? "You found them all!" : "Your album so far"}</h1>
            </div>
          </div>
          {complete ? (
            <p className="mt-3 text-navy-200">
              You walk past these places all the time. Now you know what they&apos;re hiding. Here&apos;s your proof.
            </p>
          ) : null}
          {demo ? (
            <p className="mt-3 inline-block rounded-full demo-stripes p-1 text-sm font-bold">
              <span className="block rounded-full bg-black/85 px-3 py-0.5 text-white">Demo Mode album: simulated checks</span>
            </p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-5">
        {items.length === 0 ? (
          <p className="card p-5 text-center text-ink-muted">No gems yet. Your accepted photos will appear here.</p>
        ) : null}
        {items.map((it) => (
          <article key={it.gemId} className="card overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.url} alt={`Your photo of ${it.destinationName}`} className="aspect-[4/3] w-full object-cover" />
            <div className="p-4">
              <div className="flex items-center gap-2">
                <GemSvg color={it.color} state="collected" size={34} />
                <div>
                  <h2 className="font-display text-xl font-semibold text-navy-900">{it.destinationName}</h2>
                  <p className="text-sm font-semibold text-ink-muted">
                    {it.gemName} · collected {formatCollectedAt(it.collectedAt)}
                    {it.simulated ? " · simulated" : ""}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[15px] text-ink">{it.caption}</p>
              <div className="mt-3 flex gap-2">
                <button className="btn btn-cream flex-1 !min-h-11 text-base" onClick={() => downloadBlob(it.photo, fileName(it.destinationName))}>
                  <Icon.Download size={20} /> Save
                </button>
                {canShareFiles ? (
                  <button
                    className="btn btn-cream flex-1 !min-h-11 text-base"
                    onClick={async () => {
                      const r = await shareOrDownload(it.photo, fileName(it.destinationName), `I found ${it.destinationName} on Bison Quest!`);
                      if (r === "downloaded") notify("Sharing isn't available, so we downloaded the photo instead.");
                    }}
                  >
                    <Icon.Share size={20} /> Share
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}

        {remaining > 0
          ? Array.from({ length: remaining }, (_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-[1.5rem] border-2 border-dashed border-cream-300 p-4 text-ink-muted">
                <GemSvg color="#999" state="locked" size={34} />
                <span className="font-semibold">Gem {items.length + i + 1}: still hidden</span>
              </div>
            ))
          : null}

        {items.length > 0 ? (
          <section className="card space-y-3 p-4" aria-label="Export album">
            <h2 className="font-display text-xl font-semibold text-navy-900">Keep your album</h2>
            <p className="text-sm text-ink-muted">Your album only lives on this phone. Save or share a copy to keep it.</p>
            <button className="btn btn-primary w-full" disabled={!!busy} onClick={() => exportAlbum("share")}>
              <Icon.Share /> {busy === "share" ? "Preparing…" : canShareFiles ? "Share album" : "Save album image"}
            </button>
            {canShareFiles ? (
              <button className="btn btn-cream w-full" disabled={!!busy} onClick={() => exportAlbum("download")}>
                <Icon.Download /> {busy === "download" ? "Preparing…" : "Download album image"}
              </button>
            ) : null}
            <p className="text-xs text-ink-muted">On iPhone, a downloaded image opens in a preview: tap Share, then Save Image.</p>
          </section>
        ) : null}

        {complete ? (
          <button className="btn btn-ghost w-full text-bad" onClick={onRestart}>
            Start the hunt over
          </button>
        ) : null}
      </div>
    </main>
  );
}
