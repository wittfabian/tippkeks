/**
 * FIFA 3-letter code → ISO 3166-1 alpha-2 (or GB subdivision) code for the
 * WM 2026 nations. Consumers render the matching flag SVG (see `TeamFlag`);
 * the code pill stays the reliable primary identity (crest_url is null in the
 * data), with the flag a decorative accent. FIFA codes diverge from ISO often
 * enough (GER→DE, NED→NL, SUI→CH …) that the mapping is explicit.
 */
const ISO_BY_FIFA: Record<string, string> = {
  MEX: "MX",
  RSA: "ZA",
  KOR: "KR",
  CZE: "CZ",
  CAN: "CA",
  BIH: "BA",
  QAT: "QA",
  SUI: "CH",
  BRA: "BR",
  MAR: "MA",
  HAI: "HT",
  SCO: "GB-SCT",
  USA: "US",
  PAR: "PY",
  AUS: "AU",
  TUR: "TR",
  GER: "DE",
  CUW: "CW",
  CIV: "CI",
  ECU: "EC",
  NED: "NL",
  JPN: "JP",
  SWE: "SE",
  TUN: "TN",
  BEL: "BE",
  EGY: "EG",
  IRN: "IR",
  NZL: "NZ",
  ESP: "ES",
  CPV: "CV",
  KSA: "SA",
  URU: "UY",
  FRA: "FR",
  SEN: "SN",
  IRQ: "IQ",
  NOR: "NO",
  ARG: "AR",
  ALG: "DZ",
  AUT: "AT",
  JOR: "JO",
  POR: "PT",
  COD: "CD",
  UZB: "UZ",
  COL: "CO",
  ENG: "GB-ENG",
  CRO: "HR",
  GHA: "GH",
  PAN: "PA",
};

/** ISO 3166 code for a FIFA code (e.g. "GER" → "DE"), or null if unknown. */
export function isoForFifaCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return ISO_BY_FIFA[code.toUpperCase()] ?? null;
}
