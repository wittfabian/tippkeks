"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { de } from "@/messages/de";

export interface ExactHit {
  id: string;
  label: string;
  points: number;
}

/**
 * The single "loud moment": when a finished match was tipped exactly, celebrate
 * once with a toast. Seen hits are remembered in localStorage so it never
 * replays on revisit. Toasts are inherently motion-safe (no blocking animation).
 */
export function CelebrateExactHits({ hits }: { hits: ExactHit[] }) {
  useEffect(() => {
    if (hits.length === 0) return;
    const key = "tippspiel:celebrated-exact";
    let seen: string[] = [];
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
      if (Array.isArray(parsed)) seen = parsed.filter((id): id is string => typeof id === "string");
    } catch {
      seen = [];
    }
    const fresh = hits.filter((h) => !seen.includes(h.id));
    if (fresh.length === 0) return;

    for (const hit of fresh) {
      toast.success(de.predictions.exactHitToast(hit.points), {
        description: hit.label,
        duration: 6000,
      });
    }
    localStorage.setItem(key, JSON.stringify([...seen, ...fresh.map((h) => h.id)]));
  }, [hits]);

  return null;
}
