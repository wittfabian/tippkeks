"use client";

import { useRef, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { TeamFlag } from "@/components/match/team-flag";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { de } from "@/messages/de";

export interface TipCardFixture {
  homeName: string;
  homeCode: string | null;
  awayName: string;
  awayCode: string | null;
  kickoffAt: string;
  stageName: string;
}

export interface TipCardRow {
  userId: string;
  name: string;
  home: number | null;
  away: number | null;
}

/**
 * Fixed light-theme brand palette (the app's OKLCH tokens). Hard-coded here so
 * the exported image looks identical in light and dark mode — a shareable
 * artifact should not flip with the viewer's theme.
 */
const C = {
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

function TeamColumn({
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

/**
 * Renders an off-screen branded card of every member's saved tip for one
 * fixture and exports it to a downloadable PNG via html-to-image. Reuses the
 * real flag SVGs + brand logo so the image matches the app exactly.
 */
export function TipCardDownload({
  groupName,
  fixture,
  rows,
}: {
  groupName: string;
  fixture: TipCardFixture;
  rows: TipCardRow[];
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

      const slug = `${fixture.homeCode ?? "team"}-${fixture.awayCode ?? "team"}`.toLowerCase();
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `tippkeks-${slug}.png`;
      link.click();
    } catch (err) {
      console.error("[tip-card] export failed", err);
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
        title={de.admin.tipImageHint}
      >
        {busy ? de.admin.tipImageBusy : de.admin.tipImageDownload}
      </Button>
      {error && (
        <span role="alert" className="text-destructive text-xs">
          {de.admin.tipImageError}
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
          className="font-sans w-[760px] overflow-hidden rounded-3xl"
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
            <div className="text-right text-sm" style={{ opacity: 0.92 }}>
              <div className="font-medium">{fixture.stageName}</div>
              <div>{formatDateTime(fixture.kickoffAt)} Uhr</div>
            </div>
          </div>

          {/* Fixture */}
          <div
            className="flex items-center gap-6 px-9 py-7"
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <TeamColumn name={fixture.homeName} code={fixture.homeCode} align="end" />
            <div
              className="font-heading text-xl font-bold"
              style={{ color: C.mutedFg, opacity: 0.7 }}
            >
              :
            </div>
            <TeamColumn name={fixture.awayName} code={fixture.awayCode} align="start" />
          </div>

          {/* Members + their tips */}
          <div className="px-9 py-5">
            <div className="flex flex-col gap-1.5">
              {rows.map((row) => {
                const hasTip = row.home !== null && row.away !== null;
                return (
                  <div
                    key={row.userId}
                    className="flex items-center justify-between gap-4 rounded-xl px-4 py-2.5"
                    style={{ backgroundColor: C.muted }}
                  >
                    <span className="truncate text-lg font-medium">{row.name}</span>
                    {hasTip ? (
                      <span
                        className="font-mono text-lg font-bold tabular-nums"
                        style={{
                          backgroundColor: C.reward,
                          color: C.rewardFg,
                          borderRadius: "9999px",
                          padding: "2px 16px",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {row.home} : {row.away}
                      </span>
                    ) : (
                      <span className="text-sm" style={{ color: C.mutedFg }}>
                        {de.admin.tipImageNoTip}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-9 py-4 text-xs"
            style={{ backgroundColor: C.muted, color: C.mutedFg }}
          >
            <span className="font-medium">{de.admin.tipImageFooter}</span>
            <span>{de.app.tagline}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
