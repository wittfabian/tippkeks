import Link from "next/link";

import { CreateGroupForm, JoinGroupForm } from "@/components/groups/group-forms";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";

type MembershipRow = {
  role: "admin" | "member";
  tenant: { id: string; name: string; slug: string } | null;
};

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_member")
    .select("role, tenant:tenant(id, name, slug)")
    .order("joined_at", { ascending: true });

  const memberships = (data ?? []) as MembershipRow[];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">{de.groups.title}</h1>
        {memberships.length === 0 ? (
          <p className="text-muted-foreground text-sm">{de.groups.none}</p>
        ) : (
          <ul className="space-y-2">
            {memberships.map(
              (m) =>
                m.tenant && (
                  <li key={m.tenant.id}>
                    <Card>
                      <CardContent className="flex items-center justify-between gap-3 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{m.tenant.name}</span>
                          <Badge variant={m.role === "admin" ? "default" : "secondary"}>
                            {de.groups.role[m.role]}
                          </Badge>
                        </div>
                        <Link
                          href={`/${m.tenant.slug}`}
                          className={buttonVariants({ size: "sm", variant: "outline" })}
                        >
                          {de.groups.open}
                        </Link>
                      </CardContent>
                    </Card>
                  </li>
                ),
            )}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{de.groups.createTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateGroupForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{de.groups.joinTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <JoinGroupForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
