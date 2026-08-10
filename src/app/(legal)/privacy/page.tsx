import { LegalPage } from "@/components/legal/legal";
import { LegalDocument, LegalDocumentMissing } from "@/components/legal/legal-document";
import { readLegalDocument } from "@/lib/legal/documents";
import { de } from "@/messages/de";

export const metadata = { title: de.legal.documents.privacyTitle };

// See imprint/page.tsx: read from disk per request, so never prerendered.
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const html = await readLegalDocument("privacy");

  return (
    <LegalPage title={de.legal.documents.privacyTitle}>
      {html ? <LegalDocument html={html} /> : <LegalDocumentMissing />}
    </LegalPage>
  );
}
