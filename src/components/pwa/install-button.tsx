"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Download, Share } from "lucide-react";

import { Button } from "@/components/ui/button";
import { de } from "@/messages/de";

// Fired by Chromium browsers when the PWA install criteria are met. Not in the
// DOM lib typings, so we model the bits we use.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes this non-standard flag instead of display-mode.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// useSyncExternalStore subscriptions: re-read the browser environment when it
// changes, with a stable `false` server snapshot (avoids hydration mismatch).
function subscribeDisplayMode(onChange: () => void) {
  const mql = window.matchMedia("(display-mode: standalone)");
  mql.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}
const noopSubscribe = () => () => {};
const serverFalse = () => false;

/**
 * Offers PWA installation from the profile page. Chromium fires
 * `beforeinstallprompt`, which we capture and replay on click. iOS/iPadOS has no
 * such event, so we show Safari's manual "Add to Home Screen" steps instead.
 * Renders an "already installed" note when running standalone.
 */
export function InstallButton() {
  const standalone = useSyncExternalStore(subscribeDisplayMode, isStandalone, serverFalse);
  const ios = useSyncExternalStore(noopSubscribe, isIos, serverFalse);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // The event can only be used once.
    setDeferred(null);
  }

  if (standalone) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <CheckCircle2 className="text-primary" />
        {de.pwa.installed}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{de.pwa.description}</p>

      {ios ? (
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Share className="size-4" />
            {de.pwa.iosTitle}
          </p>
          <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
            {de.pwa.iosSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : (
        // When no prompt has fired yet (unsupported browser or criteria not met)
        // the button is disabled — the user can still use the browser's own menu.
        <Button onClick={install} disabled={!deferred} data-icon="inline-start">
          <Download />
          {de.pwa.installButton}
        </Button>
      )}
    </div>
  );
}
