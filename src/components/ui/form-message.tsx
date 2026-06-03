import { cn } from "@/lib/utils";

/**
 * Inline form feedback: a destructive `alert` for errors, or an emerald `status`
 * for success/info. Renders nothing when both are empty. Shared by every form so
 * the role semantics and colours stay consistent in one place.
 */
export function FormMessage({
  error,
  info,
  size = "sm",
}: {
  error?: string | null;
  info?: string | null;
  /** Text size — "sm" for standalone forms, "xs" for dense/admin contexts. */
  size?: "sm" | "xs";
}) {
  const textSize = size === "xs" ? "text-xs" : "text-sm";
  if (error) {
    return (
      <p role="alert" className={cn("text-destructive", textSize)}>
        {error}
      </p>
    );
  }
  if (info) {
    return (
      <p role="status" className={cn("text-emerald-600 dark:text-emerald-400", textSize)}>
        {info}
      </p>
    );
  }
  return null;
}
