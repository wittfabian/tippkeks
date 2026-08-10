import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal/legal";
import { serverEnv } from "@/lib/env.server";
import { de } from "@/messages/de";

export const metadata = { title: de.legal.info.title };

// The contact address is runtime env, so this page must not be prerendered.
export const dynamic = "force-dynamic";

export default function InfoPage() {
  const t = de.legal.info;
  const email = serverEnv.OPERATOR_EMAIL;

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
        {email ? (
          <p>
            {t.contact}{" "}
            <a className="hover:text-foreground underline" href={`mailto:${email}`}>
              {email}
            </a>
          </p>
        ) : (
          <p>{de.legal.operator.missing}</p>
        )}
      </LegalSection>
    </LegalPage>
  );
}
