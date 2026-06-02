import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { CreateGroupForm, JoinGroupForm } from "@/components/groups/group-forms";
import { Badge } from "@/components/ui/badge";
import { isSiteAdmin } from "@/lib/auth/membership";
import { getAppSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";

type MembershipRow = {
  role: "admin" | "member";
  tenant: { id: string; name: string } | null;
};

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  // Scope to the current user's own memberships: the tenant_member SELECT policy
  // lets a member read the whole roster, so without this filter a group would
  // appear once per co-member (and per role).
  const { data } = userId
    ? await supabase
        .from("tenant_member")
        .select("role, tenant:tenant(id, name)")
        .eq("user_id", userId)
        .order("joined_at", { ascending: true })
    : { data: [] };

  const memberships = (data ?? []) as MembershipRow[];

  const { groupCreationEnabled } = await getAppSettings(supabase);
  const canCreate = groupCreationEnabled || (await isSiteAdmin(supabase));

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{de.groups.title}</h1>
        {memberships.length === 0 ? (
          <p className="text-muted-foreground text-sm">{de.groups.none}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {memberships.map(
              (m) =>
                m.tenant && (
                  <li key={m.tenant.id}>
                    <Link
                      href={`/${m.tenant.id}`}
                      className="hover:bg-muted/50 flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{m.tenant.name}</span>
                        <Badge variant={m.role === "admin" ? "default" : "secondary"}>
                          {de.groups.role[m.role]}
                        </Badge>
                      </span>
                      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                    </Link>
                  </li>
                ),
            )}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {canCreate && (
          <section className="space-y-2">
            <h2 className="text-muted-foreground text-sm font-medium">{de.groups.createTitle}</h2>
            <div className="rounded-md border p-3">
              <CreateGroupForm />
            </div>
          </section>
        )}
        <section className="space-y-2">
          <h2 className="text-muted-foreground text-sm font-medium">{de.groups.joinTitle}</h2>
          <div className="rounded-md border p-3">
            <JoinGroupForm />
          </div>
        </section>
      </div>
    </div>
  );
}
