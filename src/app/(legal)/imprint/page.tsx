import { LegalPage } from "@/components/legal/legal";
import { LegalDocument, LegalDocumentMissing } from "@/components/legal/legal-document";
import { readLegalDocument } from "@/lib/legal/documents";
import { de } from "@/messages/de";

export const metadata = { title: de.legal.documents.impressumTitle };

// The document is read from disk per request, so this page must not be
// prerendered — see src/lib/legal/documents.ts.
export const dynamic = "force-dynamic";

export default async function ImpressumPage() {
  const html = await readLegalDocument("imprint");

  return (
    <LegalPage title={de.legal.documents.impressumTitle}>
      {html ? <LegalDocument html={html} /> : <LegalDocumentMissing />}
    </LegalPage>
  );
}
