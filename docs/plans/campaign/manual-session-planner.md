# Spielabendpläne: bearbeiten, ersetzen und kopieren

Stand: 15.10.2026. Umfang: [SCOPE](../../SCOPE.md), [#69](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/69)
und [Quellenregister](../../scope-sources.json). Manuelle Planung benötigt weder
Planungsparty noch Generator; Generierung und Übernahme ins Live-Spiel sind
zusätzliche Abläufe.

Bindende Generierungsvorgaben: [Iststand, Quellenprüfung und nächste Schritte](generation-constraints.md).

## Aktueller Anschluss

Die Desktopvorbereitung speichert Pläne, geordnete Besuche, exakte Notizen und
optionale Ortsverweise im gemeinsamen SQLite-Store. `session-ui.ts`,
`storage/session.ts` und `storage/plan-replacement.ts` ergänzen Besuchsinhalte,
Gruppen, Belohnungen sowie Ersetzung und Wiederverwendung. Die reinen
`ManualPlan`-Codecs prüfen den gemeinsamen Planvertrag.

Gespeicherte Begegnungen werden erst ab zwei Suchzeichen über den vorhandenen
Katalogzugang gelesen. SQL begrenzt auf neun Metadatensätze: acht auswählbare
Treffer plus Überlaufhinweis. Neue Eingaben, Besuchs-/Planwechsel und neuere
Antworten entziehen alten Treffern die Freigabe. Dieselbe Besuchsauswahl behält
beim Speichern den Suchtext und liest passende Treffer erneut. Angehängte Gruppen
behalten ihren eigenen konkreten Begegnungsstand. Session-Lesungen und neue
Schreibbelege enthalten keine globale Begegnungsliste mehr; historische Belege
bleiben unverändert lesbar und wiederholbar.

Der Live-Besuchsbinder zeigt übernommene Besuche seitenweise mit festgehaltenen
Texten, Ergebnissen und Weltverweisen. Planänderungen ersetzen diese Übernahmen
nicht; ältere Übernahmen ohne vollständige Bindung werden als solche markiert.
Seitenwechsel und Suche entfernen alte Aktionen sofort; Antworten und Übergaben
bleiben an die ursprüngliche Campaign, Gruppe und Besuchsauswahl gebunden.
Datenbank-Reopen und unabhängige Kopie sind geprüft; die native Bedienprobe
bleibt offen.

Eine bestätigte Spielabendübergabe kann einen neuen Einstieg atomar in Plan und
Mappe speichern. Wahlweise bleibt der neue Besuch im Editor geöffnet oder seine
GM-Mappe öffnet sich sofort auf genau diesem Besuch. Eine während der Antwort
veränderte Auswahl öffnet keine Mappe aus einem älteren Auftrag.

## Daten- und Bedienvertrag

- Pläne behalten ihre Identität und monotone Revision. Neue oder kopierte
  Besuche bekommen eigene kampagnenlokale IDs; gleiche Orte verbinden keine
  Besuchsidentitäten. Unbenannte Pläne und ortlose Besuche sind gültig.
- Eingaben bleiben an Campaign, Plan, Besuch und ursprüngliche Revision
  gebunden. Aktualisieren übernimmt keine offene Eingabe. Veraltete Antworten
  dürfen fremde Texte, Auswahl oder einen neueren Stand nicht verändern.
- Ein leerer XP-Pool einer manuellen Belohnung bleibt eine offene Eingabe.
  Speichern und Verlassen warten auf eine Zahl oder das Entfernen der Belohnung;
  ausdrücklich eingegebene `0` ist gültig und wird nicht aus Leere abgeleitet.
- Beutezeilen behalten ihre Eingabeknoten beim Ergänzen, Entfernen und nach
  bestätigtem Speichern. Unfertige Mengen bleiben offen; nur positive ganze
  Mengen geben den Schreibauftrag frei. Zeilenbefehle greifen auf den aktuellen
  Besuch zu; entfernte Controls ändern keine neue Belohnung. Erneutes Anlegen
  nach Entfernen zeigt leere Beute und den neuen XP-Wert.
- Ersetzen prüft Ziel- und Vorlagenbasis gemeinsam in einer Transaktion.
  Reihenfolge, Ortsverweise, Prosa und Wissensbezüge werden übernommen;
  „Timeline leeren“ entfernt die Besuche ohne neue Party oder neuen Plannamen.
- Noch nicht angenommene Gruppen werden unabhängig kopiert. Angenommene
  Worldgruppen und platzierte Beute behalten ihre Identität und ihren Zustand.
  Unbestätigte Gruppeneingaben bleiben bei Bereinigung als unabhängige Gruppe
  erhalten. Vorschläge der entfernten Timeline werden verworfen.
- Vergebene Belohnungen bleiben abgeschlossen. Offene Rewards erhalten eigene
  IDs; bereits platzierte Beute bleibt derselbe Worldbestand. Eine Vergabe in
  der Kopie verändert nicht den Vergabestatus der Vorlage.
- Die Historie hält Plan, Vorlage sowie vorherige und neue Besuchs-IDs fest.
  Unabhängige Kampagnenkopien remappen auch gelöschte historische Besuchs-IDs.
  Freie Texte, Quellpakete und archivierte Originalbytes bleiben unverändert.
  Laufende Scenes behalten ihren übernommenen Inhalt und ihre Herkunft.

## Einzelne Szenen wiederverwenden

`session-copy-ui.ts` lässt Besuche auswählen, ordnen und als neuen Abend oder
am Ende eines bestehenden Plans übernehmen. `copy-visits` prüft Quell- und
Zielbasis in derselben Transaktion wie neue Besuchsdetails und Receipt.
Dialog-, Source-/Target- und Controlstände bleiben getrennt gebunden; entfernte
Controls und verspätete Reads/Writes ändern keine neuere Auswahl.
Plantexte, Besuchsinhalte und Freigabebasis kommen aus derselben geprüften
Session-Lesung. Der Dialog hält keine zweite Plankopie; Ersetzen und Mappe
verwenden denselben gelesenen Plan statt ihn nochmals zu laden. Der Plananteil
ist eine Lesesicht und wird nicht zusätzlich in historischen Receipts gespeichert.
[Dialogprüfung](../../../tests/desktop-session-copy-context.test.mjs) und
[Speicherprüfung](../../../tests/desktop-session-copy-integrity.test.mjs) prüfen
Reopen, Auswahl, Antwortreihenfolge, Quellschutz, Append, unabhängige offene
Rewards, Replay und atomaren Rollback.

Spielabend-Eingaben, Ersetzen und Szenenkopien verwenden die vorhandene
Belegprüfung: Vor Send wird die Referenz mit Originalkennung und Fingerprint
dauerhaft gesichert. Eine fehlende Antwort wird lesend geklärt; bei ungeklärtem
Status bleiben weitere Buchungen gesperrt. Dialogwechsel entfernt den Beleg
nicht. Bestätigte Antworten aktualisieren nur ihren ursprünglichen Editor;
spätere Texte und neue Kopierauswahlen bleiben offen. Auch nach Dialogreset
aktualisiert die Statusklärung die Timeline; alte Refreshantworten gehören weiter
zu ihrer ursprünglichen Aktivierung. Eine inzwischen geänderte Kopierauswahl
liest Quelle und Ziel erneut, behält Reihenfolge, Namen, Partywahl und Filter
und wartet auf eine neue ausdrückliche Bestätigung. Fehlende gewählte Besuche
bleiben zum bewussten Entfernen sichtbar; sie werden nicht still übersprungen.
Jeder neue Anlageauftrag bekommt eine neue Plan-ID. Der frühere lokale
Kopier-Retry und seine vorab reservierte Plan-ID entfallen.
[Speicher- und Bedienprüfungen](../../../tests/desktop-preparation-context.test.mjs)
belegen verlorene Antworten, reine Statusabfrage, spätere Texte und genau einen
Append nach Dialogreset. Ein frischer Store liest denselben Beleg; native
Prozessende-/Neustartprüfung einschließlich wiedergefundener Referenz bleibt offen.
Die Quellenliste liest weiterhin die vollständige Preparation; 40 sichtbare
Karten begrenzen den Quellaufwand nicht. Gebuchte Beute, mehrfach referenzierte
Worldgruppen, Trash/Restore sowie native Fokus-, Tastatur- und Lastgrenzen
benötigen ihre betroffenen Abnahmen.

## Geprüft und noch offen

[Ersetzung und Kopie](../../../tests/desktop-plan-replacement-copy.test.mjs)
prüfen den echten Writer, Export/Import, Fresh, Historienverweise und exakte
Texte. [Worldgruppen und Rewards](../../../tests/desktop-plan-replacement-world.test.mjs)
prüfen erhaltene NPC-/Treasure-Identitäten, Vergabestatus, Retry und Rollback.
[Bereinigung](../../../tests/desktop-session-retention.test.mjs) erhält Rohentwürfe
und prüft Ersetzung aus demselben Plan. Das sind Storeprüfungen, keine native
Bedien-, Crash- oder Undoabnahme.
[Vorschlagsprüfungen](../../../tests/desktop-session-proposal-store.test.mjs) kontrollieren gemeinsam gelesene und gesicherte Vorschläge, Budget- und Quellenbezüge, unabhängige Generierungskennungen, historischen Beuteausgleich sowie unveränderte Sicherungen bei beschädigten Daten. Ältere Partyprofile und archivierte Wissensverweise bleiben gültige Vorschauhistorie.

Die nächsten konkreten Prüfungen und Korrekturen:

1. Beschädigte oder fortentwickelte NPCs mit mehreren Besuchsreferenzen
   ersetzen, leeren, kopieren und frisch öffnen: HP, Zustände und Identitäten
   erhalten; keine weiteren NPCs erzeugen.
2. Allokierte/verkaufte Beute und korrigierte Gutschriften kombinieren:
   effektive Bestände und Ledger vor/nach Ersatz, Retry, Kopie und Fresh
   vergleichen; bestätigte Fakten nicht erneut ausführen.
3. Offene Profil-, Besuchs-, Gruppen- und Rewardeingaben vor Ersatz sichern.
   Verzögerte Antworten, Contextwechsel, Schreibfehler und unklare Commits
   prüfen; dieselbe Command-ID per Status aufklären. Danach Save → normal
   schließen → frischer Prozess sowie Tastatur, 200%-Ansicht und Undo/Redo
   im nativen Produkt prüfen.

Für Entwürfe und Belohnungen gilt der bestehende
[Daten- und Recoveryanschluss](../runtime/combat-and-narrative-recovery.md).
Eine zweite Timelinearchitektur oder generische Historyabstraktion ist nicht nötig.

## Besuchsübergabe und Recovery

`prepareNextVisit` prüft Zielplan, Einfügeposition, angezeigte Revision,
Workspace/Aktivierung und neuere Eingaben einschließlich Mappen-Vorlesetext
und Planungsangaben. Im vorgeschlagenen Plan steht der
Einstieg vor dem nächsten Besuch, in einem anderen gewählten Plan am Ende.
Ein nicht gelisteter bisheriger Zielplan bleibt ausdrücklich ausgewählt und
wird beim Speichern geprüft; nur die eigene Neuanlageoption erzeugt einen Plan.
Keine gültige Select-Auswahl bedeutet keinen Schreibauftrag. Originaltexte
bleiben vollständig; die Ableitung des kurzen Titels verändert ihre Bytes nicht.

Der optionale `opening`-Teil speichert Planfolge, Vorlesetext und Wissensquellen
in einer Vorbereitungstransaktion. Ungültige Quellen oder Receiptfehler lassen
keinen halbfertigen Besuch zurück. Bei ungeklärter Übergabe an einen vorhandenen
Plan hält `retainOpenDrafts` den Originalauftrag unter dessen Ziel-ID fest;
der sichtbare Editor ist kein Ersatzowner. Spätere Zieltexte bleiben erhalten.
Nach neuer Storeinstanz klärt derselbe Beleg angewandt/nicht angewandt ohne
automatische Wiederholung. Der vorhandene Draftvertrag bleibt unverändert.

[Übergabeprüfungen](../../../tests/desktop-visit-handoff.test.mjs) und
[Dialogprüfungen](../../../tests/desktop-session-resume-context.test.mjs)
prüfen Zielbindung, spätere Eingaben und Originalauftrag. Native Gesamtfreigabe
und vollständige Wiederaufnahme nach Prozessende bleiben offen.

Nächster Recoveryabschluss: Anlageabsicht für einen neuen Plan
(`expectedRevision=null`) vor Send dauerhaft sichern, nach Crash finden und
mit demselben Receipt klären. Der bisherige Draftcodec setzt einen vorhandenen
Owner voraus; eine ungeklärte Anlage blockiert normales Verlassen.
`preparation-contracts.ts`, `preparation.ts`, Draftwriter/Backupprüfung in
`storage/store.ts` und Kopie in `storage/campaign-data.ts` gemeinsam prüfen:
Prozessende vor Send/nach Commit vor Reply, beschädigte Sicherung, späterer
Zielplan und unabhängige Kopie ohne automatische Ausführung oder Doppelanlage.
Bestehende Formate und historische Originaltexte erhalten.

## Zusammenhängender Vorbereitungsbereich

„Weltwissen und Orte“ und „Spielabend planen“ benutzen dieselben bestehenden
Editoren in voller Breite. Referenznavigation öffnet den passenden Bereich;
Umschalten sichert gültige Eingaben, ohne Autorenkopien zu erzeugen.
Die Generierung stellt Gruppe, Umfang, Szenenzahl und Auftrag vor optionale
Beute-/Weltvorgaben. Ledger-Ausgleich ist explizit; freie Planungszeilen brauchen
ihn nicht. Profilspeicherung erhält Eingabeknoten und neuere Werte, ungeklärte
Schreibantworten behalten dagegen ihre bisherige Sperre.

## Begegnungsbogen aus dem Abenteuertag

Der Desktop verwendet für neue Spielabende die rationale Zielaufteilung aus dem
[gebundenen Session-Generation-Original](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/sessiongeneration/requirements/requirements-session-generation.md).
`generation/session-targets.ts` normalisiert Levelanzahlen und berechnet das
Tagesbudget mit exakter Dezimalarithmetik und kaufmännischer Rundung. Der Einstieg
beginnt bei 85 % der mittleren Schwelle, der Abschluss bei der tödlichen Schwelle;
die Zwischenziele interpolieren Richtung schwer. Die Gewichte werden auf das
Planungsbudget skaliert, der letzte Wert erhält den Rundungsrest. Im Golden-Fall
(2 × Level 3, 2 × Level 4, Anteil 0.6, drei Begegnungen, Seed 179974) entstehen
exakt `680 → 1000 → 1800` Ziel-XP.

Eine leere Begegnungszahl verwendet die originale deterministische 6–8-Begegnungen-
pro-vollem-Tag-Formel mit Skalierung auf den Anteil und Begrenzung auf 1–10.
Ausdrückliche neue Anzahlen liegen ebenfalls bei 1–10; historische größere Runs
bleiben lesbar. Numerische Seeds behalten ihren Zahlenwert, benannte Seeds werden
stabil auf eine unsigned 32-Bit-Zahl abgebildet. Manuell speicherbare Nullanteile
sind erlaubt; eine Generierung ohne positive Ziele liefert keine Teilvorschau.

Jede Begegnung verwendet ihr eigenes Ziel und ihren gespeicherten Encounter-Run.
Der Session-Run hält zusätzlich Policyversion, normalisierte Party, Anteil,
Zahlen-/Textseed, gewünschte beziehungsweise automatische Anzahl, Zielreihe und
harten Zielsummentest fest. Der Reader prüft diese Fakten; unabhängiger Transfer
und Fresh erhalten sie. Vorschau und Hilfe unterscheiden Ziel-XP und tatsächlich
materialisierte Gegner-XP einschließlich Abweichung. Einzelne Neugenerierung
verwendet weiter das ursprüngliche Ziel und erhält andere Vorschläge, Texte und
Belohnungen. Die ganze Erzeugung bleibt eine Transaktion, auch wenn eine spätere
Begegnung oder das abschließende Speichern scheitert.

Dies schließt die Zielaufteilung, Automatik und deren Persistenz ab. Die volle
`encounter-v5`/`reward-v3`-Orchestrierung mit allen Rewardkanälen, unveränderlichen
Gesamtruns, semantischer Origin-Deduplizierung, strukturierten Warncodes und
vollständiger Loot-/Packing-Parität ist daraus nicht ableitbar. Aktuelle Runs
enthalten weiterhin editierbare Vorschläge und die vorhandenen getrennten
Beuteausgleichs-/Tabellenpfade.
