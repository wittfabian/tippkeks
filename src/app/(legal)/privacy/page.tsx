import { LegalPage, LegalSection } from "@/components/legal/legal";
import { de } from "@/messages/de";

export const metadata = { title: de.legal.privacy.title };

export default function PrivacyPage() {
  const t = de.legal.privacy;
  const op = de.legal.operator;

  return (
    <LegalPage title={t.title} updated={de.legal.lastUpdated}>
      <p className="text-muted-foreground">{t.intro}</p>

      <LegalSection heading={t.controllerHeading}>
        <address className="text-foreground not-italic">
          {op.name}
          <br />
          {op.street}
          <br />
          {op.city}
          <br />
          {op.country}
        </address>
        <p>
          {op.emailLabel}:{" "}
          <a className="hover:text-foreground underline" href={`mailto:${op.email}`}>
            {op.email}
          </a>
        </p>
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
