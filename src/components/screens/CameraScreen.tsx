"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GemConfig } from "@/config/hunt";
import { formatApproxDistance, type LocationCheck } from "@/lib/geo";
import { captureFrame, ImagePrepError, makeDemoSample, prepareUpload } from "@/lib/client/image";
import { Icon } from "../art";

type Phase = "starting" | "live" | "fallback" | "review" | "processing";

function RangeChip({ check }: { check: LocationCheck | null }) {
  if (!check || check.status === "unavailable") {
    return <span className="rounded-full bg-warn-bg px-3 py-1 text-sm font-bold text-warn">Location: not available</span>;
  }
  if (check.status === "in_range") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-ok-bg px-3 py-1 text-sm font-bold text-ok">
        <Icon.Check size={16} /> In range: ready to submit
      </span>
    );
  }
  if (check.status === "out_of_range" && check.distanceMeters != null) {
    return (
      <span className="rounded-full bg-warn-bg px-3 py-1 text-sm font-bold text-warn">
        Not in range yet: {formatApproxDistance(check.distanceMeters)}
      </span>
    );
  }
  return <span className="rounded-full bg-warn-bg px-3 py-1 text-sm font-bold text-warn">GPS is weak: we&apos;ll recheck when you submit</span>;
}

export function CameraScreen({
  gem,
  locationCheck,
  initialPhoto,
  demo,
  onCaptured,
  onSubmit,
  onClose,
}: {
  gem: GemConfig;
  locationCheck: LocationCheck | null;
  initialPhoto: Blob | null;
  demo: boolean;
  onCaptured: (photo: Blob) => void;
  onSubmit: (photo: Blob) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileCapture = useRef<HTMLInputElement>(null);
  const fileLibrary = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>(initialPhoto ? "review" : "starting");
  const [photo, setPhoto] = useState<Blob | null>(initialPhoto);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<"denied" | "unavailable" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromSaved, setFromSaved] = useState(Boolean(initialPhoto));

  /** Bumped whenever a pending camera start becomes obsolete (photo chosen, retake, close). */
  const generation = useRef(0);

  const stopStream = useCallback(() => {
    generation.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  const startStream = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("unavailable");
      setPhase("fallback");
      return;
    }
    setPhase("starting");
    const myGeneration = ++generation.current;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      if (myGeneration !== generation.current) {
        // The player already picked a photo or left: release the camera at once.
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => {});
      }
      setCameraError(null);
      setPhase("live");
    } catch (e) {
      if (myGeneration !== generation.current) return;
      const name = e instanceof DOMException ? e.name : "";
      setCameraError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      setPhase("fallback");
    }
  }, []);

  useEffect(() => {
    if (!initialPhoto) queueMicrotask(() => void startStream());
    return stopStream; // always release the camera when this screen closes
  }, [initialPhoto, startStream, stopStream]);

  useEffect(() => {
    if (!photo) {
      queueMicrotask(() => setPhotoUrl(null));
      return;
    }
    const url = URL.createObjectURL(photo);
    queueMicrotask(() => setPhotoUrl(url));
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const accept = (blob: Blob) => {
    stopStream();
    setPhoto(blob);
    setFromSaved(false);
    setPhase("review");
    onCaptured(blob);
  };

  const shoot = async () => {
    if (!video.current) return;
    try {
      setPhase("processing");
      accept(await captureFrame(video.current));
    } catch (e) {
      setError(e instanceof ImagePrepError ? e.message : "Couldn't take the photo. Try again.");
      setPhase("live");
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhase("processing");
      accept(await prepareUpload(file));
    } catch (e) {
      setError(e instanceof ImagePrepError ? e.message : "That photo couldn't be opened. Please try another.");
      setPhase(stream.current ? "live" : "fallback");
    }
  };

  const useSample = async () => accept(await makeDemoSample(gem.destinationName, gem.color));

  const retake = () => {
    setPhoto(null);
    setFromSaved(false);
    void startStream();
  };

  return (
    <main className="screen bg-black text-white" aria-label="Camera">
      <video
        ref={video}
        className={`absolute inset-0 h-full w-full object-cover ${phase === "live" || phase === "processing" ? "" : "invisible"}`}
        playsInline
        muted
        autoPlay
        aria-label="Camera preview"
      />
      {phase === "review" && photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="Your photo, ready to check" className="absolute inset-0 h-full w-full object-contain" />
      ) : null}

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-3 pb-8 pt-safe">
        <div className="flex items-start gap-3">
          <button className="btn btn-cream !min-h-12 !min-w-12 !p-0" onClick={onClose} aria-label="Close camera and go back to the map">
            <Icon.Close />
          </button>
          <div className="min-w-0 flex-1 rounded-2xl bg-navy-950/80 p-3">
            <p className="font-display text-sm font-semibold uppercase tracking-wider text-orange-300">What to capture</p>
            <p className="text-[15px] font-semibold leading-snug">{gem.photo.instruction}</p>
          </div>
        </div>
        <div className="mt-2 flex justify-center">
          <RangeChip check={locationCheck} />
        </div>
      </div>

      {/* Fallback (no in-app camera) */}
      {phase === "fallback" ? (
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2">
          <div className="card mx-auto max-w-sm p-5 text-ink">
            <h2 className="font-display text-2xl font-semibold text-navy-900">
              {cameraError === "denied" ? "Camera access is off" : "Use your camera app"}
            </h2>
            <p className="mt-2 text-[15px] text-ink-muted">
              {cameraError === "denied"
                ? "No problem, you can use your phone's camera app instead. To use the in-app camera, allow Camera for this site in your browser settings and tap Try again."
                : "Your browser can't show the in-app camera here, but your phone's camera app works just as well."}
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <button className="btn btn-primary" onClick={() => fileCapture.current?.click()}>
                <Icon.Camera /> Open phone camera
              </button>
              <button className="btn btn-cream" onClick={() => fileLibrary.current?.click()}>
                <Icon.Upload /> Choose a photo
              </button>
              {cameraError === "denied" ? (
                <button className="btn btn-ghost !min-h-11" onClick={() => void startStream()}>Try the in-app camera again</button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {phase === "starting" ? (
        <p className="absolute inset-x-0 top-1/2 text-center font-semibold" aria-live="polite">Starting camera…</p>
      ) : null}

      {error ? (
        <p role="alert" className="absolute inset-x-4 top-[38%] rounded-2xl bg-bad-bg p-3 text-center font-semibold text-bad">{error}</p>
      ) : null}

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pt-10 pb-safe">
        {phase === "review" ? (
          <div className="mx-auto flex max-w-md flex-col gap-3">
            {fromSaved ? <p className="text-center text-sm font-semibold text-orange-300">Your saved photo from earlier</p> : null}
            <button className="btn btn-primary !min-h-14 text-xl" onClick={() => photo && onSubmit(photo)} disabled={!photo}>
              <Icon.Check /> Use this photo
            </button>
            <button className="btn btn-cream" onClick={retake}>
              <Icon.Refresh /> Retake
            </button>
          </div>
        ) : phase === "live" || phase === "processing" ? (
          <div className="mx-auto flex max-w-md items-center justify-between">
            <button className="btn btn-cream !min-h-12 !min-w-12 !p-0" onClick={() => fileLibrary.current?.click()} aria-label="Choose a photo from your library">
              <Icon.Upload />
            </button>
            <button
              onClick={shoot}
              disabled={phase === "processing"}
              aria-label="Take photo"
              className="focus-ring relative flex h-20 w-20 items-center justify-center rounded-full border-[5px] border-white bg-orange-500 shadow-[0_0_0_6px_rgba(242,140,40,0.35)] transition active:scale-95"
            >
              <Icon.Camera size={34} className="text-navy-950" />
            </button>
            <span className="w-12" />
          </div>
        ) : null}
        {demo && phase !== "review" ? (
          <div className="mx-auto mt-3 max-w-md">
            <button className="btn w-full demo-stripes" onClick={useSample}>
              <span className="rounded-full bg-black/85 px-3 py-1 text-white">Demo: use a labelled sample image</span>
            </button>
          </div>
        ) : null}
      </div>

      <input ref={fileCapture} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} data-testid="file-capture" />
      <input ref={fileLibrary} type="file" accept="image/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} data-testid="file-library" />
    </main>
  );
}
