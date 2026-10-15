# GM-Referenzsuche und Regeln am Spieltisch

Stand: 14.10.2026. Ergänzt [Katalog und Regeln](../../../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md),
[Live-Scenes](smr03-live-scene-contract.md) und [Gesamtumfang](../../SCOPE.md).

## Ziel und vorhandene Nutzerwege

Die gepinnten Program Capabilities, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, L57–70 und L659–668, verlangen
wiederverwendbare installationsweite Regeldefinitionen, aktuelle Referenzen für
laufendes/künftiges Spiel und erhaltene historische Fakten. Quellenhash im Register:
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`.

- **Nachschlagen:** Die GM-Schnellsuche (`Strg+K`) sucht Weltinhalte einschließlich
  Regelnotizen, Kreaturen, Gegenstände und Begegnungen. Begrenzte Trefferseiten,
  Detailansicht, verknüpfte Inhalte, Zurück/Vorwärts und Aktualisieren sind vorhanden.
- **Verwenden:** Inhalte lassen sich am Szenentisch anheften, Texte zum Bearbeiten
  öffnen, Vorlesetext übernehmen oder Kreaturen/Begegnungen am Spieltisch vorbereiten.
  Lesen und Anheften verändern keine Zeit oder Belohnungen. Übergaben prüfen den
  angesehenen Quellenstand erneut nach dem Speichern offener Eingaben.
- **Regelstand festhalten:** Der kampagnengebundene `rule`-Notiztyp lässt sich
  zusätzlich als eingefrorene Regelreferenz an eine Scene heften (maximal 50).
  Quellenrevision, Titel, Vorlesetext und GM-Notizen bleiben erhalten. Änderungen
  und nicht verfügbare Quellen werden angezeigt; Aktualisieren/Lösen ist ausdrücklich.
  Diese Regelstände unterscheiden sich von den allgemeinen Szenentisch-Verweisen.
- **Proben protokollieren:** d20-Proben mit Normal/Vorteil/Nachteil, Modifikator,
  optionalem SG und Regelbezug besitzen einen gruppengebundenen Verlauf. Receipts
  bewahren das bestätigte Ergebnis einschließlich der damaligen Würfel/Regelbasis.

## Nachgewiesenes Verhalten und Grenzen

[Schnellsuche](../../../tests/desktop-quick-reference.test.mjs) prüft mit echtem
Store und DOM entfernte Treffer, überholte Enter-Anfragen, Quellenänderungen beim
Speichern, unveränderte Textübergaben und Pins ohne Zeit-/Fortschrittswirkung.
[Regel-UI](../../../tests/desktop-rule-reference-authority.test.mjs) und
[Regelspeicher](../../../tests/desktop-rule-reference-store.test.mjs) prüfen
Campaign-/Scenewechsel, Revisionsschutz, erste State-Anlage, Proben, Replay, Fresh
und unabhängige Kopien. Reads und readonly Snapshotprüfung schreiben keinen State.
Ungültige Aktionen/Revisionen werden abgewiesen; vorhandene Prosa bleibt erhalten.

Das belegt lokale Controller-/Storepfade. Native Close-/Replyverlust-, Restart-,
Tastatur- und Skalierungsabnahme bleiben offen. Installationsweite Regeldefinitionen,
deren Konfliktimport und die Trennung aktueller Definitionen von historischen
Fakten sind noch nicht vollständig umgesetzt.

## Nächste ausführbare Schritte

1. **Speicherbestätigung schließen.** `executeSceneRule` an den gemeinsamen
   `CommitReference`-/Status-/`writeConfirmed`-Weg anschließen und Pendingcommands
   in `flushLive` berücksichtigen. Abnahme: Pin/Refresh/Unpin vor/nach Commit
   unterbrechen, Scenewechsel, Close/Fresh; Replyverlust lesend am gleichen Command
   aufklären, keine neue Command-ID als automatischer Retry.
2. **Regelsuche vereinfachen.** Das Regelpanel lädt weiterhin die ganze
   `Preparation` und zeigt höchstens 20 Regeln ohne Folgeseite. Den vorhandenen
   begrenzten Suchweg nutzen oder um nötige Regeltexte ergänzen; keine dritte Suche
   bauen. Abnahme: Regeln hinter vielen anderen Notizen, GM-Textsuche, weitere
   Treffer, Quellenänderung und Campaignwechsel.
3. **Aktuelle Definitionen und Geschichte verbinden.** Den vorhandenen
   SharedDefinition-/Importkonfliktweg für installationsweite Regeln verwenden,
   Quellen-/Lizenzprovenienz und kampagneneigene Hausregeln erhalten. Laufende/
   künftige Referenzen lesen aktuelle Definitionen; abgeschlossene Fakten behalten
   ihre Basis. Eingefrorene Pins und freie Prosa migrieren. Abnahme: zwei Kampagnen,
   gleichnamige Definitionen, Änderung, abgeschlossene Scene und Konfliktimport.
4. **Daten- und Bedienabschluss prüfen.** Pins ohne State, Row-/Sourceidentität,
   semantische Receipts, archivierte Quellen und Erasure schließen. GM-Notizen
   bleiben in der GM-Oberfläche; die passive Anzeige verwendet ihre geprüfte
   Projektion. Danach die offenen nativen Nutzerabläufe abnehmen.
