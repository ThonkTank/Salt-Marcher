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

Der benachbarte Live-Wissensbereich übernimmt Vorlesetext in den GM-Sceneentwurf
und speichert ihn über den bestehenden Autosaveweg. Der entfernte
Textprojektionsknopf ist keine Voraussetzung. Wird ein übernommener Besuch
aus der Planung entfernt, bleiben Sceneherkunft und die Live-Vorbereitungsquery
lesbar. Der nicht mehr aktuelle Besuch liefert keine aktuellen Notizverknüpfungen
oder Folgebesuch; historische Sceneinhalte bleiben erhalten. Der lokale Test
`tests/desktop-live-visual-context.test.mjs` prüft diesen tatsächlichen
Übernahme-/Speicherweg und erhält Autorenwortlaut ohne Playercommand.

Die Besuchsübersicht am Spieltisch zeigt den Stand der Fokusgruppe. Plan- oder
Gruppenwechsel und fehlgeschlagene Aktualisierung entfernen alte Besuchsaktionen;
verspätete oder fremde Antworten werden verworfen. Bestätigte Ergebnisse gehören
zur konkreten Übernahme, erscheinen in Mappe/Chronik und vergeben weder XP noch
Beute oder Zeit. Offene Ergebnisfelder bleiben im Prozess erhalten, auch während
einer laufenden Bestätigung; sie sind noch kein dauerhafter Entwurf.
`tests/desktop-session-progress.test.mjs` prüft die Rendererhandler sowie echten
Store mit Revision, Wiederholung, erneuter Öffnung und unabhängiger Kampagnenkopie.

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
4. **Bedienabschluss:** Dialogfokus und Rückkehr zum auslösenden Control,
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
