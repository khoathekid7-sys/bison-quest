"use client";

import { useEffect, useState } from "react";
import { asset, BASE_PATH } from "@/lib/site";

/** Registers the offline service worker (production builds only). */
export function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register(asset("sw.js"), { scope: `${BASE_PATH}/` }).catch(() => {
    /* the app still works online without it */
  });
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState = {
  /** Running from the home screen already. */
  installed: boolean;
  /** iPhone/iPad: installing is a manual Share → Add to Home Screen step. */
  ios: boolean;
  /** The browser offered a one-tap install (Android Chrome, desktop Chrome/Edge). */
  canPrompt: boolean;
  prompt: () => Promise<boolean>;
};

export function useInstall(): InstallState {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    queueMicrotask(() => {
      setInstalled(standalone);
      setIos(isIos);
    });
    const onPrompt = (e: Event) => {
      e.preventDefault(); // show our own button instead of the browser's mini-bar
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return {
    installed,
    ios,
    canPrompt: !!evt,
    prompt: async () => {
      if (!evt) return false;
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      setEvt(null);
      return outcome === "accepted";
    },
  };
}
