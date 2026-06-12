"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

import { savePushSubscriptionAction, deletePushSubscriptionAction } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import { de } from "@/messages/de";

/** VAPID keys are base64url; the Push API wants the raw bytes. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Allocate over an explicit ArrayBuffer so the type is Uint8Array<ArrayBuffer>
  // (what the Push API's applicationServerKey: BufferSource expects).
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

type State = "loading" | "unsupported" | "blocked" | "on" | "off";

/**
 * Profile-page control to enable/disable Web Push for this device. Renders
 * nothing when push is not configured for the deployment (no public VAPID key).
 * On iOS, push only works once the PWA is on the home screen (iOS 16.4+); we
 * show a hint rather than hide the control so installed users can find it.
 */
export function NotificationToggle() {
  const vapidKey = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // Initial state is resolved asynchronously: capability/permission checks plus
  // the current subscription. Kept off the synchronous render path so server and
  // first client render agree on "loading" (no hydration mismatch).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (
        !vapidKey ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("blocked");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setState(sub ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  // Push not configured on this deployment — nothing to offer.
  if (!vapidKey) return null;

  async function enable() {
    setBusy(true);
    setError(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey!),
      });
      const json = sub.toJSON();
      const res = await savePushSubscriptionAction({
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        userAgent: navigator.userAgent,
      });
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {});
        setError(true);
        setState("off");
        return;
      }
      setState("on");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(false);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setState("off");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">{de.pwa.notifyDescription}</p>

      {state === "unsupported" && (
        <p className="text-muted-foreground text-sm">{de.pwa.notifyUnsupported}</p>
      )}
      {state === "blocked" && (
        <p className="text-muted-foreground text-sm">{de.pwa.notifyBlocked}</p>
      )}
      {state === "on" && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{de.pwa.notifyEnabled}</p>
          <Button variant="outline" onClick={disable} disabled={busy}>
            <BellOff className="size-4" />
            {de.pwa.notifyDisable}
          </Button>
        </div>
      )}
      {state === "off" && (
        <Button onClick={enable} disabled={busy}>
          <Bell className="size-4" />
          {de.pwa.notifyEnable}
        </Button>
      )}

      {error && <p className="text-destructive text-sm">{de.pwa.notifyError}</p>}
      {isIosClient() && <p className="text-muted-foreground text-xs">{de.pwa.notifyIosHint}</p>}
    </div>
  );
}

/** Guarded so it is only read in the browser (component is client-only anyway). */
function isIosClient(): boolean {
  return typeof navigator !== "undefined" && isIos();
}
