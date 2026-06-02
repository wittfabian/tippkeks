"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { de } from "@/messages/de";

export function TenantNav({ tenantId, isAdmin }: { tenantId: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const base = `/${tenantId}`;
  const items = [
    { href: base, label: de.nav.dashboard, exact: true },
    { href: `${base}/matches`, label: de.nav.fixtures, exact: false },
    { href: `${base}/leaderboard`, label: de.nav.leaderboard, exact: false },
    ...(isAdmin
      ? [
          { href: `${base}/tips`, label: de.admin.enterTips, exact: false },
          { href: `${base}/admin`, label: de.nav.admin, exact: false },
        ]
      : []),
  ];

  return (
    <nav className="bg-background/80 sticky top-[3.25rem] z-20 -mx-4 flex gap-1 overflow-x-auto border-b px-4 pt-1 pb-2 text-sm backdrop-blur">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1.5 whitespace-nowrap",
              active ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
