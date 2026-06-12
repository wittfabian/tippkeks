/**
 * All user-facing German UI text lives here — the single language boundary.
 * Components and actions must never inline German string literals; import from
 * this dictionary instead so the German surface stays auditable in one place.
 */
export const de = {
  app: {
    name: "TippKeks",
    tagline: "Tippen, mitfiebern, Kekse kassieren – WM 2026",
    description: "TippKeks – privates Fußball-Tippspiel für Freundesgruppen zur WM 2026.",
  },
  errors: {
    // 404 – route not found.
    notFoundTitle: "404 – Daneben getippt",
    notFoundHeading: "Diese Seite steht im Abseits",
    notFoundBody:
      "Die Seite, die du suchst, gibt es hier nicht. Wahrscheinlich ist sie in der Halbzeitpause kurz Kekse holen – oder du hast dich bei der Adresse vertippt. Passiert den Besten.",
    notFoundHome: "Zurück zum Anstoß",
    // error.tsx – a route segment threw at runtime.
    errorTitle: "Eigentor!",
    errorHeading: "Da ist uns ein Krümel ins Getriebe gefallen",
    errorBody:
      "Irgendetwas ist schiefgelaufen – unser Server hat die Flanke nicht verwertet. Kein Drama: einmal kurz neu anstoßen, dann läuft das Spiel meistens wieder.",
    errorRetry: "Nochmal anstoßen",
    errorHome: "Zur Übersicht",
    errorDigest: (digest: string) => `Fehlercode für die Technik-Bank: ${digest}`,
    // global-error.tsx – the root layout itself crashed.
    globalTitle: "Totalausfall",
    globalHeading: "Der Schiri hat das Spiel abgepfiffen",
    globalBody:
      "Hier ist so gründlich etwas schiefgelaufen, dass selbst der VAR nur ratlos mit den Schultern zuckt. Lade die Seite neu – wir schicken frische Kekse aufs Feld.",
    globalRetry: "Seite neu laden",
  },
  landing: {
    eyebrow: "Privates Tippspiel · FIFA WM 2026",
    headlineLead: "Tippen. Mitfiebern.",
    headlineAccent: "Kekse kassieren.",
    subline:
      "Sag die Ergebnisse voraus, kassier Punkte für jeden Treffer und kämpf dich mit deiner Crew an die Spitze der Rangliste.",
    ctaPrimary: "Jetzt anmelden",
    ctaSecondary: "Konto erstellen",
    kickoffIn: "Anpfiff in",
    live: "Das Turnier läuft – jetzt live mittippen!",
    units: { days: "Tage", hours: "Std", minutes: "Min", seconds: "Sek" },
    stats: { teamsLabel: "Nationen", matchesLabel: "Spiele", winnerLabel: "Sieger pro Gruppe" },
    scoreTags: { exact: "Exakt", tendency: "Tendenz" },
  },
  dashboard: {
    nextDue: "Als Nächstes fällig",
    tipNow: "Jetzt tippen",
    upcoming: "Nächste Spiele",
    closesToday: (n: number) => (n === 1 ? "1 Tipp schließt heute" : `${n} Tipps schließen heute`),
    allDone: "Für heute durch ✓ – alle offenen Tipps abgegeben.",
    groupPace: (n: number) =>
      n === 1
        ? "Heute ist in der Gruppe noch 1 Tipp offen"
        : `Heute sind in der Gruppe noch ${n} Tipps offen`,
    recapTitle: (n: number) => `Spieltag ${n} – Rückblick`,
    recapWinner: (name: string, points: number) => `Tagessieger: ${name} (${points} Pkt.)`,
    recapNobody: "An diesem Spieltag gab es keine Punkte.",
    recapExacts: (n: number) =>
      n === 1 ? "1 Volltreffer in der Gruppe 🎯" : `${n} Volltreffer in der Gruppe 🎯`,
  },
  nav: {
    dashboard: "Übersicht",
    fixtures: "Spiele",
    leaderboard: "Rangliste",
    profile: "Profil",
    admin: "Verwaltung",
    signOut: "Abmelden",
    toggleTheme: "Hell/Dunkel umschalten",
  },
  auth: {
    loginTitle: "Anmelden",
    registerTitle: "Konto erstellen",
    email: "E-Mail",
    password: "Passwort",
    displayName: "Anzeigename",
    signIn: "Anmelden",
    signUp: "Registrieren",
    toRegister: "Noch kein Konto? Jetzt registrieren",
    toLogin: "Bereits ein Konto? Zur Anmeldung",
    signOut: "Abmelden",
    errorInvalid: "E-Mail oder Passwort ist falsch.",
    errorGeneric: "Anmeldung fehlgeschlagen. Bitte versuche es erneut.",
    tooManyRequests: "Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.",
    errorTaken: "Diese E-Mail ist bereits registriert.",
    passwordHint: "Mindestens 8 Zeichen.",
    checkEmail: "Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben.",
    resendConfirmation: "Bestätigungs-Mail erneut senden",
    confirmationResent: "Wir haben dir die Bestätigungs-Mail erneut geschickt.",
    registrationClosed: "Die Registrierung ist derzeit geschlossen.",
    forgotPassword: "Passwort vergessen?",
    resetTitle: "Passwort zurücksetzen",
    resetIntro:
      "Gib deine E-Mail-Adresse ein – wir senden dir einen Link, mit dem du ein neues Passwort vergeben kannst.",
    resetSubmit: "Link senden",
    resetSent:
      "Wenn ein Konto mit dieser E-Mail existiert, haben wir dir einen Link zum Zurücksetzen geschickt. Sieh in deinem Postfach nach.",
    backToLogin: "Zur Anmeldung",
    newPasswordTitle: "Neues Passwort",
    newPasswordIntro: "Vergib jetzt ein neues Passwort für dein Konto.",
    newPasswordMfaIntro:
      "Dein Konto ist mit Zwei-Faktor-Authentifizierung geschützt. Gib dein neues Passwort noch einmal ein und bestätige mit dem Code aus deiner Authenticator-App.",
    newPassword: "Neues Passwort",
    newPasswordSubmit: "Passwort speichern",
    newPasswordSaved: "Passwort aktualisiert.",
    newPasswordContinue: "Weiter zu TippKeks",
    newPasswordError:
      "Passwort konnte nicht gespeichert werden. Fordere bei Bedarf einen neuen Link an.",
    newPasswordNoSession: "Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
    requestNewLink: "Neuen Link anfordern",
    mfaTitle: "Bestätigung in zwei Schritten",
    mfaPrompt: "Gib den 6-stelligen Code aus deiner Authenticator-App ein.",
    mfaCodeLabel: "6-stelliger Code",
    mfaSubmit: "Bestätigen",
    mfaCancel: "Abbrechen und abmelden",
    mfaError: "Das hat nicht geklappt. Bitte lade die Seite neu.",
    mfaCodeError: "Der Code ist ungültig oder abgelaufen. Bitte versuche es erneut.",
  },
  groups: {
    title: "Meine Gruppen",
    none: "Du bist noch in keiner Gruppe.",
    createTitle: "Neue Gruppe",
    joinTitle: "Mit Einladungscode beitreten",
    name: "Gruppenname",
    code: "Einladungscode",
    createSubmit: "Gruppe anlegen",
    joinSubmit: "Beitreten",
    role: { admin: "Admin", member: "Mitglied" },
    createError: "Gruppe konnte nicht erstellt werden. Bitte versuche es erneut.",
    createDisabled: "Das Erstellen neuer Gruppen ist derzeit deaktiviert.",
    joinError: "Beitritt fehlgeschlagen. Prüfe den Einladungscode.",
  },
  invite: {
    welcomeTitle: "Du bist eingeladen 🎉",
    welcomeBody:
      "Jemand holt dich in sein WM-Tippspiel auf TippKeks. Erstelle ein Konto oder melde dich an – danach bist du sofort in der Gruppe.",
    createAccount: "Konto erstellen & beitreten",
    haveAccount: "Ich habe schon ein Konto",
    confirmTitle: "Gruppe beitreten",
    confirmBody: "Du bist angemeldet. Tritt der Gruppe mit einem Klick bei.",
    accept: "Jetzt beitreten",
    invalidBody:
      "Dieser Einladungslink ist ungültig, abgelaufen oder schon aufgebraucht. Bitte die Person, die dich eingeladen hat, um einen neuen Link.",
    // Admin sharing
    shareHint: "Teile den Link – ein Klick und ein Konto genügen zum Beitreten.",
    copy: "Link kopieren",
    copied: "Kopiert!",
    whatsapp: "WhatsApp",
    share: "Teilen",
    shareMessage: "Komm in unser WM-Tippspiel auf TippKeks! Tritt hier bei:",
  },
  fixtures: {
    title: "Spiele",
    yourTip: "Dein Tipp",
    result: "Ergebnis",
    points: "Punkte",
    save: "Tipp speichern",
    saved: "Tipp gespeichert.",
    quick: "Schnell:",
    locked: "Tipp-Schluss (Anpfiff erreicht)",
    open: "Tippen bis Anpfiff",
    kickoffLabel: "Anpfiff",
    closesIn: "schließt in",
    advancingTeam: "Weiterkommendes Team",
    tippingDisabled: "Tippen ist für diese Gruppe deaktiviert – nur Ansicht.",
    tippingDisabledShort: "Nur Ansicht – Tippen ist deaktiviert.",
    noAdvancing: "Noch offen",
    delayedNote: "Ergebnisse können einige Minuten verzögert sein.",
    viewAll: "Alle Tipps ansehen",
    pointsPreview: (n: number) => `Dafür gäbe es ${n} Punkte`,
    saveError: "Tipp konnte nicht gespeichert werden – evtl. ist der Anpfiff schon vorbei.",
    // Result-label abbreviations: nach Verlängerung / im Elfmeterschießen.
    afterExtraTime: "n.V.",
    penaltiesShort: "i.E.",
    // Tip-deadline countdown when more than a day remains, e.g. "3 T 5 Std".
    lockCountdown: (days: number, hours: number) => `${days} T ${hours} Std`,
  },
  predictions: {
    allTitle: "Alle Tipps",
    member: "Mitglied",
    tip: "Tipp",
    notVisibleYet: "Tipps werden erst nach Anpfiff sichtbar.",
    noPredictions: "Für dieses Spiel wurden noch keine Tipps abgegeben.",
    consensus: "Häufigster Tipp",
    submittedCount: (n: number, total: number) => `${n} von ${total} haben getippt`,
    pulse: (n: number, total: number) => `${n}/${total} getippt`,
    pulseTitle: (n: number, total: number) => `${n} von ${total} Mitgliedern haben getippt`,
    liveProjection: "Zwischenstand",
    liveProjectionNote: "Vorläufige Punkte beim aktuellen Spielstand – ändern sich mit jedem Tor.",
    exactHitToast: (points: number) => `🎯 Exakt! +${points} Punkte`,
  },
  categories: {
    exact: "Exakt",
    goal_diff: "Tordifferenz",
    tendency: "Tendenz",
    miss: "Daneben",
  },
  status: {
    live: "LIVE",
    finished: "Beendet",
    postponed: "Verlegt",
    cancelled: "Abgesagt",
  },
  filters: {
    all: "Alle",
    open: "Offen",
    live: "Live",
    finished: "Beendet",
    stageAll: "Alle Runden",
    nationAll: "Alle Teams",
    reset: "Filter zurücksetzen",
    noResults: "Keine Spiele für diese Auswahl.",
    openCount: (n: number) => `${n} offen`,
  },
  leaderboard: {
    title: "Rangliste",
    rank: "Platz",
    member: "Mitglied",
    points: "Punkte",
    exact: "Exakt",
    hits: "Treffer",
    you: "Du",
    empty: "Die Rangliste erscheint nach den ersten gewerteten Spielen.",
    tieBreakNote:
      "Bei Punktgleichheit entscheiden: exakte Tipps, dann richtige Treffer, dann früheste Tippabgabe.",
    liveHeading: (n: number) => (n === 1 ? "Spiel läuft gerade" : "Spiele laufen gerade"),
    liveHint: "Die Wertung folgt nach Abpfiff – die Rangliste aktualisiert sich dann automatisch.",
    formHit: "Treffer",
    formMiss: "Daneben",
    streakTitle: (n: number) => `${n} Spiele in Folge getroffen`,
    duelsTitle: "Deine Duelle",
    duelsHint: "Direkter Vergleich pro Spiel, das ihr beide getippt habt.",
    duelTitle: (wins: number, losses: number, draws: number) =>
      `${wins} vorn, ${losses} hinten, ${draws} gleichauf`,
  },
  share: {
    matchDownload: "Als Bild herunterladen",
    leaderboardDownload: "Rangliste als Bild",
    busy: "Bild wird erstellt …",
    error: "Bild konnte nicht erstellt werden. Bitte erneut versuchen.",
    footer: "tippkeks.de · FIFA WM 2026",
    leaderboardSubtitle: "Rangliste",
    matchPoints: (n: number) => (n === 1 ? "1 Pkt." : `${n} Pkt.`),
  },
  profile: {
    title: "Profil",
    displayNameTitle: "Anzeigename",
    displayName: "Anzeigename",
    save: "Speichern",
    saved: "Profil aktualisiert.",
    error: "Profil konnte nicht gespeichert werden.",
    emailTitle: "E-Mail-Adresse",
    email: "E-Mail",
    emailSave: "E-Mail ändern",
    emailSaved:
      "Wir haben dir einen Bestätigungslink geschickt. Die Änderung wird erst nach dem Bestätigen wirksam.",
    emailError: "E-Mail konnte nicht geändert werden.",
    emailUnchanged: "Das ist bereits deine aktuelle E-Mail-Adresse.",
    passwordTitle: "Passwort",
    currentPassword: "Aktuelles Passwort",
    newPassword: "Neues Passwort",
    passwordSave: "Passwort ändern",
    passwordSaved: "Passwort aktualisiert.",
    passwordError: "Passwort konnte nicht geändert werden. Stimmt das aktuelle Passwort?",
    passwordHint: "Mindestens 8 Zeichen.",
    mfaTitle: "Zwei-Faktor-Authentifizierung",
    mfaIntro:
      "Schütze dein Konto zusätzlich mit einer Authenticator-App (z. B. Google Authenticator, Authy, 1Password). Beim Anmelden brauchst du dann zusätzlich einen 6-stelligen Code.",
    mfaEnable: "Zwei-Faktor aktivieren",
    mfaScanHint:
      "Scanne diesen QR-Code mit deiner Authenticator-App und gib anschließend den angezeigten 6-stelligen Code ein.",
    mfaQrAlt: "QR-Code für die Authenticator-App",
    mfaSecretHint: "Kannst du den Code nicht scannen, gib diesen Schlüssel manuell ein:",
    mfaCodeLabel: "6-stelliger Code",
    mfaConfirm: "Aktivieren",
    mfaEnabled: "Zwei-Faktor-Authentifizierung ist aktiv.",
    mfaActive: "Aktiv",
    mfaActiveHint: "Beim Anmelden wird ein Code aus deiner Authenticator-App verlangt.",
    mfaRemove: "Zwei-Faktor entfernen",
    mfaRemoved: "Zwei-Faktor-Authentifizierung wurde entfernt.",
    mfaError: "Das hat nicht geklappt. Bitte versuche es erneut.",
    mfaCodeError: "Der Code ist ungültig oder abgelaufen. Bitte versuche es erneut.",
    dangerTitle: "Konto löschen",
    dangerHint:
      "Dein Konto und alle deine Tipps werden dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.",
    deleteConfirmLabel: "Zum Bestätigen dein aktuelles Passwort eingeben",
    deleteSubmit: "Konto endgültig löschen",
    deleteError: "Konto konnte nicht gelöscht werden. Stimmt das aktuelle Passwort?",
    deleteSoleAdminError:
      "Du bist alleiniger Admin in mindestens einer Gruppe mit weiteren Mitgliedern. Bestimme dort zuerst einen anderen Admin.",
  },
  settings: {
    title: "App-Einstellungen",
    intro: "Diese Einstellungen gelten für die gesamte App, nicht nur für deine Gruppen.",
    registration: "Registrierung erlauben",
    registrationHint: "Wenn deaktiviert, können sich keine neuen Konten registrieren.",
    groupCreation: "Erstellen neuer Gruppen erlauben",
    groupCreationHint:
      "Wenn deaktiviert, können nur Site-Admins neue Gruppen anlegen. Beitreten per Einladung bleibt möglich.",
    save: "Einstellungen speichern",
    saved: "Einstellungen gespeichert.",
    error: "Einstellungen konnten nicht gespeichert werden.",
  },
  admin: {
    title: "Verwaltung",
    members: "Mitglieder",
    invites: "Einladungen",
    enterTips: "Tipps eintragen",
    scoring: "Punkteregeln",
    settingsTab: "Einstellungen",
    memberTipping: "Mitglieder dürfen selbst tippen",
    memberTippingHint:
      "Wenn deaktiviert, sehen Mitglieder alles, können aber nicht selbst tippen – nur Admins tragen dann Tipps ein.",
    memberTippingSaved: "Einstellung gespeichert.",
    tipsPickFixture: "Wähle ein Spiel, um Tipps für alle Mitglieder einzutragen.",
    tipsNoFixtures: "Noch keine Spiele vorhanden.",
    tipsCorrectionNote:
      "Dieses Spiel hat bereits begonnen. Als Admin kannst du die Tipps hier nachträglich korrigieren – Punkte und Tabelle werden danach automatisch neu berechnet.",
    tipsSave: "Tipps speichern",
    tipsSaved: (n: number) => (n === 1 ? "1 Tipp gespeichert." : `${n} Tipps gespeichert.`),
    tipsError: "Tipps konnten nicht gespeichert werden (evtl. ist der Anpfiff schon vorbei).",
    tipImageDownload: "Tipps als Bild herunterladen",
    tipImageHint:
      "Lädt die gespeicherten Tipps aller Mitglieder zu diesem Spiel als Bild herunter.",
    tipImageNoTip: "offen",
    createInvite: "Einladungscode erstellen",
    inviteCreated: "Einladungscode erstellt.",
    inviteDelete: "Löschen",
    inviteDeleted: "Einladung gelöscht.",
    inviteMaxUses: "Max. Verwendungen",
    inviteMaxUsesHint: "Leer lassen für unbegrenzt.",
    inviteAsAdmin: "Eingeladene werden Admins",
    inviteUnlimited: "unbegrenzt",
    inviteEmpty: "Noch keine Einladungen erstellt.",
    code: "Code",
    uses: "Verwendungen",
    role: "Rolle",
    makeAdmin: "Zum Admin machen",
    makeMember: "Zum Mitglied machen",
    remove: "Entfernen",
    lastAdminError: "Die Gruppe muss mindestens einen Admin behalten.",
    managedBadge: "verwaltet",
    managedCreateTitle: "Mitglied anlegen",
    managedCreateHint:
      "Lege ein Mitglied nur mit Namen an – ohne E-Mail. Du tippst dann für diese Person, sie kann sich nicht selbst anmelden. Später kannst du ihr einen echten Zugang einrichten.",
    managedNamePlaceholder: "Name des Mitglieds …",
    managedCreate: "Anlegen",
    managedCreated: (name: string) => `„${name}" wurde angelegt.`,
    managedCreateError: "Mitglied konnte nicht angelegt werden.",
    managedConvert: "Zugang einrichten",
    managedConvertTitle: "Echten Zugang einrichten",
    managedConvertHint:
      "Trage die E-Mail-Adresse der Person ein. Sie erhält eine E-Mail, mit der sie ein Passwort vergibt und ihre bisherigen Tipps übernimmt.",
    managedConvertEmailPlaceholder: "E-Mail-Adresse …",
    managedConvertSubmit: "Einladung senden",
    managedConverted: (email: string) => `Einladung an ${email} gesendet.`,
    managedConvertError: "Zugang konnte nicht eingerichtet werden.",
    managedConvertNotManaged: "Dieses Mitglied hat bereits einen eigenen Zugang.",
    managedConvertEmailTaken: "Diese E-Mail-Adresse wird bereits verwendet.",
    managedConvertMailFailed:
      "Adresse gespeichert, aber die Einladungs-E-Mail konnte nicht gesendet werden. Bitte später erneut versuchen.",
    managedMergeConfirm: (email: string) =>
      `Es gibt bereits ein Konto mit ${email} in dieser Gruppe. Sollen die für den Platzhalter eingetragenen Tipps in dieses Konto übernommen und der Platzhalter danach gelöscht werden? Bei Spielen, die das Konto schon selbst getippt hat, gewinnt der Platzhalter-Tipp. Das lässt sich nicht rückgängig machen.`,
    managedMergeSubmit: "Zusammenführen",
    managedMergeCancel: "Abbrechen",
    managedMergeNotMember:
      "Es gibt bereits ein Konto mit dieser E-Mail-Adresse, aber es ist noch nicht in dieser Gruppe. Lass die Person zuerst über einen Einladungslink beitreten – danach kannst du die Tipps zusammenführen.",
    managedMerged: (email: string) => `Tipps wurden in das Konto ${email} übernommen.`,
    memberSearch: "Mitglied suchen",
    memberSearchPlaceholder: "Name …",
    memberCount: (n: number) => (n === 1 ? "1 Mitglied" : `${n} Mitglieder`),
    noMembers: "Keine Mitglieder gefunden.",
    pagePrev: "Zurück",
    pageNext: "Weiter",
    pageInfo: (page: number, total: number) => `Seite ${page} von ${total}`,
    scoringExact: "Exaktes Ergebnis",
    scoringDiff: "Richtige Tordifferenz",
    scoringTendency: "Richtige Tendenz",
    scoringAdvance: "Weiterkommen (K.-o.)",
    scoringExactInfo:
      "Volle Punkte, wenn dein Tipp exakt stimmt – Tore von Heim und Gast genau richtig (z. B. Tipp 2:1, Ergebnis 2:1). Höchste Stufe; schließt Tordifferenz und Tendenz aus.",
    scoringDiffInfo:
      "Punkte, wenn die Tordifferenz stimmt, aber nicht das exakte Ergebnis – inklusive richtig getipptem Unentschieden (z. B. Tipp 2:1 bei Ergebnis 3:2, oder Tipp 1:1 bei 2:2).",
    scoringTendencyInfo:
      "Punkte, wenn nur der richtige Ausgang stimmt – Heimsieg, Auswärtssieg oder Unentschieden – ohne passende Tordifferenz (z. B. Tipp 3:0 bei Ergebnis 1:0).",
    scoringAdvanceInfo:
      "Zusätzlicher Bonus in der K.-o.-Phase, wenn du das weiterkommende Team richtig tippst. Die Ergebnis-Punkte zählen dort nach 90 Minuten, das Weiterkommen nach Verlängerung bzw. Elfmeterschießen.",
    scoringInfoAria: "Erklärung anzeigen",
    scoringSave: "Regeln speichern & neu berechnen",
    scoringSaved: "Punkteregeln gespeichert und Punkte neu berechnet.",
    homeGoals: "Tore Heim",
    awayGoals: "Tore Gast",
    deleteGroup: "Gruppe löschen",
    deleteGroupHint:
      "Die Gruppe wird mit allen Mitgliedschaften, Tipps und Punkten dauerhaft gelöscht. Das betrifft alle Mitglieder und kann nicht rückgängig gemacht werden.",
    deleteGroupConfirmLabel: "Zum Bestätigen den Gruppennamen eingeben",
    deleteGroupSubmit: "Gruppe endgültig löschen",
    deleteGroupNameMismatch: "Der eingegebene Name stimmt nicht mit dem Gruppennamen überein.",
    deleteGroupError: "Gruppe konnte nicht gelöscht werden. Bitte versuche es erneut.",
  },
  empty: {
    tournamentStarts: "Das Turnier startet am 11.06.2026.",
    noFixtures: "Es sind noch keine Spiele vorhanden.",
  },
  // Tournament stage display names (also written to stage.name during sync).
  stages: {
    group: "Gruppenphase",
    last_32: "Sechzehntelfinale",
    last_16: "Achtelfinale",
    quarter_final: "Viertelfinale",
    semi_final: "Halbfinale",
    third_place: "Spiel um Platz 3",
    final: "Finale",
    matchday: "Spieltag",
    other: "Sonstige",
  },
  legal: {
    backHome: "Zur Startseite",
    lastUpdated: "Stand: Juni 2026",
    footerNav: {
      info: "Über TippKeks",
      privacy: "Datenschutz",
      impressum: "Impressum",
    },
    operator: {
      name: "Fabian Witt",
      street: "Straße und Hausnummer",
      city: "PLZ Ort",
      country: "Deutschland",
      emailLabel: "E-Mail",
      email: "kontakt@tippkeks.de",
    },
    impressum: {
      title: "Impressum",
      providerHeading: "Angaben gemäß § 5 DDG",
      contactHeading: "Kontakt",
      responsibleHeading: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV",
      natureHeading: "Hinweis zum Angebot",
      nature:
        "TippKeks ist ein privates, nicht-kommerzielles Freizeitprojekt und richtet sich ausschließlich an einen geschlossenen Freundeskreis. Es wird kein Geldeinsatz erhoben und es werden keine Gewinne ausgespielt.",
      liabilityContentHeading: "Haftung für Inhalte",
      liabilityContent:
        "Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Wir sind jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.",
      liabilityLinksHeading: "Haftung für Links",
      liabilityLinks:
        "Unser Angebot kann Links zu externen Websites Dritter enthalten, auf deren Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte können wir keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.",
      copyrightHeading: "Urheberrecht",
      copyright:
        "Die durch den Betreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Spielpläne, Ergebnisse und damit verbundene Daten werden von football-data.org bezogen; die Rechte hieran liegen bei den jeweiligen Rechteinhabern.",
      disputeHeading: "Verbraucherstreitbeilegung",
      dispute:
        "Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
    },
    privacy: {
      title: "Datenschutzerklärung",
      intro:
        "Der Schutz deiner personenbezogenen Daten ist uns wichtig. Diese Erklärung informiert dich darüber, welche Daten wir im Rahmen von TippKeks verarbeiten, zu welchem Zweck und auf welcher Rechtsgrundlage. TippKeks ist ein privates, nicht-kommerzielles Tippspiel für einen geschlossenen Freundeskreis.",
      controllerHeading: "Verantwortlicher im Sinne der DSGVO",
      dataHeading: "Welche Daten wir verarbeiten",
      dataAccountHeading: "Konto-Daten",
      dataAccount:
        "E-Mail-Adresse, Passwort (ausschließlich verschlüsselt bzw. als Hash gespeichert) und dein Anzeigename. Diese Daten sind für Registrierung und Anmeldung erforderlich. Optional kannst du eine Zwei-Faktor-Authentifizierung (TOTP) aktivieren; dabei wird das zugehörige Geheimnis sicher bei unserem Authentifizierungs-Dienstleister gespeichert.",
      dataGameHeading: "Spiel-Daten",
      dataGame:
        "Deine abgegebenen Tipps, die daraus berechneten Punkte sowie deine Mitgliedschaft in Tippgruppen. Gruppen-Administratoren können zudem Mitglieder mit einem Anzeigenamen anlegen und für diese Tipps eintragen (etwa für Teilnehmende, die die App nicht selbst nutzen).",
      dataLogHeading: "Server-Logfiles",
      dataLog:
        "Beim Aufruf der Anwendung werden technisch notwendige Zugriffsdaten verarbeitet (z. B. gekürzte IP-Adresse, Datum und Uhrzeit des Zugriffs, abgerufene Ressource, Browsertyp). Sie dienen der Sicherstellung des technischen Betriebs und der Fehleranalyse. Zum Schutz vor missbräuchlichen Anmelde- und Passwort-Zurücksetzen-Versuchen begrenzen wir die Häufigkeit solcher Anfragen; hierfür wird die IP-Adresse kurzzeitig verarbeitet.",
      dataCookiesHeading: "Cookies",
      dataCookies:
        "TippKeks verwendet ausschließlich technisch notwendige Cookies, um deine Anmeldesitzung aufrechtzuerhalten. Es findet kein Tracking und keine Analyse deines Verhaltens statt; es werden keine Cookies zu Werbezwecken eingesetzt.",
      purposeHeading: "Zwecke und Rechtsgrundlagen",
      purposeItems: [
        "Bereitstellung des Tippspiels und Verwaltung deines Kontos: Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des Nutzungsverhältnisses).",
        "Technischer Betrieb, Sicherheit und Fehleranalyse: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am stabilen und sicheren Betrieb).",
      ],
      hostingHeading: "Hosting",
      hosting:
        "Die Anwendung wird bei der Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, betrieben. Die Server stehen in Deutschland. Mit Hetzner besteht ein Vertrag zur Auftragsverarbeitung gemäß Art. 28 DSGVO.",
      recipientsHeading: "Empfänger und Auftragsverarbeiter",
      recipientsSupabase:
        "Für Datenbank und Authentifizierung setzen wir den Dienst Supabase ein. Die personenbezogenen Daten werden in einem Rechenzentrum in Frankfurt am Main (Deutschland, EU) gespeichert. Es besteht ein Auftragsverarbeitungsvertrag; soweit eine Übermittlung in ein Drittland nicht ausgeschlossen werden kann (etwa durch den US-Mutterkonzern), erfolgt diese auf Grundlage geeigneter Garantien (insbesondere EU-Standardvertragsklauseln).",
      recipientsEmail:
        "Für den Versand von System-E-Mails (z. B. zur Bestätigung deiner E-Mail-Adresse, zum Zurücksetzen des Passworts oder zur Bestätigung einer E-Mail-Änderung) setzen wir den Dienst Resend (betrieben von Plus Five Five, Inc., 2261 Market Street #5039, San Francisco, CA 94114, USA) ein. Hierzu wird deine E-Mail-Adresse an den Dienst übermittelt; die Verarbeitung erfolgt über die EU-Infrastruktur des Anbieters (Rechenzentrum in der EU). Es besteht ein Auftragsverarbeitungsvertrag. Soweit eine Übermittlung in die USA nicht ausgeschlossen werden kann (etwa durch den US-Anbieter), stützt sich diese auf geeignete Garantien: Der Anbieter ist unter dem EU-US Data Privacy Framework zertifiziert; ergänzend gelten die EU-Standardvertragsklauseln gemäß Art. 46 DSGVO.",
      gameDataHeading: "Spieldaten von Dritten",
      gameData:
        "Spielpläne und Ergebnisse beziehen wir vom Dienst football-data.org. Dabei werden ausschließlich Sportdaten abgerufen — es werden keine personenbezogenen Daten unserer Nutzer an diesen Dienst übermittelt.",
      retentionHeading: "Speicherdauer",
      retention:
        "Wir speichern deine personenbezogenen Daten, solange dein Konto besteht bzw. solange dies für den Betrieb des Tippspiels erforderlich ist. Server-Logfiles werden nach kurzer Zeit automatisch gelöscht. Löschst du dein Konto, werden deine personenbezogenen Daten und deine Tipps gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.",
      rightsHeading: "Deine Rechte",
      rights:
        "Du hast jederzeit das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) sowie ein Widerspruchsrecht (Art. 21 DSGVO). Wende dich dazu an die oben genannten Kontaktdaten.",
      accountDeletionHeading: "Konto selbst löschen",
      accountDeletion:
        "Du kannst dein Konto jederzeit selbst über „Profil → Konto löschen“ dauerhaft entfernen.",
      complaintHeading: "Beschwerderecht",
      complaint:
        "Dir steht ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde zu. Für uns zuständig ist das Bayerische Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach.",
      automatedHeading: "Keine automatisierte Entscheidungsfindung",
      automated:
        "Eine automatisierte Entscheidungsfindung oder ein Profiling im Sinne des Art. 22 DSGVO findet nicht statt.",
      changesHeading: "Änderungen dieser Erklärung",
      changes:
        "Wir passen diese Datenschutzerklärung an, wenn sich die Anwendung oder die Rechtslage ändert. Es gilt die jeweils hier veröffentlichte Fassung.",
    },
    info: {
      title: "Über TippKeks",
      lead: "TippKeks ist ein privates Tippspiel für Freundesgruppen — pünktlich zur FIFA Fußball-Weltmeisterschaft 2026. Werbefrei, nicht-kommerziell und nur für deine Crew.",
      howHeading: "So funktioniert's",
      howSteps: [
        "Gründe eine Gruppe oder tritt per Einladungscode der Gruppe deiner Freunde bei.",
        "Tippe vor dem Anpfiff jedes Spiels dein Ergebnis.",
        "Sammle Punkte — je genauer dein Tipp, desto mehr.",
        "Miss dich in der Rangliste mit deiner Crew.",
      ],
      scoringHeading: "Punkte",
      scoring:
        "Es gibt Punkte für die exakte Vorhersage, die richtige Tordifferenz und die richtige Tendenz (den Sieger). In der K.-o.-Phase gibt es zusätzlich einen Bonus für das richtige weiterkommende Team.",
      fairnessHeading: "Fair für alle",
      fairness:
        "Tipps sind nur bis zum Anpfiff möglich und für andere erst nach Anpfiff sichtbar — so tippt jeder unbeeinflusst. Maßgeblich ist immer die Uhrzeit auf dem Server, nicht im Browser.",
      privacyHeading: "Datenschutz",
      privacy:
        "TippKeks ist werbefrei und verzichtet bewusst auf Tracking. Wir verarbeiten nur die Daten, die der Betrieb des Tippspiels erfordert.",
      privacyLink: "Details in der Datenschutzerklärung",
      contactHeading: "Kontakt",
      contact: "Fragen oder Feedback? Schreib uns:",
    },
  },
  pwa: {
    // Short label for the home-screen icon (manifest short_name) — keep it short.
    shortName: "TippKeks",
    // Install affordance on the profile page.
    sectionTitle: "App installieren",
    description:
      "Leg dir TippKeks auf den Startbildschirm und nutze es wie eine App – im Vollbild, mit eigenem Icon und ganz ohne App Store.",
    installButton: "App installieren",
    // Shown when the app is already running as an installed PWA (standalone).
    installed: "TippKeks ist als App installiert. Viel Spaß beim Tippen!",
    // iOS/iPadOS has no install prompt — guide the user through Safari's menu.
    iosTitle: "Auf dem iPhone oder iPad installieren",
    iosSteps: [
      "Tippe in Safari unten (oder oben) auf das Teilen-Symbol.",
      "Wähle „Zum Home-Bildschirm“.",
      "Bestätige mit „Hinzufügen“ – fertig.",
    ],
    // Offline fallback page (public/offline.html, generated from these strings).
    offlineTitle: "Keine Verbindung",
    offlineBody:
      "TippKeks braucht eine Internetverbindung. Sobald du wieder online bist, geht's weiter.",
    offlineRetry: "Erneut versuchen",
    // Push-notification toggle on the profile page (next to the install button).
    notifyTitle: "Benachrichtigungen",
    notifyDescription:
      "Lass dich erinnern, wenn ein Spiel bald angepfiffen wird und du noch nicht getippt hast – und erfahre direkt das Ergebnis samt deiner Punkte.",
    notifyEnable: "Benachrichtigungen aktivieren",
    notifyDisable: "Benachrichtigungen ausschalten",
    notifyEnabled: "Benachrichtigungen sind aktiv.",
    notifyDeviceHint: "Gilt nur für dieses Gerät – aktiviere es auf jedem Gerät separat.",
    notifyTest: "Testbenachrichtigung senden",
    notifyTestSent: "Gesendet! Schau auf deine Benachrichtigungen.",
    notifyTestFailed: "Konnte keine Testbenachrichtigung senden.",
    notifyBlocked:
      "Benachrichtigungen sind im Browser blockiert. Erlaube sie in den Einstellungen deines Geräts für TippKeks.",
    notifyUnsupported: "Dieses Gerät unterstützt keine Push-Benachrichtigungen.",
    // iOS only delivers push to a PWA added to the home screen (iOS 16.4+).
    notifyIosHint:
      "Auf iPhone/iPad nur möglich, wenn TippKeks zum Home-Bildschirm hinzugefügt wurde (iOS 16.4 oder neuer).",
    notifyError: "Das hat nicht geklappt. Bitte versuche es erneut.",
  },
  // Web Push payloads (built server-side in the notification dispatcher). Kept
  // here so every German string stays on the language boundary. No other
  // player's tip ever appears here — only the recipient's own reminder/result.
  notifications: {
    reminderTitle: "Noch nicht getippt! ⏰",
    reminderBody: (home: string, away: string) =>
      `${home} – ${away} wird bald angepfiffen. Gib schnell noch deinen Tipp ab!`,
    resultTitle: (home: string, away: string, homeGoals: number, awayGoals: number) =>
      `${home} ${homeGoals}:${awayGoals} ${away}`,
    // Result body varies by how well the tip did.
    resultBody: (category: "exact" | "goal_diff" | "tendency" | "miss", points: number) => {
      if (category === "exact") return `🎯 Volltreffer! Du holst ${points} Punkte.`;
      if (category === "miss") return "Diesmal leider daneben – 0 Punkte.";
      const label = category === "goal_diff" ? "Tordifferenz" : "Tendenz";
      return `${label} getroffen – ${points} Punkte für dich.`;
    },
    testTitle: "TippKeks Test 🔔",
    testBody: "Geschafft! So sehen deine Benachrichtigungen aus.",
  },
  common: {
    cancel: "Abbrechen",
    back: "Zurück",
    loading: "Lädt …",
    save: "Speichern",
    poweredBy: "Daten von football-data.org",
    // German clock suffix appended to a formatted time, e.g. "21:00 Uhr".
    clock: "Uhr",
  },
} as const;

export type Messages = typeof de;
