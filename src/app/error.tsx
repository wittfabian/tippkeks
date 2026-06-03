"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Logo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { de } from "@/messages/de";

/**
 * Route-segment error boundary. Renders inside the root layout, so theme/fonts
 * are available. The UI stays light-hearted; the real error goes to the console
 * (and any monitoring) for diagnosis. `reset()` retries the failed render.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <Logo size={64} className="opacity-90" />
          <p className="font-heading text-5xl font-extrabold tracking-tight">
            {de.errors.errorTitle}
          </p>
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold">{de.errors.errorHeading}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{de.errors.errorBody}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>{de.errors.errorRetry}</Button>
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>
            {de.errors.errorHome}
          </Link>
        </div>
        {error.digest && (
          <p className="text-muted-foreground/70 font-mono text-xs">
            {de.errors.errorDigest(error.digest)}
          </p>
        )}
      </div>
    </main>
  );
}
