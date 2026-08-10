import { LegalPage, LegalSection } from "@/components/legal/legal";
import { OperatorAddress, OperatorEmail, OperatorMissing } from "@/components/legal/operator";
import { getOperator } from "@/lib/legal/operator";
import { de } from "@/messages/de";

export const metadata = { title: de.legal.impressum.title };

// The operator details are runtime env, so this page must not be prerendered:
// a static build would freeze one deployment's address into the container image.
export const dynamic = "force-dynamic";

export default function ImpressumPage() {
  const t = de.legal.impressum;
  const operator = getOperator();

  return (
    <LegalPage title={t.title}>
      {operator ? (
        <>
          <LegalSection heading={t.providerHeading}>
            <OperatorAddress operator={operator} />
          </LegalSection>

          <LegalSection heading={t.contactHeading}>
            <OperatorEmail operator={operator} />
          </LegalSection>

          <LegalSection heading={t.responsibleHeading}>
            <OperatorAddress operator={operator} showCountry={false} />
          </LegalSection>
        </>
      ) : (
        <LegalSection heading={t.providerHeading}>
          <OperatorMissing />
        </LegalSection>
      )}

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
