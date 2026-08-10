import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal/legal";
import { OperatorMissing } from "@/components/legal/operator";
import { getOperator } from "@/lib/legal/operator";
import { de } from "@/messages/de";

export const metadata = { title: de.legal.info.title };

// See imprint/page.tsx: the contact address is runtime env, so no prerendering.
export const dynamic = "force-dynamic";

export default function InfoPage() {
  const t = de.legal.info;
  const operator = getOperator();

  return (
    <LegalPage title={t.title}>
      <p className="text-muted-foreground">{t.lead}</p>

      <LegalSection heading={t.howHeading}>
        <ol className="list-decimal space-y-1 pl-5">
          {t.howSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </LegalSection>

      <LegalSection heading={t.scoringHeading}>
        <p>{t.scoring}</p>
      </LegalSection>

      <LegalSection heading={t.fairnessHeading}>
        <p>{t.fairness}</p>
      </LegalSection>

      <LegalSection heading={t.privacyHeading}>
        <p>{t.privacy}</p>
        <p>
          <Link href="/privacy" className="hover:text-foreground underline">
            {t.privacyLink}
          </Link>
        </p>
      </LegalSection>

      <LegalSection heading={t.contactHeading}>
        {operator ? (
          <p>
            {t.contact}{" "}
            <a className="hover:text-foreground underline" href={`mailto:${operator.email}`}>
              {operator.email}
            </a>
          </p>
        ) : (
          <OperatorMissing />
        )}
      </LegalSection>
    </LegalPage>
  );
}
