import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireMembership } from "@/lib/auth/membership";
import { de } from "@/messages/de";

export const metadata = { title: de.leaderboard.title };

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const membership = await requireMembership(tenantSlug);

  const { data } = await membership.supabase
    .from("leaderboard")
    .select("user_id, display_name, total_points, exact_count, hit_count, rank")
    .eq("tenant_id", membership.tenantId)
    .order("rank", { ascending: true });

  const rows = data ?? [];

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{de.leaderboard.title}</h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{de.leaderboard.empty}</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{de.leaderboard.rank}</TableHead>
                <TableHead>{de.leaderboard.member}</TableHead>
                <TableHead className="text-right">{de.leaderboard.exact}</TableHead>
                <TableHead className="text-right">{de.leaderboard.hits}</TableHead>
                <TableHead className="text-right">{de.leaderboard.points}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell className="tabular-nums">{r.rank}</TableCell>
                  <TableCell>{r.display_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.exact_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.hit_count}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {r.total_points}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-muted-foreground text-xs">{de.leaderboard.tieBreakNote}</p>
        </>
      )}
    </div>
  );
}
