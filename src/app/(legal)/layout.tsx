import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { de } from "@/messages/de";

/**
 * Public legal/info pages (Impressum, Datenschutz, Über). Reachable signed-out
 * and signed-in — deliberately NOT under (public), whose layout redirects
 * authenticated users away.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" aria-label={de.app.name}>
            <Wordmark />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 text-sm leading-relaxed">
        {children}
      </main>

      <footer className="text-muted-foreground border-t">
        <nav className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-4 text-xs">
          <Link href="/info" className="hover:text-foreground transition">
            {de.legal.footerNav.info}
          </Link>
          <span aria-hidden>·</span>
          <Link href="/datenschutz" className="hover:text-foreground transition">
            {de.legal.footerNav.privacy}
          </Link>
          <span aria-hidden>·</span>
          <Link href="/impressum" className="hover:text-foreground transition">
            {de.legal.footerNav.impressum}
          </Link>
          <span aria-hidden>·</span>
          <Link href="/" className="hover:text-foreground transition">
            {de.legal.backHome}
          </Link>
        </nav>
      </footer>
    </div>
  );
}
