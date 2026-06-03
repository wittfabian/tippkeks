import type { StageKind } from "@/lib/scoring/engine";
import { de } from "@/messages/de";

/** German display name (from the de.ts boundary) + stable ordinal per stage kind. */
export const STAGE_META: Record<StageKind, { name: string; ordinal: number }> = {
  group: { name: de.stages.group, ordinal: 1 },
  last_32: { name: de.stages.last_32, ordinal: 2 },
  last_16: { name: de.stages.last_16, ordinal: 3 },
  quarter_final: { name: de.stages.quarter_final, ordinal: 4 },
  semi_final: { name: de.stages.semi_final, ordinal: 5 },
  third_place: { name: de.stages.third_place, ordinal: 6 },
  final: { name: de.stages.final, ordinal: 7 },
  matchday: { name: de.stages.matchday, ordinal: 8 },
  other: { name: de.stages.other, ordinal: 9 },
};

/** True for knockout stages, where an advancing-team prediction applies. */
export function isKnockoutStage(kind: StageKind): boolean {
  return (
    kind === "last_32" ||
    kind === "last_16" ||
    kind === "quarter_final" ||
    kind === "semi_final" ||
    kind === "third_place" ||
    kind === "final"
  );
}
