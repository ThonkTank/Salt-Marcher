# E2E-01-DUNGEON-GEOMETRY-PRODUCT-CL-P01: atomare Sample-Grenze

Eigener begrenzter Produkt-Cleanup-Planlauf des Dungeon-Strangs, 10. Oktober
2026. Grundlage ist der unabhängig bestandene Code-R03 auf Exact-SHA
`ea9ecd3f5c7e284b86c554d7e4a9cb99672d73c2` in
[PR #26/6093242380](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/26#issuecomment-6093242380).
Der Start dieses Laufs ist in
[#8/6093263521](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/8#issuecomment-6093263521)
und
[#12/6093263663](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6093263663)
dokumentiert. Dieser Plan ist keine Cleanup-Umsetzung, kein Review und keine
Produkt-, Host-, physische Eingabe-, Steward- oder E2E-01-Freigabe.

## Tatsächlicher technischer Rest

Code-R03 bestätigt das richtige Nutzerergebnis für den zuvor offenen
Vor-`update()`-Fehlerpfad: Ein Fehler in `unprojectLocal()` entfernt Preview
und finalisierbares Proposal; Pointer-up verändert weder Source, History, Redo
noch Draft. Die Umsetzung verteilt diese Invariante jedoch auf zwei öffentliche
Operationen:

1. `DungeonGeometryGesture.update()` widerruft vor einem bei ihr angekommenen
   Sample das ältere Proposal.
2. `AtlasEditor` muss für einen Fehler **vor** diesem Aufruf zusätzlich
   `DungeonGeometryGesture.rejectSample()` aufrufen.

Damit trägt jeder heutige oder spätere Aufrufer selbst die Verantwortung,
zwischen sichtbarer Vorschau und finalisierbarem Proposal synchron zu bleiben.
Ein vergessenes `rejectSample()` würde genau den in Code-R02 gefundenen Fehler
wieder öffnen. Das ist nach R03 kein offener Funktionsfehler, aber eine konkrete
technische Restschwäche an der Gesten-/Editorgrenze.

Der vorhandene Callback-Repro konstruiert außerdem bewusst einen minimalen
`AtlasEditor` über interne Felder. Er bleibt als Verdrahtungsoracle nötig; der
Cleanup führt dafür weder einen exportierten Testhook noch einen zweiten
Pointerrouter ein.

## Begrenztes Cleanup-Ziel

Der spätere `PRODUCT-CL-I01` bündelt die Annahme eines Pointer-Samples in genau
einer fail-closed Operation der bestehenden `DungeonGeometryGesture`:

- Die Operation widerruft das alte Proposal **vor** der Koordinatenauflösung.
- Sie erhält die Auflösung als verzögerten, schreibfreien Eingang, führt danach
  dieselbe bestehende Finite-, Basis-, Topologie-, Closure- und
  Changeprojektion aus und liefert dasselbe Proposal oder `null`.
- Wirft die Auflösung oder die nachfolgende Validierung, bleibt das Proposal
  bereits widerrufen; der Fehler darf für die vorhandene Statusanzeige zum
  Editor gelangen.
- `AtlasEditor` reicht `unprojectLocal(...)` nur noch über diese eine Operation
  ein. Sein Catch leert weiterhin die sichtbare Vorschau und meldet den Fehler,
  besitzt aber keine zweite Proposalzustandsoperation mehr.
- Das öffentliche Zweiphasenprotokoll `update()` plus `rejectSample()` wird auf
  die eine Sample-Grenze reduziert. Reine Implementierungsdetails der
  vorhandenen Projektion dürfen intern bleiben.

Die Reihenfolge ist normativ: **altes Proposal widerrufen → Koordinate
auflösen → bestehende Prüfung/Projektion → neues Proposal veröffentlichen**.
Es gibt kein Auto-Rebase und kein Wiederverwenden eines älteren sichtbaren oder
unsichtbaren Proposals.

## Erhaltene Verträge

Der Cleanup verändert nicht:

- `DungeonAtlasSource`, `SpatialGraph`, `AtlasHistory`, `DungeonSpatialBasis`,
  Parent-/Binding-/RigidFrame-Schutz oder die terminale A→B→A-Stale-Semantik;
- `buildingPointDragDestination`, `proposeBuildingPointDrag`,
  `planBuildingContourMutation`, Portal-Follow, RecordChange-Projektion oder
  `dungeonDocumentChange`;
- den tatsächlichen Beginpointer, Snap, 1,524 Meter pro Feld, stabile
  Dokument-/Floor-/Room-/Route-/Section-Kennungen und Markdown-/Key-Closure;
- die Regel, dass Preview/Cancel schreibfrei bleiben und Handoff höchstens
  genau einen Dungeon-`AtlasChange` für die gemeinsame einmalige
  `check()`/`execute()`-Komposition liefert;
- Session-, Kamera-, History-, Draft-, Journal-, Repository-, Save- oder
  FileTransaction-Wege.

PR #21/OBS-04, PR-#13-Fixturebytes, fremde Checkpoint-Wurzeln sowie sämtliche
vorhandenen Test-, Build-, Host- und Reviewbelege bleiben unverändert.

## Geplanter I01-Dateiscope

Der nach diesem Plan getrennte Cleanup-I-Lauf ist auf folgende Dateien
begrenzt:

- `src/features/dungeon/geometry-change.ts`: eine atomare fail-closed
  Sample-Grenze; das getrennte öffentliche `rejectSample()` entfällt;
- `src/features/atlas/atlas-editor.ts`: genau ein Aufruf dieser Grenze im
  bestehenden Dungeon-Pointermove; der Catch besitzt keinen Proposalzustand;
- `tests/core/atlas-spatial.test.ts`: fokussierte Regressionen der atomaren
  Grenze und weiterhin ein tatsächlicher `bind()`-Callback-Repro;
- diese Roadmap und die ausschließlich eigene
  `e2e01DungeonGeometryProductCleanup`-Checkpointwurzel für bestätigte
  Ergebnisse.

Kein anderer Produkt-, Test-, Tool-, Fixture-, Acceptance- oder
Architekturdateiscope ist durch diesen Plan geöffnet. Ergibt der I-Lauf einen
notwendigen weiteren Dateieingriff, wird er vor dem Edit als Blocker gemeldet
und nicht stillschweigend erweitert.

## Verbindliche I01-Orakel

1. **Auflösungsfehler:** gültiges Sample → `unprojectLocal()`-Fehler → Release
   ergibt keine Vorschau, keinen Handoff und keine Source-, Undo-, Redo- oder
   Draftwirkung.
2. **Validierungsfehler:** gültiges Sample → non-finite oder ungültige
   Topologie → Release besitzt dieselbe Nullwirkung.
3. **Erholung:** Nach einem abgewiesenen Sample kann ein späteres gültiges
   Sample derselben aktiven Geste ausschließlich dessen sichtbare Bytes
   finalisieren; ein Fresh Begin bleibt möglich.
4. **Basiswechsel:** Source-/Graph-/History-/Parent-/Bindingwechsel bleibt
   terminal stale, einschließlich A→B→A und late pointer-up; der Cleanup darf
   diese Grenze nicht in eine bloße Sampleablehnung abschwächen.
5. **Positive Geometrie:** Beginpointer, Snap, Kontur-/Portalbytes, Kennungen,
   Markdownclosure und 1,524-Meter-Maßstab bleiben byte- beziehungsweise
   semantikgleich.
6. **Einmalige Wirkung:** Ein gültiger Abschluss liefert weiterhin genau einen
   Dungeon-`AtlasChange`; Preview, Cancel und alle Ablehnungen schreiben weder
   Session noch AtlasHistory, Datei, Journal oder Draft.
7. **Verdrahtung:** Mindestens ein Test durchläuft die tatsächlichen von
   `AtlasEditor.bind()` registrierten Pointermove-/Pointerup-Callbacks. Ein
   ausschließlich direkter Gestentest ersetzt diesen Repro nicht.

I01 prüft die fokussierten Regressionen sowie `npm run check`, `npm test`,
`npm run build` und `git diff --check`. Synthetische Callbackeingaben sind
keine physische Eingabeabnahme. Eine GUI- oder Hostprobe ist für diesen reinen
Vertragsumbau nicht beauftragt.

## Getrennte Gates

1. **PRODUCT-CL-P01 (dieser Lauf):** technische Restschwäche, Scope,
   Erhaltungsgrenzen und Orakel planen; JSON, Links und Diff prüfen; Kandidat
   normal pushen. Kein Produktcode.
2. **PRODUCT-CL-I01:** ausschließlich die atomare Sample-Grenze und ihre
   Regressionen umsetzen, Basisprüfungen ausführen und einen eigenen Exact-SHA
   veröffentlichen. Kein Self-Merge oder Steward-Handoff.
3. **PRODUCT-CL-R01:** unabhängiger enger Review des I01-Exact-SHA gegen die
   sieben Orakel. Pflichtbefunde werden nötigenfalls in einem gezielten
   Cleanup-N01/R02 geschlossen; daraus entsteht keine rekursive neue
   Cleanup-Planphase.
4. **Handoff danach:** Erst nach unabhängigem Cleanup-PASS darf der
   unveränderte, ownergebundene Dungeonbeitrag als abgesicherter Eingang an den
   einen PR-#13-Steward gemeldet werden. Integration, Hostmontage und E2E-PASS
   bleiben dessen getrennte Gates.

