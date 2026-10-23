"use client";

export type AlbumEntry = {
  gemName: string;
  destinationName: string;
  caption: string;
  collectedAt: number;
  color: string;
  photo: Blob;
};

export const formatCollectedAt = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** One shareable JPEG poster containing every accepted photo. */
export async function composeAlbumImage(entries: AlbumEntry[], opts: { title: string; demo: boolean }): Promise<Blob> {
  const W = 1080;
  const PAD = 60;
  const PHOTO_H = 640;
  const ENTRY_H = PHOTO_H + 230;
  const HEADER = 250;
  const H = HEADER + entries.length * ENTRY_H + 120;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#fffaf1";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#0b2545";
  ctx.fillRect(0, 0, W, HEADER - 40);
  ctx.fillStyle = "#f28c28";
  ctx.fillRect(0, HEADER - 48, W, 8);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 76px system-ui, sans-serif";
  ctx.fillText(opts.title, PAD, 120);
  ctx.font = "500 34px system-ui, sans-serif";
  ctx.fillStyle = "#ffbd73";
  ctx.fillText(opts.demo ? "DEMO MODE — simulated checks" : "My Bucknell photo album", PAD, 172);

  let y = HEADER;
  for (const e of entries) {
    const bmp = await createImageBitmap(e.photo);
    const boxW = W - PAD * 2;
    ctx.save();
    roundRect(ctx, PAD, y, boxW, PHOTO_H, 28);
    ctx.clip();
    const scale = Math.max(boxW / bmp.width, PHOTO_H / bmp.height);
    const dw = bmp.width * scale;
    const dh = bmp.height * scale;
    ctx.drawImage(bmp, PAD + (boxW - dw) / 2, y + (PHOTO_H - dh) / 2, dw, dh);
    ctx.restore();
    bmp.close();

    ctx.fillStyle = e.color;
    roundRect(ctx, PAD, y + PHOTO_H + 26, 18, 56, 9);
    ctx.fill();
    ctx.fillStyle = "#10233f";
    ctx.font = "700 44px system-ui, sans-serif";
    ctx.fillText(e.destinationName, PAD + 36, y + PHOTO_H + 70);
    ctx.fillStyle = "#4a5a75";
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.fillText(`${e.gemName} · ${formatCollectedAt(e.collectedAt)}`, PAD + 36, y + PHOTO_H + 112);
    ctx.fillStyle = "#10233f";
    ctx.font = "400 30px system-ui, sans-serif";
    wrap(ctx, e.caption, boxW - 36)
      .slice(0, 2)
      .forEach((l, i) => ctx.fillText(l, PAD + 36, y + PHOTO_H + 156 + i * 38));
    y += ENTRY_H;
  }
  ctx.fillStyle = "#4a5a75";
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText("Bison Quest · Find the campus hiding in plain sight.", PAD, H - 50);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Album export failed"))), "image/jpeg", 0.9),
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Native share sheet with files where supported; otherwise falls back to download. */
export async function shareOrDownload(blob: Blob, filename: string, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Bison Quest", text });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}
