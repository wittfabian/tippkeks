/**
 * Date/number formatting for the German UI. All timestamps are stored as UTC
 * (timestamptz) and rendered in Europe/Berlin here — never with the server's
 * local timezone. Fixtures are grouped by the German calendar day, so a late
 * North-American kickoff that lands after midnight CEST appears on the correct
 * German date.
 */
import { de } from "@/messages/de";

const BERLIN = "Europe/Berlin";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BERLIN,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dayHeadingFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: BERLIN,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: BERLIN,
  hour: "2-digit",
  minute: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: BERLIN,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Stable key for grouping fixtures by German calendar day, e.g. "2026-06-11". */
export function berlinDayKey(value: string | Date): string {
  return dayKeyFormatter.format(toDate(value));
}

/** Heading for a day group, e.g. "Donnerstag, 11. Juni 2026". */
export function formatDayHeading(value: string | Date): string {
  return dayHeadingFormatter.format(toDate(value));
}

/** Kickoff time only, e.g. "21:00" (no clock suffix). */
export function formatTime(value: string | Date): string {
  return timeFormatter.format(toDate(value));
}

/** Kickoff time with the German clock suffix, e.g. "21:00 Uhr". */
export function formatKickoffTime(value: string | Date): string {
  return `${formatTime(value)} ${de.common.clock}`;
}

/** Full date and time with the German clock suffix, e.g. "11.06.2026, 21:00 Uhr". */
export function formatDateTime(value: string | Date): string {
  return `${dateTimeFormatter.format(toDate(value))} ${de.common.clock}`;
}

/** Score/result label used by match views (in-app and shareable images). */
export interface ResultParts {
  regularHome: number | null;
  regularAway: number | null;
  afterExtraTime?: boolean | null;
  penaltyHome?: number | null;
  penaltyAway?: number | null;
}

/**
 * Final-result label, e.g. "2:1", "2:1 n.V." (after extra time) or
 * "2:2 (4:3 i.E.)" (penalty shoot-out). "–:–" when the match has no result yet.
 */
export function formatResult(r: ResultParts): string {
  if (r.regularHome == null || r.regularAway == null) return "–:–";
  const et = r.afterExtraTime ? ` ${de.fixtures.afterExtraTime}` : "";
  const pens =
    r.penaltyHome != null && r.penaltyAway != null
      ? ` (${r.penaltyHome}:${r.penaltyAway} ${de.fixtures.penaltiesShort})`
      : "";
  return `${r.regularHome}:${r.regularAway}${et}${pens}`;
}

/** Whether a kickoff time has passed (the prediction deadline). */
export function hasKickedOff(value: string | Date): boolean {
  return toDate(value).getTime() <= Date.now();
}
