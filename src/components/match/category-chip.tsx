import { Minus, SlidersHorizontal, Target, TrendingUp } from "lucide-react";

import type { ScoreCategory } from "@/lib/scoring/engine";
import { cn } from "@/lib/utils";
import { de } from "@/messages/de";

const CONFIG: Record<ScoreCategory, { icon: typeof Target; className: string }> = {
  exact: { icon: Target, className: "border-chart-1/40 text-chart-1" },
  goal_diff: { icon: SlidersHorizontal, className: "border-chart-2/40 text-chart-2" },
  tendency: { icon: TrendingUp, className: "border-chart-3/50 text-chart-3" },
  miss: { icon: Minus, className: "border-border text-muted-foreground" },
};

/**
 * Score-category pill: icon + German word + token colour. Colour never stands
 * alone (icon + label carry the meaning too), per the accessibility guardrail.
 */
export function CategoryChip({
  category,
  points,
  className,
}: {
  category: ScoreCategory;
  points?: number | null;
  className?: string;
}) {
  const { icon: Icon, className: tone } = CONFIG[category];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {de.categories[category]}
      {points != null && <span className="tabular-nums">· {points}</span>}
    </span>
  );
}
