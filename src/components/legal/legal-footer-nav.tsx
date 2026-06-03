import Link from "next/link";
import { type ReactNode } from "react";

import { de } from "@/messages/de";

const linkClass = "hover:text-foreground transition";

/**
 * The shared info / privacy / impressum link list used in every layout footer.
 * `trailing` appends extra items (a "back home" link, a powered-by note) after a
 * separator. Render inside the footer's own `<nav>`/`<div>` that owns the layout
 * and colour classes.
 */
export function LegalFooterNav({ trailing }: { trailing?: ReactNode }) {
  return (
    <>
      <Link href="/info" className={linkClass}>
        {de.legal.footerNav.info}
      </Link>
      <span aria-hidden>·</span>
      <Link href="/privacy" className={linkClass}>
        {de.legal.footerNav.privacy}
      </Link>
      <span aria-hidden>·</span>
      <Link href="/imprint" className={linkClass}>
        {de.legal.footerNav.impressum}
      </Link>
      {trailing && (
        <>
          <span aria-hidden>·</span>
          {trailing}
        </>
      )}
    </>
  );
}
