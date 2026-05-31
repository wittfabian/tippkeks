import type { StageKind } from "@/lib/scoring/engine";

/** German display name + stable ordinal for every stage kind. */
export const STAGE_META: Record<StageKind, { name: string; ordinal: number }> = {
  group: { name: "Gruppenphase", ordinal: 1 },
  last_32: { name: "Sechzehntelfinale", ordinal: 2 },
  last_16: { name: "Achtelfinale", ordinal: 3 },
  quarter_final: { name: "Viertelfinale", ordinal: 4 },
  semi_final: { name: "Halbfinale", ordinal: 5 },
  third_place: { name: "Spiel um Platz 3", ordinal: 6 },
  final: { name: "Finale", ordinal: 7 },
  matchday: { name: "Spieltag", ordinal: 8 },
  other: { name: "Sonstige", ordinal: 9 },
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
