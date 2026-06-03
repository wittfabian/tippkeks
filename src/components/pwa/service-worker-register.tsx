"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js so the app is installable and the offline fallback works.
 * Production + secure-context only (the SW is a no-op in dev, where the file
 * isn't served the same way and HMR would fight it). Renders nothing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration is best-effort: the app works fine without it.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
