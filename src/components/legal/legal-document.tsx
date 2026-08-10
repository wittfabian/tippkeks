import { de } from "@/messages/de";

/**
 * Renders an operator-supplied legal document.
 *
 * `dangerouslySetInnerHTML` is deliberate and not a shortcut: the markup comes
 * from a file on the server the operator mounted themselves, which is the same
 * trust level as the rest of the deployment configuration. It never contains
 * user input, so there is no escaping to be done — sanitising here would only
 * mangle an operator's own valid markup.
 *
 * The document supplies structure (headings, paragraphs, lists); the styling
 * lives here so a plain HTML file still matches the rest of the app.
 */
export function LegalDocument({ html }: { html: string }) {
  return (
    <div
      className="text-muted-foreground [&_address]:text-foreground [&_h2]:text-foreground space-y-3 [&_a]:underline [&_address]:not-italic [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:mb-1 [&_ul]:list-disc [&_ul]:pl-5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Shown when this deployment supplied no such document. */
export function LegalDocumentMissing() {
  return <p className="text-muted-foreground">{de.legal.documents.missing}</p>;
}
