import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading UI for every tenant page. The layout + nav (cheap, memoised
 * membership) paint immediately while the page's data resolves, instead of the
 * whole tab navigation blocking until all queries return.
 */
export default function TenantLoading() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
