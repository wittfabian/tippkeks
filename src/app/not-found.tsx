import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { de } from "@/messages/de";

export const metadata = { title: de.errors.notFoundTitle };

/**
 * Root 404. Renders inside the root layout (html/body + ThemeProvider), so it
 * inherits theme and fonts. Kept playful and football-themed per the brand voice.
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <Logo size={64} className="opacity-90" />
          <p className="font-heading text-6xl font-extrabold tracking-tight tabular-nums">404</p>
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold">{de.errors.notFoundHeading}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{de.errors.notFoundBody}</p>
        </div>
        <Link href="/" className={buttonVariants({})}>
          {de.errors.notFoundHome}
        </Link>
      </div>
    </main>
  );
}
