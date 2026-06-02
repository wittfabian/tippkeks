"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { de } from "@/messages/de";

/**
 * Sharing controls for an invite code: copy the full join link, hand it to
 * WhatsApp, or use the native share sheet. The link is built from the live
 * origin at action time (no SITE_URL env to keep in sync), and the display field
 * is filled imperatively after mount so SSR stays stable and there's no
 * setState-in-effect cascade.
 */
export function InviteShare({ code }: { code: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const linkFor = () => `${window.location.origin}/join/${code}`;

  useEffect(() => {
    if (inputRef.current) inputRef.current.value = linkFor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function copy() {
    await navigator.clipboard.writeText(linkFor());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function whatsapp() {
    const text = `${de.invite.shareMessage} ${linkFor()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  async function share() {
    const url = linkFor();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: de.invite.shareMessage, url });
        return;
      } catch {
        // User dismissed the share sheet — nothing to do.
      }
    }
    await copy();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        readOnly
        defaultValue={`/join/${code}`}
        aria-label={de.invite.copy}
        onFocus={(e) => e.currentTarget.select()}
        className="border-input bg-muted/40 text-muted-foreground min-w-0 flex-1 rounded-md border px-2 py-1 font-mono text-xs"
      />
      <Button type="button" size="xs" variant="outline" onClick={copy}>
        {copied ? de.invite.copied : de.invite.copy}
      </Button>
      <Button type="button" size="xs" variant="outline" onClick={whatsapp}>
        {de.invite.whatsapp}
      </Button>
      <Button type="button" size="xs" variant="outline" onClick={share}>
        {de.invite.share}
      </Button>
    </div>
  );
}
