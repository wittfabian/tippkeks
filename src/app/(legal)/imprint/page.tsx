import { LegalPage, LegalSection } from "@/components/legal/legal";
import { de } from "@/messages/de";

export const metadata = { title: de.legal.impressum.title };

export default function ImpressumPage() {
  const t = de.legal.impressum;
  const op = de.legal.operator;

  return (
    <LegalPage title={t.title}>
      <LegalSection heading={t.providerHeading}>
        <address className="text-foreground not-italic">
          {op.name}
          <br />
          {op.street}
          <br />
          {op.city}
          <br />
          {op.country}
        </address>
      </LegalSection>

      <LegalSection heading={t.contactHeading}>
        <p>
          {op.emailLabel}:{" "}
          <a className="hover:text-foreground underline" href={`mailto:${op.email}`}>
            {op.email}
          </a>
        </p>
      </LegalSection>

      <LegalSection heading={t.responsibleHeading}>
        <address className="text-foreground not-italic">
          {op.name}
          <br />
          {op.street}
          <br />
          {op.city}
        </address>
      </LegalSection>

      <LegalSection heading={t.natureHeading}>
        <p>{t.nature}</p>
      </LegalSection>

      <LegalSection heading={t.liabilityContentHeading}>
        <p>{t.liabilityContent}</p>
      </LegalSection>

      <LegalSection heading={t.liabilityLinksHeading}>
        <p>{t.liabilityLinks}</p>
      </LegalSection>

      <LegalSection heading={t.copyrightHeading}>
        <p>{t.copyright}</p>
      </LegalSection>

      <LegalSection heading={t.disputeHeading}>
        <p>{t.dispute}</p>
      </LegalSection>
    </LegalPage>
  );
}
