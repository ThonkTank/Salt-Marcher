# Spielprotokoll zu wiederverwendbarem Weltwissen

GM-Aufgabe: Aus dem gemischten Rohprotokoll „Nacht am Grauen Ufer“ vier
Originalnotizen für Siv (NSC), die Bruderschaft (Fraktion), das verschwundene
Signalfeuer (Quest) und die Kupfermarke (Gerücht) gewinnen. Wortlaut der Quelle
bewahren, Herkunft nachvollziehen, die Originale im Spielabend „Nächste Flut“
verwenden und nach normalem Neustart über ihren Inhalt wiederfinden und ergänzen.

## Tatsächlicher Vergleich

SaltMarcher-Ausgangsstand: `08a62f3d4d799ca8f0f6e4b89db39edae34505d2`.
Der vollständige native Ablauf einschließlich Fresh und Weiterbearbeitung ist in
`evidence/session-log-own-before/result.json` im Chat-Arbeitsverzeichnis belegt.
Das Rohprotokoll musste mangels allgemeiner Notizart als Gerücht geführt werden.
Jeder Auszug erforderte Kopieren, separate Anlage, Einfügen und Herkunftsbeziehung.
Die eingehenden Herkunftsbeziehungen füllten die Notizmappe der Quelle nicht;
vor der Abendübergabe war ein zusätzlicher Auswahl-/Verknüpfungsdurchgang nötig.
Die Spielabendmappe zerlegte fünf Originale in dreizehn Abschnitte.

Kanka 3.15, offizieller Quellstand
`79d951798fead551dfbd60d293a6c4695c31c42d`, lokale isolierte Installation:
Dieselben vier Absätze wurden über echte Fenster, Zwischenablage und Formulare
als Character, Organization, Quest und Note angelegt. Die Relationsmaske erzeugte
„Quelle · Sitzungsprotokoll“ und den gepinnten Gegenverweis „Auszug“ gemeinsam.
Das Rohprotokoll blieb als allgemeine Note mit freiem Typ „Sitzungsprotokoll“ lesbar.
Ein Journal „Nächste Flut“ verwendete die vier Originalbeschreibungen über tatsächlich
im Editor eingegebene und im Leser geprüfte Einbettungen. Nach normalem
Browser-Neustart fanden die Volltextabfragen Lebenszeichen, Salzscheune, Wärter und
Vogelfuß die vier Originale. Ergänzungen erschienen ohne Journaländerung in dessen
Leseansicht. Die ursprünglichen Protokollabsätze wurden abschließend verglichen.
Nachweis: `evidence/kanka-case24/result.json` und `fresh-next-evening.json`.
Syntaxreferenz: https://docs.kanka.io/en/latest/features/mentions.html

Die erste Suche arbeitet nach Namen; für Volltext wurde der sichtbare Hinweis
„Ctrl+F full text“ verwendet. Die Einbettung erfordert die erwähnte Syntax und
Entitätsidentitäten. Fehlende Iconfonts der lokalen Kanka-Assets werden nicht als
Produktmangel gewertet. Ein zu breiter Testselektor wählte einmal die Quelle statt
Notiz 14; der irrtümliche letzte Absatz wurde über den Editor entfernt, alle
Originalabsätze danach verglichen. Dies ist ein Automationsfehler. Die Korrektur
und die danach tatsächlich bearbeitete Identität sind separat gesichert.

## Änderung und technische Grenzen

„Aus markiertem Text Notiz anlegen…“ übernimmt den ausgewählten Wortlaut in eine
neue, benannte und typisierte Originalnotiz. Die Quelle bleibt geöffnet. Der
kanonische Writer prüft Quellrevision, Bereich, Wortlaut, Publikum und Identität;
neue Notiz und die Richtungen „Quelle“/„Auszug“ werden gemeinsam mit Index und
Belegen atomar geschrieben. Private GM-Auszüge gelangen nicht ins Vorlesefeld.
Ein unklarer Auftrag wird über die vorhandene Originalauftragsprüfung aufgeklärt;
keine automatische Wiederholung. Die Quelle erhält dadurch ihre vier
Notizmappen-Mitglieder ohne zusätzliche Verknüpfungsrunde.

Die zusätzliche Art „Notiz“ trägt allgemeine Protokolle ohne künstlichen
Aufgabenstatus. Bestehende Notizarten und Identitäten bleiben erhalten. Der
SQLite-Schemastand bleibt 46; die gemeinsamen Validatoren, Leser und Artanzeigen
akzeptieren den zusätzlichen Wert. Fresh und unabhängige Kampagnenkopien sind
gezielt geprüft.

Zusammenhängende private Mappenabschnitte derselben Originalnotiz erscheinen als
Lesebereich mit einer Originalaktion. Status und Beziehungen bleiben lesbar,
öffentliche Vorleseaktionen separat. Die fünf Originale dieser Aufgabe benötigen
fünf statt zwölf Navigations-/Bearbeiten-Einträge auf dem Zwischenstand mit
allgemeiner Notiz. Kanonische Quelltexte und Such-/Exportinhalt werden dadurch
nicht verändert. Die höhere Informationsdichte ist kein Beleg menschlicher
Präferenz oder allgemeiner Überlegenheit gegenüber Kanka; Inhalte, Fenstermaße
und Root-Einbettung unterscheiden sich.

## Qualifikation

Gezielte lokale Prüfungen: 197 betroffene Bestands-/Editor-/Verknüpfungstests,
33 Tests für Auszüge, Kopie und gemeinsame Notizoberflächen sowie 39 für
Mappenaktionen und Besuchsfortschritt, jeweils ohne Fehler. Typprüfungen und
beide Builds bestehen. Kein identischer lokaler Komplettlauf; die vollständige
Qualifikation gehört der exakten Candidate-CI.

Native Wiederholung: `tools/test-desktop-note-excerpts.mjs` führt die gesamte
Aufgabe einschließlich normalem Fresh, vier Inhaltsabfragen/Ergänzungen,
unverändertem CRLF-Rohtext, einer Abendübergabe, aktueller Leseansicht und Öffnen
der richtigen Originalidentität aus der Mappe aus. Nachweise enthalten
Quellstand, Artefakthashes, Profil, tatsächliche Prozessausgänge und UI-Fehler.
Frühere Helper-/Screenshotfehler bleiben als solche erhalten und werden nicht zu
Produktbefunden oder normalem Controllerende umgedeutet.

Candidate-CI, Main-Integration, separater Main-CI-Lauf und native Prüfung auf dem
tatsächlichen Main werden jeweils am ausgelieferten SHA erfasst. Menschliche
Abnahme und installierte Paketabnahme sind durch diese Prüfungen nicht erteilt.
