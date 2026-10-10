# E2E-01-DUNGEON-GEOMETRY-CL-P01: P01-Vertragsartefakt aufräumen

Historischer, abgeschlossener Vertrags-Cleanup. Planrepair/Produktbeitrag sind
geliefert und über PR13 auf Shared integriert; [aktueller Anschluss](ROADMAP-E2E01-DUNGEON-GEOMETRY-PLAN.md#aktueller-anschluss-statt-erneutem-phasenlauf).
Die folgenden getrennten Gates dokumentieren den damaligen Ablauf, keine
neuen Cleanup- oder Reparaturaufträge. Konkrete künftige Bereinigung mit dem
betroffenen Produktpaket nach [WORKFLOW](docs/WORKFLOW.md) liefern.

Getrennter Cleanup-Planlauf des Dungeon-Strangs, 10. Oktober 2026. Basis ist
der exakt unabhängig geprüfte PR-#23-Stand
`ea46ba5437596aceaad955330e21c3ef4e739451`. Der Review lautet
[`CHANGES_REQUIRED`](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/23#issuecomment-6092483393)
mit genau einem Fachbefund `DUN-GEO-P01-R01-01`. Dieser Cleanup plant keine
Reparatur des Befunds. Der Parent-/Bindingbasis-Vertrag bleibt dem danach
folgenden eigenen N01-Plan-Repair und seinem Exact-SHA-Re-Review vorbehalten.

## Warum dieser Cleanup nicht leer ist

Der P01-Plan hat einen engen fachlichen Umfang, vermischt aber drei verschiedene
Arten von Aussagen:

1. normative Produktgrenzen wie „kein `Session.execute`“ und genau ein
   komponiertes `AtlasHistory.execute`;
2. illustrative Implementierungsformen wie das TypeScript-Pseudointerface;
3. interne Gesturezustände sowie Verantwortlichkeiten von Dungeon-Port,
   Canvas/Editor und PR-#13-Orchestrator.

Dadurch kann die illustrative Form irrtümlich als bereits festgelegte öffentliche
ABI gelesen werden. Außerdem wiederholen Lebensdauer-, Wirkungs- und
Prüfgrenzen dieselben Begriffe in mehreren Abschnitten, ohne eine zentrale
Zuordnung von Besitzer, Eingabe, erlaubter Ausgabe und verbotener Wirkung.
Schließlich bildet `checkpoint.json.e2e01DungeonGeometryPlan` den inzwischen
veröffentlichten Reviewbefund noch nicht ab. Das sind konkrete eigene
Dokumentations- und Architekturtraceability-Rückstände; es gibt dagegen keinen
Produktcode, den dieser Cleanup vorzeitig „aufräumen“ dürfte.

## Enger CL-I01-Auftrag

Der nachfolgende Cleanup-Umsetzungslauf ändert ausschließlich das eigene
Vertragsartefakt und seine Metadaten:

- In `ROADMAP-E2E01-DUNGEON-GEOMETRY-PLAN.md` wird die heutige TypeScript-Skizze
  ausdrücklich als **nicht normative Form** gekennzeichnet. Normativ bleiben
  nur benötigte Informationen und Wirkungsgrenzen; Namen, Modulzuschnitt und
  Sichtbarkeit entscheidet erst die getrennte I01-Implementierung nach
  bestandenem N01-Re-Review.
- Eine kompakte Rollenmatrix ordnet `DungeonAtlasSource`, pure
  Command→Document-Projektion, Gesturezustand, `SpatialCanvas`, Atlas-Editor
  und PR-#13-Orchestrator jeweils Eingabe, Ausgabe, Lebensdauer und verbotene
  Wirkung zu. Sie verweist auf die bestehenden Source-/History-/Transformwege,
  statt deren Regeln erneut als parallele Architektur zu formulieren.
- Ein Glossar verwendet die Begriffe `snapshot`, `gesture state`, `preview`,
  `proposal`, `AtlasChange`, `composed command` und `handoff` jeweils nur für
  eine Ebene. Insbesondere ist ein Preview kein Sourcewert, ein Proposal kein
  Commit und ein Handoff kein Execute.
- Eine Phasenmatrix ersetzt verstreute Statusannahmen: P01-R01 ist
  `CHANGES_REQUIRED`; CL-P01/CL-I01/CL-R01 räumen nur das Artefakt auf; N01
  repariert danach ausschließlich `DUN-GEO-P01-R01-01`; erst N01-R01-PASS
  öffnet Produkt-I01. Reviewlinks und Exact-SHAs bleiben direkte Belege.
- `checkpoint.json.e2e01DungeonGeometryPlan` erhält den tatsächlichen
  Reviewstatus, Exact-SHA, Reviewlink, Finding-ID und die geschlossene
  Abfolge Cleanup→N01→Re-Review. Die eigene Cleanup-Wurzel wird nach jedem
  Cleanup-Lauf aktualisiert. Fremde Wurzeln und ältere Nachweise bleiben
  kanonisch identisch.

`ROADMAP-E2E01-SPATIAL-INTEGRATION-PLAN.md` besitzt bereits genau einen stabilen
Link auf den Ownerplan und wird im Cleanup nicht nochmals mit Statusprosa
angereichert. `acceptance.json`, `ARCHITECTURE.md`, `src/**`, `tests/**`,
Fixtures und Hostwerkzeuge bleiben unverändert.

## Bewusst nicht reparierter Fachbefund

`DUN-GEO-P01-R01-01` belegt, dass identische Dungeonbytes allein keine gültige
Gesturebasis garantieren: Undo oder eine Änderung an Location, Haus oder
Binding kann den Parentframe wechseln, während der aktuelle
`AtlasHistory.check` den alten Dungeonbeitrag weiterhin akzeptiert. Der
Cleanup darf dieses Ergebnis nur korrekt referenzieren und den Planstatus
schließen; er darf weder eine Basisidentität erfinden noch Cancel-/Update-/
Handoffregeln ergänzen. Das genaue Delta, die Orakel für Undo/Redo,
Parent-/Bindingwechsel, identische-Bytes-Sourcewechsel und late pointer-up
sowie „kein Auto-Rebase“ gehören vollständig in den späteren N01-Lauf.

Diese Grenze verhindert, dass ein redaktioneller Cleanup unbemerkt als
Fachreparatur oder Re-Review-Kandidat ausgegeben wird.

## Erhaltungs- und Diffgrenzen

CL-I01 muss folgende Grenzen maschinell oder per engem Diff nachweisen:

1. keine Änderung unter `src/`, `tests/`, `tools/`, an Fixtures,
   `acceptance.json` oder `ARCHITECTURE.md`;
2. PR #21/OBS-04 sowie seine Branch-/Commitwurzel bleiben unberührt;
3. alle Top-Level-Checkpoint-Wurzeln außer
   `e2e01DungeonGeometryPlan` und der eigenen
   `e2e01DungeonGeometryCleanup` bleiben nach kanonischer JSON-Ausgabe
   identisch;
4. UUIDs für Dokument30, Room31, Floor32, Route33 und Section34 sowie alle
   früheren SHA-, Test-, Build-, Host- und Issuebelege bleiben unverändert;
5. der R01-Befund bleibt offen und wortsinngemäß erhalten; keine Formulierung
   behauptet Plan-PASS, Produkt-I01-Erlaubnis oder E2E-Freigabe;
6. der Ownerplan behält genau einen kanonischen Abschnitt für Rollen und einen
   für Phasengates; entfernte Wiederholungen dürfen keine normative
   Wirkungsgrenze verlieren;
7. alle relativen Dokumentlinks und externen Reviewlinks sind auflösbar.

## Getrennte Cleanup-Gates

1. **CL-P01 (dieser Lauf):** konkreten Cleanup-Scope und Schutzorakel
   dokumentieren, JSON/Links/Diff prüfen, Kandidat normal pushen. Keine
   redaktionelle Umsetzung außerhalb des zur Einordnung nötigen Planlinks.
2. **CL-I01:** nur die oben benannten Vertrags-/Glossar-/Rollen-/Phasen- und
   Checkpointbereinigungen umsetzen. Keine Parentbasis-Reparatur und kein
   Produktcode.
3. **CL-R01:** ein unabhängiger Reviewer prüft, dass die Mehrdeutigkeit und
   Statusdrift entfernt sind, ohne Normen, Belege oder den offenen Fachbefund
   zu verlieren. Pflichtbefunde erhalten nötigenfalls einen getrennten
   CL-N01/CL-R02.
4. **N01 danach:** erst nach Cleanup-PASS wird genau
   `DUN-GEO-P01-R01-01` als eigener Plan-Repair bearbeitet und erneut auf
   Exact-SHA unabhängig geprüft. Produkt-I01 bleibt bis dahin geschlossen.

CL-P01, CL-I01 und CL-R01 sind Dokumentations-/Vertragsläufe, keine
Produkt-, GUI-, Host-, physische Eingabe-, Cleanup-Gesamt- oder E2E-01-
Freigabe. Kein Lauf wird selbst in PR #13 oder Shared gemergt.
