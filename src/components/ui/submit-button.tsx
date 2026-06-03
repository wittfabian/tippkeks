"use client";

import { type ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { de } from "@/messages/de";

/**
 * A form submit button that reflects the parent form's pending state via
 * `useFormStatus` — it disables itself and shows the loading label while the
 * action runs, so individual forms no longer thread `pending` through. Forwards
 * Button props (variant, size, className); an extra `disabled` is OR-ed with
 * pending. Must be rendered inside the `<form>` whose status it should track.
 */
export function SubmitButton({
  label,
  disabled,
  ...props
}: { label: string } & Omit<ComponentProps<typeof Button>, "type" | "children">) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? de.common.loading : label}
    </Button>
  );
}
