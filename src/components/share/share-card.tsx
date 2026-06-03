"use client";

import { useRef, useState, type ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { TeamFlag } from "@/components/match/team-flag";
import { Button } from "@/components/ui/button";
import { de } from "@/messages/de";

/**
 * Fixed light-theme brand palette (the app's OKLCH tokens). Hard-coded so an
 * exported image looks identical in light and dark mode — a shareable artifact
 * should not flip with the viewer's theme. Shared by every share-card body.
 */
export const SHARE_PALETTE = {
  bg: "oklch(1 0 0)",
  fg: "oklch(0.17 0.02 165)",
  primary: "oklch(0.58 0.16 150)",
  primaryFg: "oklch(0.99 0.01 150)",
  muted: "oklch(0.955 0.012 160)",
  mutedFg: "oklch(0.48 0.02 165)",
  reward: "oklch(0.8 0.13 85)",
  rewardFg: "oklch(0.27 0.06 70)",
  border: "oklch(0.9 0.008 160)",
} as const;

const C = SHARE_PALETTE;

/** A flag + code + name column, mirroring the in-app team identity. */
export function ShareTeamColumn({
  name,
  code,
  align,
}: {
  name: string;
  code: string | null;
  align: "start" | "end";
}) {
  return (
    <div
      className="flex flex-1 flex-col gap-2"
      style={{ alignItems: align === "end" ? "flex-end" : "flex-start" }}
    >
      <TeamFlag code={code} className="size-14 shadow-sm" />
      <div style={{ textAlign: align === "end" ? "right" : "left" }}>
        <div className="font-heading text-2xl leading-tight font-extrabold">{code ?? "?"}</div>
        <div className="text-sm" style={{ color: C.mutedFg }}>
          {name}
        </div>
      </div>
    </div>
  );
}

/** A muted pill row used in every share-card body (one member / rank per line). */
export function ShareRow({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-xl px-4 py-2.5"
      style={{ backgroundColor: C.muted }}
    >
      {children}
    </div>
  );
}

/**
 * Renders an off-screen branded card (brand header band + body + footer) and
 * exports it to a downloadable PNG via html-to-image. The body is provided by
 * the caller; this shell owns the chrome, palette and the capture/download.
 */
export function ShareCard({
  groupName,
  fileSlug,
  buttonLabel,
  buttonTitle,
  headerRight,
  children,
}: {
  groupName: string;
  /** Used in the download filename: `tippkeks-<fileSlug>.png`. */
  fileSlug: string;
  buttonLabel: string;
  /** Optional tooltip on the download button. */
  buttonTitle?: string;
  /** Optional content for the right side of the header band (date, score, …). */
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleDownload() {
    const node = cardRef.current;
    if (!node || busy) return;
    setBusy(true);
    setError(false);
    try {
      // Ensure web fonts are ready before capture, then warm up once — the first
      // html-to-image pass can miss freshly-fetched font data, the second is stable.
      await document.fonts.ready;
      const { toPng } = await import("html-to-image");
      const options = { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" };
      await toPng(node, options);
      const dataUrl = await toPng(node, options);

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `tippkeks-${fileSlug}.png`;
      link.click();
    } catch (err) {
      console.error("[share-card] export failed", err);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={busy}
        title={buttonTitle}
      >
        {busy ? de.share.busy : buttonLabel}
      </Button>
      {error && (
        <span role="alert" className="text-destructive text-xs">
          {de.share.error}
        </span>
      )}

      {/* Off-screen capture target: laid out (not display:none) so html-to-image
          can measure it, but parked outside the viewport and non-interactive. */}
      <div
        aria-hidden
        style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }}
      >
        <div
          ref={cardRef}
          className="w-[760px] overflow-hidden rounded-3xl font-sans"
          style={{ backgroundColor: C.bg, color: C.fg, border: `1px solid ${C.border}` }}
        >
          {/* Header band */}
          <div
            className="flex items-center justify-between px-9 py-7"
            style={{ backgroundColor: C.primary, color: C.primaryFg }}
          >
            <div className="flex items-center gap-3">
              <Logo size={48} />
              <div>
                <div className="font-heading text-2xl font-extrabold tracking-tight">
                  {de.app.name}
                </div>
                <div className="text-sm" style={{ opacity: 0.9 }}>
                  {groupName}
                </div>
              </div>
            </div>
            {headerRight && (
              <div className="text-right text-sm" style={{ opacity: 0.92 }}>
                {headerRight}
              </div>
            )}
          </div>

          {children}

          {/* Footer */}
          <div
            className="flex items-center justify-between px-9 py-4 text-xs"
            style={{ backgroundColor: C.muted, color: C.mutedFg }}
          >
            <span className="font-medium">{de.share.footer}</span>
            <span>{de.app.tagline}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
