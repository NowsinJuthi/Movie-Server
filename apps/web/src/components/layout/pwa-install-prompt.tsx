"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "pwa-install-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const coarseMobile = window.matchMedia("(max-width: 768px), (hover: none) and (pointer: coarse)").matches;
    if (!coarseMobile) return;

    if (isIosSafari()) {
      const timer = window.setTimeout(() => {
        setIosHint(true);
        setVisible(true);
      }, 4000);
      return () => window.clearTimeout(timer);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-3 z-50 rounded-xl border border-primary/25 bg-card/95 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur-md lg:hidden",
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]",
      )}
    >
      <button
        type="button"
        aria-label="Dismiss install prompt"
        className="absolute right-2 top-2 inline-flex h-9 w-9 touch-manipulation items-center justify-center rounded-full text-white/60 active:bg-white/10"
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </button>

      {iosHint ? (
        <div className="pr-8">
          <p className="text-sm font-semibold text-white">Install AmarPin</p>
          <p className="mt-1 text-xs leading-relaxed text-white/65">
            Tap <Share className="mx-0.5 inline h-3.5 w-3.5 align-text-bottom" /> Share, then{" "}
            <strong className="text-white/85">Add to Home Screen</strong> for an app-like experience.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 pr-8">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Download className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Install AmarPin</p>
            <p className="text-xs text-white/65">Add to your home screen for faster access.</p>
          </div>
          <button
            type="button"
            className="shrink-0 touch-manipulation rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground active:opacity-90"
            onClick={() => void install()}
          >
            Install
          </button>
        </div>
      )}
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
