"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { de } from "@/messages/de";

export function TenantNav({ slug, isAdmin }: { slug: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const base = `/${slug}`;
  const items = [
    { href: base, label: de.nav.dashboard, exact: true },
    { href: `${base}/spiele`, label: de.nav.fixtures, exact: false },
    { href: `${base}/rangliste`, label: de.nav.leaderboard, exact: false },
    { href: `${base}/profil`, label: de.nav.profile, exact: false },
    ...(isAdmin ? [{ href: `${base}/admin`, label: de.nav.admin, exact: false }] : []),
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto border-b pb-2 text-sm">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 whitespace-nowrap",
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
