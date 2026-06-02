import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal/legal";
import { de } from "@/messages/de";

export const metadata = { title: de.legal.info.title };

export default function InfoPage() {
  const t = de.legal.info;
  const op = de.legal.operator;

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
        <p>
          {t.contact}{" "}
          <a className="hover:text-foreground underline" href={`mailto:${op.email}`}>
            {op.email}
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
