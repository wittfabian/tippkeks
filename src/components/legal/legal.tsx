import type { ReactNode } from "react";

/** Title + optional "last updated" line shared by every legal page. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
        {updated ? <p className="text-muted-foreground text-xs">{updated}</p> : null}
      </header>
      {children}
    </article>
  );
}

/** A headed block of body copy with consistent muted spacing. */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-foreground text-base font-semibold">{heading}</h2>
      <div className="text-muted-foreground space-y-2">{children}</div>
    </section>
  );
}
