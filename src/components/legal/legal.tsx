import type { ReactNode } from "react";

/**
 * Title and body shared by every legal page. No "last updated" line: the
 * Impressum and the privacy policy are supplied by the operator now, so their
 * own text carries whatever date applies to them.
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
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
