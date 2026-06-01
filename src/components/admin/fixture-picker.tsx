"use client";

import { useRouter } from "next/navigation";

import { de } from "@/messages/de";

export type FixtureOption = { id: string; label: string };
/** `key` is the stable Berlin day key used for grouping/React keys; `heading` is shown. */
export type FixtureGroup = { key: string; heading: string; options: FixtureOption[] };

/**
 * Compact day-grouped dropdown for picking the fixture to enter member tips for.
 * Replaces the wall of chips, which did not scale to a full tournament (104
 * matches) and silently truncated the list. Navigates via ?fixture= on change.
 */
export function FixturePicker({
  base,
  selectedId,
  groups,
}: {
  base: string;
  selectedId: string;
  groups: FixtureGroup[];
}) {
  const router = useRouter();
  return (
    <select
      aria-label={de.admin.tipsPickFixture}
      value={selectedId}
      onChange={(e) => router.push(`${base}?fixture=${e.target.value}`)}
      className="border-input bg-background w-full max-w-md cursor-pointer rounded-md border px-2.5 py-2 text-sm"
    >
      {groups.map((group) => (
        <optgroup key={group.key} label={group.heading}>
          {group.options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
