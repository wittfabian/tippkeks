import { TenantNav } from "@/components/nav/tenant-nav";
import { requireMembership } from "@/lib/auth/membership";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const membership = await requireMembership(tenantId);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{membership.tenantName}</h1>
      <TenantNav tenantId={membership.tenantId} isAdmin={membership.role === "admin"} />
      {children}
    </div>
  );
}
