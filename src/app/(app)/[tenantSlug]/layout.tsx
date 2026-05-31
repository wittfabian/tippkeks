import { TenantNav } from "@/components/nav/tenant-nav";
import { requireMembership } from "@/lib/auth/membership";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const membership = await requireMembership(tenantSlug);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{membership.tenantName}</h1>
      <TenantNav slug={membership.slug} isAdmin={membership.role === "admin"} />
      {children}
    </div>
  );
}
