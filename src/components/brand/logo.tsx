import { cn } from "@/lib/utils";
import { de } from "@/messages/de";

/**
 * TippKeks brand mark: a baked cookie whose "chips" are football pentagons —
 * the name (Tipp + Keks) made literal. Colours are fixed (not theme-driven) so
 * the mark stays recognisable on either background; it scales from favicon to
 * hero via the single `size` prop.
 */

/** Vertices of a regular pentagon, pointing up, rotated by `rot` degrees. */
function pentagonPoints(cx: number, cy: number, r: number, rot = 0): string {
  return Array.from({ length: 5 }, (_, i) => {
    const angle = ((-90 + rot + i * 72) * Math.PI) / 180;
    return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}

const CHIPS = [
  { cx: 14, cy: 13.5, r: 4.2, rot: 8 },
  { cx: 27.5, cy: 17, r: 3.4, rot: -14 },
  { cx: 17.5, cy: 27.5, r: 3.7, rot: 20 },
] as const;

const CRUMBS = [
  { cx: 25.5, cy: 27, r: 1.4 },
  { cx: 9.5, cy: 21.5, r: 1.3 },
  { cx: 24, cy: 8.5, r: 1.2 },
] as const;

export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-label={de.app.name}
      className={cn("shrink-0", className)}
    >
      <circle cx="20" cy="20" r="17.5" fill="#E0A458" stroke="#B5762E" strokeWidth="2" />
      {CRUMBS.map((c, i) => (
        <circle key={`crumb-${i}`} cx={c.cx} cy={c.cy} r={c.r} fill="#B5762E" />
      ))}
      {CHIPS.map((c, i) => (
        <polygon key={`chip-${i}`} points={pentagonPoints(c.cx, c.cy, c.r, c.rot)} fill="#26303A" />
      ))}
    </svg>
  );
}

/** Logo plus the wordmark, for headers and auth screens. */
export function Wordmark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Logo size={size} />
      <span className="font-heading text-lg font-extrabold tracking-tight">{de.app.name}</span>
    </span>
  );
}
