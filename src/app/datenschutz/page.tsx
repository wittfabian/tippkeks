import Link from "next/link";

export const metadata = { title: "Datenschutzerklärung" };

/**
 * DSGVO baseline. PLACEHOLDER content — review and complete the operator details
 * (Verantwortlicher, Kontakt) and confirm the sub-processor list before launch.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-8 text-sm leading-relaxed">
      <h1 className="text-xl font-semibold">Datenschutzerklärung</h1>

      <p>
        Diese Anwendung ist ein privates Tippspiel für eine geschlossene Gruppe. Wir verarbeiten nur
        die Daten, die für den Betrieb des Tippspiels erforderlich sind.
      </p>

      <section className="space-y-1">
        <h2 className="font-medium">Verantwortlicher</h2>
        <p className="text-muted-foreground">
          [Name und Kontaktdaten des Betreibers hier ergänzen.]
        </p>
      </section>

      <section className="space-y-1">
        <h2 className="font-medium">Welche Daten wir verarbeiten</h2>
        <ul className="list-inside list-disc">
          <li>E-Mail-Adresse und Passwort (verschlüsselt) für die Anmeldung</li>
          <li>Anzeigename</li>
          <li>Deine Tipps und die daraus berechneten Punkte</li>
          <li>Technische Protokolldaten (z. B. zur Fehlersuche)</li>
        </ul>
      </section>

      <section className="space-y-1">
        <h2 className="font-medium">Rechtsgrundlage</h2>
        <p>
          Die Verarbeitung erfolgt zur Erfüllung des Nutzungsverhältnisses (Art. 6 Abs. 1 lit. b
          DSGVO) sowie auf Basis berechtigter Interessen am Betrieb des Spiels (Art. 6 Abs. 1 lit. f
          DSGVO). Es werden ausschließlich technisch notwendige Cookies verwendet.
        </p>
      </section>

      <section className="space-y-1">
        <h2 className="font-medium">Auftragsverarbeiter</h2>
        <ul className="list-inside list-disc">
          <li>Supabase (Datenbank &amp; Authentifizierung, EU-Hosting)</li>
          <li>football-data.org (Spielpläne und Ergebnisse)</li>
          <li>E-Mail-Versanddienst (Anmelde- und Bestätigungs-E-Mails)</li>
        </ul>
      </section>

      <section className="space-y-1">
        <h2 className="font-medium">Deine Rechte</h2>
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung und Datenübertragbarkeit. Wende
          dich dazu an den oben genannten Verantwortlichen.
        </p>
      </section>

      <Link
        href="/login"
        className="text-muted-foreground hover:text-foreground inline-block underline"
      >
        Zurück zur Anmeldung
      </Link>
    </main>
  );
}
