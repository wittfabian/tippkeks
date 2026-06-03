"use client";

import { useEffect } from "react";

import "./globals.css";
import { Logo } from "@/components/brand/logo";
import { de } from "@/messages/de";

/**
 * Last-resort boundary: catches errors thrown by the root layout itself, so it
 * must render its own <html>/<body> (it replaces the root layout). Theme tokens
 * come from the imported globals.css (default light palette); the display font
 * variable is unset here and falls back — acceptable for this rare catastrophe.
 */
export default function GlobalError({
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
    <html lang="de">
      <body className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-6 p-4 text-center antialiased">
        <Logo size={64} />
        <div className="max-w-md space-y-3">
          <p className="text-5xl font-extrabold tracking-tight">{de.errors.globalTitle}</p>
          <h1 className="text-xl font-bold">{de.errors.globalHeading}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{de.errors.globalBody}</p>
        </div>
        <button
          onClick={reset}
          className="bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
        >
          {de.errors.globalRetry}
        </button>
      </body>
    </html>
  );
}
