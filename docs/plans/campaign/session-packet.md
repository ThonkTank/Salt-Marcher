# Spielabendmappe: Quellenstand, Suche und Ausgabe

Die Spielleitung öffnet im ausgewählten Plan eine GM-Mappe und findet den
vorbereiteten Wortlaut nach Besuchsfolge. Dies ergänzt den manuellen Planner;
Sessiongenerierung, Live-Übernahme, Kampf, Rewards und deren vollständige
Abnahmen bleiben eigene Lieferziele. Die Mappe enthält private GM-Inhalte und
hat keinen Anschluss an die passive Spieleranzeige.

## Aktueller Anschluss

- `src/app/storage/session-packet.ts` liest Plan, Besuchsdetails, gebundene
  Ortsabschnitte, Weltverweise, Begegnungen mit konkreten Statblocks und Rewards
  in einer SQLite-Lesetransaktion. Fremde ungebundene Worldnotizen werden nicht
  geladen. Fehlende/archivierte Orts- und Weltverweise erzeugen Warnungen;
  beschädigte benötigte Quellen brechen den Read ab. Die Begegnungsreader
  behandeln fehlende Gruppen/Actorprofile noch als Fehler der ganzen Mappe.
- `src/app/session-packet-ui.ts` speichert zuerst Basis- und Sessioneingaben.
  Jede neue Öffnung/Aktualisierung verwirft die bisherige Exportfreigabe und
  leert Inhalte, Trefferzahl und Warnungen. Nur die aktuelle Antwort desselben
  Campaigntokens und Plans darf die Mappe füllen. Fehlgeschlagenes Speichern
  gibt keine frühere Mappe zur Ausgabe frei. Schließen und Contextwechsel
  entwerten ausstehende Read-/Exportmeldungen. Eine alte Exportantwort darf
  keinen Export während einer neueren Aktualisierung freigeben.
- Suche filtert Besuche anhand Titel, Ort, Blocküberschriften und aller
  Blocktexte. Sie verändert den gespeicherten Mappenstand nicht. Der Export
  enthält weiterhin alle Besuche, auch bei einem aktiven Suchfilter.
- `src/app/session-packet-contracts.ts` ergänzt Markdownüberschriften um die
  übernommenen Textblöcke. Deren Wortlaut und CRLF bleiben erhalten; erzeugte
  Überschriften werden einzeilig. Die Inhaltsbasis umfasst die vollständige
  Ausgabeprojektion einschließlich Planungsparty, Warnungen und Planrevision.
- `desktop/main.ts` liest die Mappe vor dem Dateidialog und prüft ihre Basis
  nochmals nach der Dateiauswahl. Geänderte Quellen verlangen Aktualisieren;
  geschrieben wird der zuvor geprüfte Stand. Dialogabbruch schreibt nichts.
  Das ist noch kein nativer Dateifehler-/Dialognachweis.

Die Mappe kann inzwischen als gemeinsamer DOM-/Quellenstand neben dem Live-Spiel
andocken. Vorbereitung öffnet sie weiterhin als Dialog; Live-Spiel bietet
Besuchswechsel und Übernahme eines Vorleseblocks in den GM-Sceneentwurf. Die
vorhandenen Kontext-/Flushregeln bleiben bindend. Nach Schließen oder einer
neuen Aktualisierung dürfen entfernte alte Controls keinen Besuch oder Text
mehr übernehmen. Ihre Handler prüfen zusätzlich zum Livecontext die aktuelle
Mappenanfrage und den tatsächlich angezeigten Snapshot. Die lokale Dockfixture
prüft diese Grenze; native Fokus-/Layout-/Langtextabnahme bleibt offen.

Die Live-Blöcke öffnen inzwischen ihre gebundene Quelle, bereiten die angezeigte
Begegnungsgruppe vor oder führen zur Belohnung dieses Besuchs im bestehenden
Planner. Jeder Handler bindet den tatsächlich angezeigten Besuch und Mappenstand;
entfernte, deaktivierte und in einer anderen Oberfläche verborgene Controls sind
wirkungslos. Die Gruppenaktion bindet zusätzlich die ursprüngliche Gruppenrevision
und verlangt den übernommenen Besuch am aktuellen Szenenort. Eine geänderte Gruppe
verlangt Aktualisieren. Ältere Deskriptoren ohne Revision bleiben lesbar, geben aber
keine Begegnungsaktion frei. Deskriptoren sind nur abgeleitete Mappendaten; eine
Kampagnenmigration ist nicht nötig. Die bestehenden Combat- und Rewardcommands
bleiben für ihre Datenprüfung und Transaktion verantwortlich.

Die Autorität bleibt über Liveflush, Quellenread und Combat-Draftflush prüfbar.
Neuer Vorlesetext während eines ausstehenden Liveflush wird nicht überschrieben.
Die lokale DOM-/SQLiteprüfung deckt diese Übergänge, Gruppenrevisionen und alte
Controls ab. Der tatsächliche Wechsel Live → Quelle/Kampf/Belohnung mit Fokus,
Offenentwürfen, Fehlern und anschließender Wiederaufnahme ist weiterhin nativ
abzunehmen; die zusätzliche Aktion schließt keine vollständige Produktabnahme.

Der integrierte Besuchsnavigator (`session-progress-ui.ts`,
`storage/visit-outcomes.ts`) und `LiveAction.visit-outcome` zeichnen jetzt
manuell bestätigte Besuchsergebnisse in der Kampagnenhistorie auf. Die Mappe
zeigt die Anzahl der Übernahmen und höchstens die fünf neuesten Ergebnisse je
Besuch, mit ausdrücklichem Hinweis bei weiteren Übernahmen. Dies ist Codebefund;
vollständige Ergebnishistorie, Verlaufsexport und native Wiederaufnahme bleiben
separat abzunehmen. Die nächste Lastprobe muss auch die zusätzlichen Reads pro
Besuch und Ergebnis berücksichtigen.

Der benachbarte Live-Wissensbereich übernimmt Vorlesetext in den GM-Sceneentwurf
und speichert ihn über den bestehenden Autosaveweg. Der entfernte
Textprojektionsknopf ist keine Voraussetzung. Wird ein übernommener Besuch
aus der Planung entfernt, bleiben Sceneherkunft und die Live-Vorbereitungsquery
lesbar. Der nicht mehr aktuelle Besuch liefert keine aktuellen Notizverknüpfungen
oder Folgebesuch; historische Sceneinhalte bleiben erhalten. Der lokale Test
`tests/desktop-live-visual-context.test.mjs` prüft diesen tatsächlichen
Übernahme-/Speicherweg und erhält Autorenwortlaut ohne Playercommand.

Das integrierte Quest-/Gerüchtjournal verwendet den bestehenden Narrativeowner
für Status und Belohnungsvergabe. Gebundene Quest-/Gerüchtblöcke der Mappe
zeigen nun bestätigten Status, vorbereitete Belohnung oder das vergebene Ergebnis.
Ein vorhandener Rohentwurf wird als solcher angekündigt; er ersetzt den
bestätigten Mappenstand nicht. Die lokale Storeprobe vergleicht Journal und
Mappe vor/nach einem ausdrücklich bestätigten Abschluss samt erhaltenem CRLF.
Eine weitere Probe liest 42 Aufträge in zwei geordneten Seiten ohne Writes und
prüft Fresh. Native Journalnavigation und Entwurfswechsel bleiben offen.

Die neue Sessionauswahl (`session-review-ui.ts`) erlaubt Suche und Filter über
Vorschläge sowie eine gemeinsam bestätigte Übernahme. `accept-proposals` bindet
Plan und jede gewählte Vorschlagsrevision, prüft alle ursprünglichen Quellen-
und Rewardgrundlagen vor dem ersten Publish und schreibt die geordnete Auswahl
in einer Transaktion. Der Einzelweg bleibt kompatibel. Drei gezielte SQLite-
Prüfungen in `desktop-session-reward-integrity.test.mjs` belegen verweigerte
Annahme nach XPänderung ohne Teilwirkung, ursprüngliche Reihenfolge samt Fresh/
Receiptreplay sowie Rollback eines Fehlers beim zweiten Gruppenwrite. Ein
aktiver Reviewdialog, Entwürfe nach Neustart und die vollständige beauftragte
Ein-Klick-Vorbereitung sind dadurch noch nicht nativ oder vollständig abgenommen.

Die Reviewbestätigung bindet Campaigntoken, Planrevision, Vorschlagsstand und
Vorschauanfrage bereits beim Öffnen. Sie kopiert die angezeigte Auswahl;
Revisionen werden nach einem Flush nicht auf den dann aktuellen Plan umgebogen.
Schließen, erneutes Review und ein neuer Render entwerten alte Controls und
Antworten. Eine verspätete erfolgreiche Übernahme darf keine neuere Auswahl
leeren oder deren Dialog schließen; der nachfolgende Runread prüft den Kontext
auch nach seiner Antwort. Fehler bleiben im aktuellen Dialog sichtbar und
lassen dieselbe geprüfte Auswahl erneut versuchen. Geänderte Grundlagen
verlangen ein neues Review. Kontrollierte DOMproben prüfen diese Übergänge
sowie den wirklichen Sessionhandler mit verzögerten IPCantworten; sie ersetzen
keine native Abnahme und beweisen keine zusätzliche SQLitewirkung.

## Nächste ausführbare Schritte

1. **Vollständigkeit am Spielabend prüfen:** Eine konkrete Vorbereitung mit
   mehreren Besuchen, wiederverwendeten Orten/NPCs, platzierter und unplatzierter
   Gruppe, geänderten HP und vergebenen/platzierten Rewards erstellen. Zwischen
   Planner, `readSessionPacket`, Mappe und Markdown jedes tatsächlich erwartete
   Feld vergleichen. Manuelle Lootnotizen, geplante Rasten und weitere noch
   fehlende Plannerfelder dürfen nicht durch diese Ausgabe als erledigt gelten.
   Gebundene fehlende Gruppen/Actorprofile separat gegen fachlich zulässige
   Archivierung prüfen; beschädigte Daten nicht still auslassen.
2. **Quellen- und Dateiausgabe nativ abnehmen:** In Electron exportieren und
   während des geöffneten Speicherdialogs eine benötigte Quelle ändern. Erwartet:
   Aktualisieren statt einer unbemerkt anderen Ausgabe. Abbruch, Schreibfehler,
   erneutes Öffnen nach Fehler, Campaignwechsel und vorhandene Zieldatei prüfen.
   Exportbytes einschließlich CRLF, führender Leerzeichen und Markdownfences
   vergleichen. Darstellung offener Autorenfences in üblichen Markdownlesern
   prüfen, ohne Autorenprosa zur vermeintlichen Reparatur umzuschreiben.
3. **Datenwege gemeinsam begrenzen:** Der aktuelle Read liefert noch sämtliche
   Mappenblöcke; die Suche scannt diese Liste im Renderer. Last zuerst an realen
   umfangreichen Plänen messen: Antwortbytes, Zeit, Peak-RAM und wiederverwendete
   Quellen. Danach bei Bedarf Besuchsübersicht/Suche und ausgewähltes Detail in
   `SessionPacketAPI`, Store, IPC und UI gemeinsam trennen. Export muss weiterhin
   vollständig und konsistent sein; keine willkürliche Ergebnisabschneidung und
   kein zweiter dauerhaft gespeicherter Inhaltsbestand. Kleine Pläne benötigen
   keinen allgemeinen Suchindex oder Package-/Rendererframework.
4. **Auswahl und Wiederaufnahme schließen:** In `session-review-ui.ts` und
   `session-ui.ts` den nativen Wechsel zwischen offenem Review, Planrevision,
   Vorschlagseditor und laufendem Speichern prüfen. Esc/Abbruch vor Submit
   schreibt nichts; nach bereits gesendetem Submit bleibt der bestätigte
   Commandstatus maßgeblich. Auswahlwechsel während des nachfolgenden Reads
   darf nicht zurückspringen. Danach die fehlenden Entwurfsregeln für
   Neustart aus dem manuellen Sessionplan liefern: gewählte Vorschläge,
   Filter/Suche und ungespeicherte Eingaben eindeutig an Campaign/Plan/Run
   binden, veraltete Revisionen erkennbar machen und Wiederaufnahme anbieten.
   Ein temporärer DOMauswahlstand gilt nicht als persistierter Entwurf.
5. **Bedienabschluss:** Dialogfokus und Rückkehr zum auslösenden Control,
   Tastatur, Suche ohne Treffer, 200-%-Skalierung und lange Statblocks nativ prüfen.
   GM-Mappe beim tatsächlichen Live-Spiel verwenden; keine Erfolgsmeldung aus
   der Zahl der Tests oder einer neuen Tutoriallektion ableiten.

## Lokaler Nachweis

`tests/desktop-session-packet-context.test.mjs` benutzt die wirklichen
Rendererhandler im kontrollierten DOM und den echten SQLite-Store. Es prüft
Quellenwortlaut, stabile/geänderte Basis, Read ohne Datenänderung, Fresh,
Ortsabschnitte/Weltverweise/Statblocks, Fehler benötigter gegenüber ungebundenen
Quellen sowie Suche und verspätete Antworten. Der Speicherdialog wird dabei
nicht ausgeführt. Native Ausgabe, große Pläne, Accessibility und der komplette
Vorbereitung-/Live-/Nachbereitungsweg bleiben offen.

Die [Autorenverweisplanung](authored-text-references.md) führt den gemeinsamen
Textvertrag, Literal-/Kopierschutz, die Einfügeautorität und die noch offene
Alias-/Markdown-/Verbraucherclosure. Die Mappe erhält weiterhin Autorenbytes.
