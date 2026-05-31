/**
 * FIFA 3-letter code → flag emoji for the WM 2026 nations. The code pill stays
 * the reliable primary identity (crest_url is null in the data); the flag is a
 * decorative accent that degrades gracefully where emoji flags don't render.
 */
const FLAG_BY_CODE: Record<string, string> = {
  MEX: "🇲🇽",
  RSA: "🇿🇦",
  KOR: "🇰🇷",
  CZE: "🇨🇿",
  CAN: "🇨🇦",
  BIH: "🇧🇦",
  QAT: "🇶🇦",
  SUI: "🇨🇭",
  BRA: "🇧🇷",
  MAR: "🇲🇦",
  HAI: "🇭🇹",
  SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  USA: "🇺🇸",
  PAR: "🇵🇾",
  AUS: "🇦🇺",
  TUR: "🇹🇷",
  GER: "🇩🇪",
  CUW: "🇨🇼",
  CIV: "🇨🇮",
  ECU: "🇪🇨",
  NED: "🇳🇱",
  JPN: "🇯🇵",
  SWE: "🇸🇪",
  TUN: "🇹🇳",
  BEL: "🇧🇪",
  EGY: "🇪🇬",
  IRN: "🇮🇷",
  NZL: "🇳🇿",
  ESP: "🇪🇸",
  CPV: "🇨🇻",
  KSA: "🇸🇦",
  URU: "🇺🇾",
  FRA: "🇫🇷",
  SEN: "🇸🇳",
  IRQ: "🇮🇶",
  NOR: "🇳🇴",
  ARG: "🇦🇷",
  ALG: "🇩🇿",
  AUT: "🇦🇹",
  JOR: "🇯🇴",
  POR: "🇵🇹",
  COD: "🇨🇩",
  UZB: "🇺🇿",
  COL: "🇨🇴",
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  CRO: "🇭🇷",
  GHA: "🇬🇭",
  PAN: "🇵🇦",
};

/** Flag emoji for a FIFA code (e.g. "GER"), or empty string if unknown. */
export function flagForCode(code: string | null | undefined): string {
  if (!code) return "";
  return FLAG_BY_CODE[code.toUpperCase()] ?? "";
}
