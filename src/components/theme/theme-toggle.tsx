"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { de } from "@/messages/de";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Icon visibility is driven by the .dark class (no hydration mismatch); the
  // click resolves the current theme to flip it.
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={de.nav.toggleTheme}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}
