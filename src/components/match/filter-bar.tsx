"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { de } from "@/messages/de";

export interface FilterBarProps {
  stages: { kind: string; name: string }[];
  nations: { code: string; name: string }[];
  openCount: number;
}

export function FilterBar({ stages, nations, openCount }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "open";
  const stage = sp.get("stage") ?? "all";
  const team = sp.get("team") ?? "all";

  function setParam(key: string, value: string, isDefault: boolean) {
    const params = new URLSearchParams(sp.toString());
    if (isDefault) params.delete(key);
    else params.set(key, value);
    router.replace(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  }

  const statuses = [
    { key: "open", label: openCount > 0 ? `${de.filters.open} (${openCount})` : de.filters.open },
    { key: "all", label: de.filters.all },
    { key: "live", label: de.filters.live },
    { key: "finished", label: de.filters.finished },
  ];

  return (
    <div className="bg-background/80 sticky top-[6rem] z-10 -mx-4 space-y-2 px-4 pt-2 pb-2 backdrop-blur">
      <div className="bg-muted flex gap-1 rounded-lg p-1">
        {statuses.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setParam("status", s.key, s.key === "open")}
            aria-pressed={status === s.key}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              status === s.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto">
        <ChipButton active={stage === "all"} onClick={() => setParam("stage", "all", true)}>
          {de.filters.stageAll}
        </ChipButton>
        {stages.map((s) => (
          <ChipButton
            key={s.kind}
            active={stage === s.kind}
            onClick={() => setParam("stage", s.kind, false)}
          >
            {s.name}
          </ChipButton>
        ))}
        {nations.length > 0 && (
          <select
            value={team}
            onChange={(e) => setParam("team", e.target.value, e.target.value === "all")}
            aria-label={de.filters.nationAll}
            className="border-input bg-background ml-auto shrink-0 rounded-full border px-2 py-1 text-xs"
          >
            <option value="all">{de.filters.nationAll}</option>
            {nations.map((n) => (
              <option key={n.code} value={n.code}>
                {n.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
