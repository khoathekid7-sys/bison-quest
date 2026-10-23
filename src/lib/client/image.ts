"use client";

const MAX_EDGE = 1600;
const QUALITY = 0.85;

export class ImagePrepError extends Error {}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ImagePrepError("encode failed"))), "image/jpeg", QUALITY),
  );
}

function fit(w: number, h: number) {
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; w: number; h: number; close?: () => void }> {
  // createImageBitmap with imageOrientation applies EXIF rotation (Safari 16.4+, Chrome).
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to <img>, which also honours EXIF in modern browsers */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    throw new ImagePrepError(
      "This photo format can't be opened in your browser (often HEIC). Use the in-app camera, or choose a JPEG/PNG.",
    );
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Upright, resized JPEG suitable for upload and local storage. */
export async function prepareUpload(file: Blob): Promise<Blob> {
  if (file.type && !file.type.startsWith("image/")) throw new ImagePrepError("That file isn't an image.");
  const { source, w, h, close } = await decode(file);
  try {
    const size = fit(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImagePrepError("Couldn't process the photo.");
    ctx.drawImage(source, 0, 0, size.w, size.h);
    return await canvasToJpeg(canvas);
  } finally {
    close?.();
  }
}

/** Grab the current frame of a <video> camera preview. */
export async function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new ImagePrepError("The camera isn't ready yet.");
  const size = fit(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImagePrepError("Couldn't capture the photo.");
  ctx.drawImage(video, 0, 0, size.w, size.h);
  return canvasToJpeg(canvas);
}

/** Demo Mode only: a clearly labelled synthetic image so the flow works without a camera. */
export async function makeDemoSample(label: string, color: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 900;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 1200, 900);
  g.addColorStop(0, "#0b2545");
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1200, 900);
  ctx.fillStyle = "#ffd23f";
  ctx.fillRect(0, 0, 1200, 110);
  ctx.fillStyle = "#1b1b1b";
  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DEMO SAMPLE — NOT A REAL PHOTO", 600, 80);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 72px system-ui, sans-serif";
  ctx.fillText(label, 600, 500);
  return canvasToJpeg(canvas);
}

/**
 * True when the photo is almost a single colour (lens covered, black frame).
 * Checked on the phone before upload, so nothing is sent for an obviously blank shot.
 */
export async function photoLooksBlank(photo: Blob): Promise<boolean> {
  try {
    const bmp = await createImageBitmap(photo, { resizeWidth: 64, resizeHeight: 64 });
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const { data } = ctx.getImageData(0, 0, 64, 64);
    let maxStdev = 0;
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      let sq = 0;
      for (let i = c; i < data.length; i += 4) {
        sum += data[i];
        sq += data[i] * data[i];
      }
      const n = data.length / 4;
      maxStdev = Math.max(maxStdev, Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2)));
    }
    return maxStdev < 8;
  } catch {
    return false; // can't tell: let the photo checker decide
  }
}
