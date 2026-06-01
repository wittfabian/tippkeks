import { ResultForm } from "@/components/admin/admin-forms";
import { requireAdmin } from "@/lib/auth/membership";
import { getFixtureBoard } from "@/lib/data/fixtures";
import { formatDateTime } from "@/lib/format";
import { de } from "@/messages/de";

export const metadata = { title: de.admin.results };

export default async function ResultsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const membership = await requireAdmin(tenantId);

  const board = await getFixtureBoard(membership.supabase, membership.tenantId, membership.userId);
  const needsResult = board.filter((f) => f.locked && f.status !== "finished" && f.home && f.away);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{de.admin.results}</h2>
        <p className="text-muted-foreground text-sm">{de.admin.resultsIntro}</p>
      </div>

      {needsResult.length === 0 ? (
        <p className="text-muted-foreground text-sm">{de.admin.resultsNone}</p>
      ) : (
        <ul className="space-y-3">
          {needsResult.map((f) => (
            <li key={f.id} className="space-y-1 rounded-md border p-3">
              <p className="text-muted-foreground text-xs">{formatDateTime(f.kickoffAt)} Uhr</p>
              <ResultForm
                tenantId={membership.tenantId}
                fixtureId={f.id}
                homeName={f.home?.name ?? "?"}
                awayName={f.away?.name ?? "?"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
