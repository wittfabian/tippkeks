import {
  AR,
  AT,
  AU,
  BA,
  BE,
  BR,
  CA,
  CD,
  CH,
  CI,
  CO,
  CV,
  CW,
  CZ,
  DE,
  DZ,
  EC,
  EG,
  ES,
  FR,
  GB_ENG,
  GB_SCT,
  GH,
  HR,
  HT,
  IQ,
  IR,
  JO,
  JP,
  KR,
  MA,
  MX,
  NL,
  NO,
  NZ,
  PA,
  PT,
  PY,
  QA,
  SA,
  SE,
  SN,
  TN,
  TR,
  US,
  UY,
  UZ,
  ZA,
} from "country-flag-icons/react/1x1";

import { isoForFifaCode } from "@/lib/i18n/teamFlags";
import { cn } from "@/lib/utils";

/**
 * Team flag as an inline SVG keyed by FIFA code. SVGs render identically on
 * every platform, unlike Unicode flag emoji (Windows' Segoe UI Emoji ships no
 * regional-indicator glyphs). Renders nothing for unmapped codes; decorative
 * (aria-hidden) — the code pill + name carry the team's identity.
 */
const FLAG_BY_ISO = {
  AR,
  AT,
  AU,
  BA,
  BE,
  BR,
  CA,
  CD,
  CH,
  CI,
  CO,
  CV,
  CW,
  CZ,
  DE,
  DZ,
  EC,
  EG,
  ES,
  FR,
  "GB-ENG": GB_ENG,
  "GB-SCT": GB_SCT,
  GH,
  HR,
  HT,
  IQ,
  IR,
  JO,
  JP,
  KR,
  MA,
  MX,
  NL,
  NO,
  NZ,
  PA,
  PT,
  PY,
  QA,
  SA,
  SE,
  SN,
  TN,
  TR,
  US,
  UY,
  UZ,
  ZA,
} as const;

export function TeamFlag({
  code,
  className,
}: {
  code: string | null | undefined;
  className?: string;
}) {
  const iso = isoForFifaCode(code);
  if (!iso || !(iso in FLAG_BY_ISO)) return null;
  const FlagSvg = FLAG_BY_ISO[iso as keyof typeof FLAG_BY_ISO];
  return <FlagSvg className={cn("rounded-full", className)} aria-hidden />;
}
