# E2E-01-DUNGEON-GEOMETRY-P01: schreibfreier Konturpunktzug

Eigener begrenzter Planlauf des Dungeon-Strangs, 10. Oktober 2026. Basis ist
der veröffentlichte PR-#13-Kandidat
`e5a19a93ce417b4e48fa86512d1c7f1be4d41eea`. Der belegte Ownerinput steht in
[#12/6092359086](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6092359086),
die Quellanalyse in
[#8/6092363698](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/8#issuecomment-6092363698).
Dieser Plan ist nur ein I01c-Eingang für den einen E2E-01-Kandidaten. Er ist
keine Implementierungs-, Host-, Cleanup- oder E2E-Freigabe.

Der unabhängige P01-R01 auf Exact-SHA `ea46ba5437596aceaad955330e21c3ef4e739451`
fordert mit `DUN-GEO-P01-R01-01` genau eine spätere Fachreparatur. Vor deren
eigenem N01-Lauf folgt der getrennte
[`E2E-01-DUNGEON-GEOMETRY-CL-P01`](ROADMAP-E2E01-DUNGEON-GEOMETRY-CLEANUP-PLAN.md),
der ausschließlich Rollen-, Begriffs- und Phasentraceability dieses
Vertragsartefakts aufräumt. Weder dieser Verweis noch der Cleanup reparieren
den Befund oder öffnen I01.

## Vertragsbegriffe

Diese Begriffe bezeichnen jeweils genau eine Ebene:

| Begriff | Bedeutung | Keine Bedeutung |
| --- | --- | --- |
| `snapshot` | Ein kanonischer immutable Read aus `DungeonAtlasSource` mit nativen Dungeonbytes, Dokument und abgeleiteter Keyclosure. | Keine Revision, kein Preview und kein schreibender Sessionzustand. |
| `gesture state` | Flüchtiger Editorzustand zwischen Begin und Cancel/Handoff. Seine genaue Gültigkeitsbasis ist wegen `DUN-GEO-P01-R01-01` noch **nicht** beschlossen und bleibt N01 vorbehalten. | Kein Sourcewert, kein Historieneintrag und keine persistente Sessionrevision. |
| `preview` | Ein aus dem Gesturezustand abgeleitetes immutable Dokument, das nur die bestehende räumliche Lesesicht überlagert. | Kein Draft, kein Save und keine Mutation eines Owners. |
| `proposal` | Das schreibfrei validierte Paar aus Previewdokument und möglichem ownergebundenem `AtlasChange`. | Kein Commit und keine Erlaubnis zum Execute. |
| `AtlasChange` | Kanonischer Before→After-Beitrag genau des Dungeonowners. | Kein vollständiger Mehrownerbefehl und kein eigener Undo-Schritt. |
| `composed command` | Vollständiger, vom PR-#13-Orchestrator zusammengestellter Befehl aller beteiligten tatsächlichen Owner. | Keine Dungeon-eigene Parallelhistory. |
| `handoff` | Übergabe eines noch nicht ausgeführten Dungeonbeitrags an den Orchestrator. | Weder `check()` noch `execute()` und keine Speicherwirkung. |

Die normativen Aussagen dieses Plans sind Scope, Eingaben, Ausgaben,
Wirkungsverbote, Erhaltungsgrenzen und Gates. Bezeichner, TypeScript-Form,
Dateizuschnitt und Sichtbarkeit sind erst nach bestandenem N01-Re-Review im
getrennten Produkt-I01 festzulegen.

## Enger Auftrag und Nichtziele

Der erste Port bearbeitet ausschließlich einen Punkt der **äußeren Kontur**
von Room31 auf Floor32. Er verwendet den vorhandenen nativen Dungeon-Snapshot,
die bestehenden reinen Building-Punkt- und Konturplaner und erzeugt bei
Finalisierung genau einen kanonischen ownergebundenen Before→After-
`AtlasChange`. Vorschau und Abbruch sind vollständig transient.

Nicht Teil dieses Laufs und des ersten I01 sind Punkt einfügen/entfernen,
Innenlöcher, ganze Räume verschieben, neue Räume oder Geschosse, freie Wände,
neue Detailkarten, Raum-Key-Bearbeitung, Campaign-/Worldautorität,
CompleteImport, Save-/Draft-/Journalumbau und eine zweite Kamera, Geometrie,
Session, History oder Persistenzstrecke. Route33 bleibt ein semantischer
Eingang und wird nicht als physische Tür umgedeutet. OBS-04/PR #21 bleibt
unverändert.

## Wiederverwendete Wahrheit

- `DungeonAtlasSource.read()` liefert aus der gemeinsamen `AtlasHistory` den
  kanonischen `.dungeon`-Bytewert, ein immutable `MapDocument` und die daraus
  abgeleitete Keyclosure. `dungeonDocumentChange(before, after)` erzeugt den
  ownergebundenen kanonischen Dokumentbeitrag. Es gibt keine persistente
  Sessionrevision und keine zweite Keyautorität.
- `SpatialGraph.frame(documentId, view)` prüft die tatsächliche Owner-, Floor-,
  Room- und Entrance-Route-Closure. Der Dungeonmaßstab bleibt ausschließlich
  dort `1.524` Meter pro Feld.
- `SpatialCanvas` verwendet dieselbe relative Kamera zum Zeichnen, Treffen und
  Zurückprojizieren. Die geplante Vorschau erweitert diese Lesesicht; sie
  besitzt keine Kamera und keinen Renderer.
- `buildingVertexGrip`, `buildingPointDragDestination`,
  `proposeBuildingPointDrag` und `planBuildingContourMutation` bleiben die
  einzige Punkt-/Topologiesemantik. Der letzte Planer validiert Metadaten,
  Konturadresse, Polygongeometrie und abhängige Portalanker.
- `AtlasHistory.check()` prüft einen vollständigen prospektiven
  Mehrownerzustand schreibfrei. Erst der bestehende PR-#13-Orchestrator darf
  danach genau einmal `AtlasHistory.execute()` für denselben vollständigen
  Befehl aufrufen.

## Geplanter ownerseitiger Port

Eine mögliche I01-Umsetzung bündelt den reinen Port beispielsweise in
`src/features/dungeon/geometry-change.ts`; der Dateiname ist nicht normativ.
Der Port exportiert keinen Executor und keine Speicherfunktion. Die folgende Form ist **nur illustrativ**, keine
festgelegte öffentliche ABI. Normativ ist, dass die genannten Informationen
ohne Schreibwirkung bis zum Handoff verfügbar bleiben:

```ts
interface DungeonGeometryAddress {
  ownerId: string;
  floorId: string;
  roomId: string;
  contour: number;
  point: number;
}

interface DungeonGeometryProposal {
  before: DungeonAtlasSnapshot;
  address: DungeonGeometryAddress;
  preview: MapDocument;
  change: AtlasChange;
}
```

Die konkreten Funktionen beginnen eine Geste aus genau einem eingefrorenen
`DungeonAtlasSnapshot`, ermitteln einen äußeren Vertexgrip und aktualisieren
ihn in nativen Dungeonfeldern. Der 16-Pixel-Grip wird mit der vorhandenen
Kamera und dem `RigidFrame` in Felder umgerechnet; `1.524` wird weder im
Dokument noch im Proposal gespeichert. Snap benutzt unverändert
`buildingPointDragDestination`.

`proposeBuildingPointDrag` liefert die Geometrie, anschließend erzeugt
`planBuildingContourMutation` das validierte bestehende `Command` samt
abhängigen Portaländerungen. Für dessen schreibfreie Materialisierung wird
die bereits von `Session` verwendete Record-Change-Validierung als **eine
gemeinsame pure Dokumentprojektion** freigelegt oder eng extrahiert. Die
Umsetzung darf weder `Session.execute()` auf einer temporären Session aufrufen
noch Entity-/Portal-/Reihenfolgelogik nachbauen. Die Projektion nimmt das
eingefrorene Dokument und das validierte Command, prüft Beforewerte, Kennungen,
Indizes und das resultierende Gesamtdokument und gibt ein neues immutable
`MapDocument` zurück. `dungeonDocumentChange(snapshot.document, after)` ist
danach die einzige Atlas-Change-Erzeugung.

Ein Nullzug liefert kein Proposal. Ein erfolgreiches Proposal enthält genau
den Byte-Snapshot, aus dem auch die Vorschau stammt. Es hat keine
`execute`-, `undo`, `save`, `flush`-, Repository-, Vault- oder Dateimethode.

## Rollen- und Wirkungsgrenzen

| Rolle | Eingabe und Lebensdauer | Erlaubte Ausgabe | Verbotene Wirkung |
| --- | --- | --- | --- |
| `DungeonAtlasSource` | Tatsächliche registrierte Ownerwerte derselben `AtlasHistory`; liefert einen Zeitpunktssnapshot. | Kanonische Dungeonbytes, immutable Dokument und abgeleitete Keyclosure. | Keine Gesture, kein Preview, keine Session-/Dateioperation. |
| Pure Command→Document-Projektion | Eingefrorenes Dokument plus ein vom vorhandenen Konturplaner validiertes `Command`; nur für eine Proposalberechnung. | Neues vollständig validiertes immutable `MapDocument`. | Kein `Session.execute`, kein eigener Historystack und keine duplizierte Portal-/Reihenfolgesemantik. |
| Dungeon-Gesturezustand | Begin bis Cancel oder Handoff; hält nur die für Adresse, Pointer und Proposal nötigen flüchtigen Werte. | Aktuelles Preview oder noch nicht ausgeführter Dungeonbeitrag. | Keine Source-, History-, Draft-, Repository-, Vault- oder Dateimutation. Die noch offene Basisgültigkeit wird hier nicht vorweggenommen. |
| `SpatialCanvas` | Liest tatsächliche räumliche Sources und optional genau einen ownergebundenen Previewoverride für einen Draw/Hit-Zyklus. | Darstellung, Grip und Treffer in derselben relativen Kamera. | Keine zweite Kamera, kein Sourcewrite und keine Finalisierung. |
| Atlas-Editor | Besitzt Begin/Update/Cancel und gibt bei erfolgreichem Abschluss höchstens einen Beitrag weiter. | UI-Zustand und Handoff an den bestehenden Orchestrator. | Kein eigener Dungeon-Execute, Save oder Sessioncommit. |
| PR-#13-Orchestrator | Empfängt noch nicht ausgeführte Beiträge tatsächlicher Owner für genau einen vollständigen Befehl. | Erst `check()` auf dem vollständigen Befehl, danach genau ein `execute()` auf demselben Befehl. | Kein Teilcommit, keine zweite History und keine stellvertretende Domainautorität. |

Diese Tabelle ordnet vorhandene Verantwortlichkeiten; sie führt keine zweite
Source-, Transform-, History- oder Persistenzarchitektur ein. Der konkrete
Freshnessvertrag der Gesturebasis bleibt ausschließlich der offene
`DUN-GEO-P01-R01-01`-Gegenstand.

## Gesture- und Vorschaulebensdauer

1. Pointer-down im Select-Werkzeug trifft Room31 und zusätzlich einen
   expliziten äußeren Vertexgrip. Der Editor friert Owner/Floor/Room,
   Kontur-/Punktadresse, Gripkoordinate, Sourcebytes, Frame und Pointerstart
   ein. Ein normaler Raumtreffer ohne Grip behält sein heutiges Verhalten.
2. Pointer-move wird mit dem eingefrorenen Frame und derselben relativen
   Kamera in Dungeonfelder zurückprojiziert. Update berechnet rein ein neues
   Proposal. `SpatialCanvas` liest dessen `preview` als ownergebundenen
   Dokumentoverride; Source und `AtlasHistory` bleiben unangetastet.
3. Escape, `pointercancel`, Fenster-`blur`, Tool-/Source-/Dokumentwechsel und
   ein explizites Cancel löschen nur Gesture und Preview. Nach Cancel darf ein
   verspätetes Pointer-up nichts finalisieren.
4. Pointer-up finalisiert nicht selbst. Der Editor übergibt höchstens den
   eingefrorenen `AtlasChange` an den bestehenden PR-#13-Orchestrator. Dieser
   setzt ihn mit den tatsächlichen anderen Ownerbeiträgen zu einem Befehl
   zusammen, ruft `check()` auf diesem Gesamtbefehl und anschließend genau
   einmal `execute()` auf demselben Gesamtbefehl auf.
5. Save, Draft, Journal, Copy/Discard und frischer Prozess konsumieren danach
   unverändert die bereits registrierten tatsächlichen Sources und den
   vorhandenen Repository-/FileTransaction-Weg.

## Verbindliche Validierungsorakel

Die aktive Fixture `e2e01-spatial-v2` adressiert exakt:

- Dokument `00000000-0000-4000-8000-000000000030`;
- Room `00000000-0000-4000-8000-000000000031`;
- Floor `00000000-0000-4000-8000-000000000032`;
- semantische Entrance-Route
  `00000000-0000-4000-8000-000000000033`;
- Keysection `00000000-0000-4000-8000-000000000034`.

Für I01 gelten alle folgenden Orakel:

1. **Adress- und Sperrprüfung:** falscher oder inzwischen anderer Owner,
   Floor, Room, Kontur, Punkt, Gripkoordinate, nicht äußerer Ring, gelöschter
   Datensatz, locked Room sowie nicht endliche Koordinaten werden vor einem
   sichtbaren Proposal abgewiesen.
2. **Stale-Prüfung:** Die `before`-Bytes des finalen Change sind exakt die beim
   Begin eingefrorenen Sourcebytes. Hat sich der tatsächliche Owner geändert,
   muss spätestens `AtlasHistory.check()` kollisionsfrei vor jeder Wirkung
   scheitern. Die Ownerfunktion darf einen fremden aktuellen Snapshot nicht
   still als neues Before übernehmen.
3. **Topologie und Closure:** ungültige Polygone sowie nicht auflösbare oder
   inkonsistente abhängige Portalanker scheitern über denselben
   `planBuildingContourMutation`-/Dokumentvalidator wie der native Editor.
   `SpatialGraph.frame(..., prospectiveView)` prüft vor dem Gesamt-Execute die
   Owner-/Floor-/Room-/Route-Closure.
4. **Erhaltungsgrenze:** Dokument-, Floor-, Room-, Route- und Section-ID,
   Entity-/Floor-/Section-Reihenfolgen, Dokumentoptionen, nicht betroffene
   Entities und sämtliche unabhängigen Markdownbytes bleiben exakt. Erlaubt
   sind nur die eine Room-Außenkontur und die vom bestehenden Konturplaner
   tatsächlich abhängigen Portalanker.
5. **Preview/Cancel:** während Begin/Update/Cancel bleiben Sourcebytes,
   Keyclosure, `undoDepth`, `canRedo`, Repositorydirty, Draft, Dateien und jede
   Session unverändert. Escape, `pointercancel`, `blur` und Kontextwechsel
   entfernen die Vorschau; keine dieser Folgen erzeugt einen Change.
6. **Preview/Final-Kohärenz:** Das final serialisierte After-Dokument entspricht
   bytegenau dem zuletzt sichtbaren gültigen Preview. Ein Nullzug erzeugt
   weder Change noch Historieneintrag.
7. **Einmaligkeit:** Der vollständige Mehrownerbefehl wird zuerst als Ganzes
   geprüft und danach einmal ausgeführt. Der Dungeonbeitrag erzeugt keinen
   vorgelagerten Session- oder Atlas-Commit. Undo/Redo ist genau ein Schritt
   gemeinsam mit den im selben Befehl enthaltenen Ownerbeiträgen.
8. **Maßstab:** Der native Lauf rechnet ausschließlich über denselben
   `RigidFrame` mit `1.524 m/Feld`. Verschieben des gebundenen Hauses ändert
   die starre Projektion, nicht die gespeicherte Dungeonkontur.

## I01-Dateigrenze und Prüfplan

Voraussichtlicher I01-Besitz:

- neues `src/features/dungeon/geometry-change.ts`;
- eine eng extrahierte pure Command→Document-Projektion im vorhandenen
  Dungeon-/Session-Pfad statt einer zweiten Applikationslogik;
- `src/features/atlas/spatial-canvas.ts` nur für einen ownergebundenen
  Dungeon-Previewoverride und Vertexgripdarstellung;
- `src/features/atlas/atlas-editor.ts` nur für Begin/Update/Cancel/Handoff;
- fokussierte Core- und DOM-Regressionen in den vorhandenen Testsammlungen.

Coretests frieren Sourcebytes, Closure, Historytiefen und Dateidoubles vor
jeder Folge ein. Positive Fälle prüfen Grip, Update, bytegleichen
Preview/Final-Stand, abhängigen Portal-Follow und genau einen komponierten
Undo/Redo-Schritt. Negative Tabellen decken jede Adress-/Stale-/Locked-/
Topologie-/Closure-Grenze sowie Escape, `pointercancel`, `blur`, Sourcewechsel
und verspätetes Pointer-up ab. Ein Instrumentierungsfall verbietet
`Session.execute`, `AtlasHistory.execute`, Repository- und Dateiaufrufe während
Begin/Update/Cancel. Die aktive v2-Fixture und ihre nicht betroffenen SHA-/
Markdownwerte werden vor und nach dem komponierten Corefall verglichen.

I01 erhält `npm run check`, fokussierte Regressionen, vollständiges `npm test`
und `npm run build`. Ein später erforderlicher Hostlauf gehört erst nach
unabhängigem Code-Review in ein getrenntes Paket; er benutzt den vereinbarten
isolierten Host. Dieser P01-Planlauf startet keine GUI und führt mangels
Produktänderung keine Produktbasisprüfung als Funktionsbeleg an.

## Phasen, Gates und Übergabe

| Lauf | Aktueller Status | Öffnet ausschließlich | Öffnet ausdrücklich nicht |
| --- | --- | --- | --- |
| P01 `ea46ba5437…` | abgeschlossenes Planartefakt | unabhängigen P01-R01 | Produkt-I01 oder E2E-01 |
| P01-R01 | `CHANGES_REQUIRED`, genau `DUN-GEO-P01-R01-01` | getrennte dokumentierte Nacharbeit | Portimplementierung |
| CL-P01 `e01622170d…` | abgeschlossen | CL-I01 | Fachreparatur |
| CL-I01 | laufende Vertragsartefaktbereinigung | unabhängigen CL-R01 auf Exact-SHA | N01, Produktcode oder Self-Merge |
| CL-R01 | offen | bei PASS den getrennten N01-Lauf | Produkt-I01 |
| N01 / P01-R02 | offen; nur der eine Parent-/Bindingbasis-Befund | bei unabhängigem Exact-SHA-PASS Produkt-I01 | Host- oder E2E-Go |
| Produkt-I01 | geschlossen | nach Basisprüfungen den unabhängigen Code-R01 | Stewardintegration ohne Review |
| Code-R01 und nötige N01/R02 | offen | erst bei PASS den geprüften Owner-SHA | fremde Domainratifikation |
| Steward-Handoff | offen | Übernahme des geprüften Owner-SHA in den einzigen PR-#13-Kandidaten | zweiten Kandidaten oder Dungeon-eigenes Execute |
| Produkt-Cleanup-P/I/R | offen und weiterhin nach der Funktionsabnahme | ausschließlich bereinigten geprüften Produktstand | Gesamtfreigabe |

Der Hex-E2E-01-Steward besitzt die Mehrownerkomposition; der Dungeon-Strang
ratifiziert keine fremden Owner. Campaign/Data, P02/P04, vollständiger
E2E-01-Lauf, Originalparität, große Welt, physische Eingabe und
Nutzervaultinstallation bleiben ausdrücklich offen.
