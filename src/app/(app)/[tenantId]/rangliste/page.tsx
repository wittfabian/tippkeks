import Link from "next/link";
import { Crown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireMembership } from "@/lib/auth/membership";
import { getLeaderboard } from "@/lib/data/leaderboard";
import { cn } from "@/lib/utils";
import { de } from "@/messages/de";

const PODIUM_TONE = [
  "bg-reward/15 border-reward/40 text-reward", // 1
  "bg-muted border-border", // 2
  "bg-chart-3/10 border-chart-3/30", // 3
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export const metadata = { title: de.leaderboard.title };

export default async function LeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { tenantId } = await params;
  const { sort = "rank" } = await searchParams;
  const membership = await requireMembership(tenantId);

  const rows = await getLeaderboard(membership.tenantId);

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="font-heading text-lg font-bold">{de.leaderboard.title}</h2>
        <p className="text-muted-foreground text-sm">{de.leaderboard.empty}</p>
      </div>
    );
  }

  const sorted = [...rows];
  if (sort === "exact") sorted.sort((a, b) => b.exact_count - a.exact_count);
  else if (sort === "hits") sorted.sort((a, b) => b.hit_count - a.hit_count);

  const podium = rows.slice(0, 3);
  const base = `/${tenantId}/rangliste`;

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-lg font-bold">{de.leaderboard.title}</h2>

      {/* Podium */}
      <div className="grid grid-cols-3 gap-2">
        {podium.map((r, i) => (
          <div
            key={r.user_id}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border p-3 text-center",
              PODIUM_TONE[i],
              i === 0 && "scale-[1.03]",
            )}
          >
            <div className="bg-background/60 relative flex size-9 items-center justify-center rounded-full text-sm font-bold">
              {initials(r.display_name)}
              {i === 0 && <Crown className="text-reward absolute -top-3 size-4" aria-hidden />}
            </div>
            <span className="w-full truncate text-xs font-medium">{r.display_name}</span>
            <span className="font-heading text-lg font-bold tabular-nums">{r.total_points}</span>
            <span className="text-muted-foreground text-[0.7rem]">
              {de.leaderboard.rank} {r.rank}
            </span>
          </div>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">{de.leaderboard.rank}</TableHead>
            <TableHead>{de.leaderboard.member}</TableHead>
            <TableHead className="text-right">
              <Link href={`${base}?sort=exact`} className="hover:text-foreground">
                {de.leaderboard.exact}
              </Link>
            </TableHead>
            <TableHead className="text-right">
              <Link href={`${base}?sort=hits`} className="hover:text-foreground">
                {de.leaderboard.hits}
              </Link>
            </TableHead>
            <TableHead className="text-right">
              <Link href={base} className="hover:text-foreground">
                {de.leaderboard.points}
              </Link>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => {
            const isMe = r.user_id === membership.userId;
            return (
              <TableRow
                key={r.user_id}
                className={cn(isMe && "bg-primary/10 ring-primary/30 font-medium ring-1")}
              >
                <TableCell className="tabular-nums">{r.rank}</TableCell>
                <TableCell className="truncate">
                  {r.display_name}
                  {isMe && (
                    <span className="text-primary ml-1 text-xs">({de.leaderboard.you})</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.exact_count}</TableCell>
                <TableCell className="text-right tabular-nums">{r.hit_count}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {r.total_points}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-muted-foreground text-xs">{de.leaderboard.tieBreakNote}</p>
    </div>
  );
}
