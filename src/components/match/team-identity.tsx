import { TeamFlag } from "@/components/match/team-flag";
import { cn } from "@/lib/utils";

export interface TeamLike {
  name: string;
  shortName: string | null;
}

/**
 * Team identity: flag accent + 3-letter code pill (the reliable primary
 * identity) + full name. `align="end"` mirrors it for the away side of a card.
 * The flag is decorative (aria-hidden); the full name carries the label.
 */
export function TeamIdentity({
  team,
  align = "start",
  showName = true,
  className,
}: {
  team: TeamLike | null;
  align?: "start" | "end";
  showName?: boolean;
  className?: string;
}) {
  const code = team?.shortName ?? "?";
  const name = team?.name ?? "?";

  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5",
        align === "end" ? "flex-row-reverse text-right" : "text-left",
        className,
      )}
    >
      <TeamFlag code={team?.shortName} className="size-4 shrink-0" />
      <span className="bg-muted text-muted-foreground rounded px-1 py-0.5 font-mono text-[0.7rem] leading-none font-medium">
        {code}
      </span>
      {showName && <span className="truncate text-sm font-medium">{name}</span>}
    </span>
  );
}
