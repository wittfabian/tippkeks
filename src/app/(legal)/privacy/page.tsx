import { LegalPage, LegalSection } from "@/components/legal/legal";
import { OperatorAddress, OperatorEmail, OperatorMissing } from "@/components/legal/operator";
import { getOperator } from "@/lib/legal/operator";
import { de } from "@/messages/de";

export const metadata = { title: de.legal.privacy.title };

// See imprint/page.tsx: the controller is runtime env, so no prerendering.
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const t = de.legal.privacy;
  const operator = getOperator();

  return (
    <LegalPage title={t.title} updated={de.legal.lastUpdated}>
      <p className="text-muted-foreground">{t.intro}</p>

      <LegalSection heading={t.controllerHeading}>
        {operator ? (
          <>
            <OperatorAddress operator={operator} />
            <OperatorEmail operator={operator} />
          </>
        ) : (
          <OperatorMissing />
        )}
      </LegalSection>

      <LegalSection heading={t.dataHeading}>
        <p>
          <span className="text-foreground font-medium">{t.dataAccountHeading}:</span>{" "}
          {t.dataAccount}
        </p>
        <p>
          <span className="text-foreground font-medium">{t.dataGameHeading}:</span> {t.dataGame}
        </p>
        <p>
          <span className="text-foreground font-medium">{t.dataLogHeading}:</span> {t.dataLog}
        </p>
        <p>
          <span className="text-foreground font-medium">{t.dataCookiesHeading}:</span>{" "}
          {t.dataCookies}
        </p>
      </LegalSection>

      <LegalSection heading={t.purposeHeading}>
        <ul className="list-disc space-y-1 pl-5">
          {t.purposeItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection heading={t.hostingHeading}>
        <p>{t.hosting}</p>
      </LegalSection>

      <LegalSection heading={t.recipientsHeading}>
        <p>{t.recipientsSupabase}</p>
        <p>{t.recipientsEmail}</p>
      </LegalSection>

      <LegalSection heading={t.gameDataHeading}>
        <p>{t.gameData}</p>
      </LegalSection>

      <LegalSection heading={t.retentionHeading}>
        <p>{t.retention}</p>
      </LegalSection>

      <LegalSection heading={t.rightsHeading}>
        <p>{t.rights}</p>
      </LegalSection>

      <LegalSection heading={t.accountDeletionHeading}>
        <p>{t.accountDeletion}</p>
      </LegalSection>

      <LegalSection heading={t.complaintHeading}>
        <p>{t.complaint}</p>
      </LegalSection>

      <LegalSection heading={t.automatedHeading}>
        <p>{t.automated}</p>
      </LegalSection>

      <LegalSection heading={t.changesHeading}>
        <p>{t.changes}</p>
      </LegalSection>
    </LegalPage>
  );
}
