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
| `gesture state` | Flüchtiger Editorzustand zwischen Begin und Cancel/Handoff. Er gehört genau einer tatsächlichen Source-/History-/Graph-Lebensdauer und einer bei Begin eingefrorenen räumlichen Parentbasis. | Kein Sourcewert, kein Historieneintrag und keine persistente Sessionrevision. |
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
  basis: DungeonGeometryBasis;
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
| Dungeon-Gesturezustand | Begin bis Cancel oder Handoff; hält Adresse, Pointer, tatsächliche Source-/History-/Graph-Identitäten und die eingefrorene Parentbasis. Ein History-Abonnement macht jede zwischenzeitliche Änderung terminal stale. | Nur bei unveränderter Basis aktuelles Preview oder noch nicht ausgeführter Dungeonbeitrag. | Keine Source-, History-, Draft-, Repository-, Vault- oder Dateimutation; kein Auto-Rebase. |
| `SpatialCanvas` | Liest tatsächliche räumliche Sources und optional genau einen ownergebundenen Previewoverride für einen Draw/Hit-Zyklus. | Darstellung, Grip und Treffer in derselben relativen Kamera. | Keine zweite Kamera, kein Sourcewrite und keine Finalisierung. |
| Atlas-Editor | Besitzt Begin/Update/Cancel und gibt bei erfolgreichem Abschluss höchstens einen Beitrag weiter. | UI-Zustand und Handoff an den bestehenden Orchestrator. | Kein eigener Dungeon-Execute, Save oder Sessioncommit. |
| PR-#13-Orchestrator | Empfängt noch nicht ausgeführte Beiträge tatsächlicher Owner für genau einen vollständigen Befehl. | Erst `check()` auf dem vollständigen Befehl, danach genau ein `execute()` auf demselben Befehl. | Kein Teilcommit, keine zweite History und keine stellvertretende Domainautorität. |

Diese Tabelle ordnet vorhandene Verantwortlichkeiten; sie führt keine zweite
Source-, Transform-, History- oder Persistenzarchitektur ein.

## N01: tatsächliche Gesturebasis und ChangedBasis

`DUN-GEO-P01-R01-01` soll durch einen rein flüchtigen
`DungeonGeometryBasis`-Guard geschlossen werden; erst P01-R02 bestätigt die
Reparatur. Der Guard wird bei Begin aus den **heute
existierenden tatsächlichen Objekten und Records** gebildet und weder
persistiert noch als Campaign-/Worldrevision ausgegeben:

- Objektidentität von `TerrainSource`, `SpatialGraph`,
  `DungeonAtlasSource`, dem tatsächlichen `LocationSource`, gegebenenfalls
  `CitySource` und ihrer einen gemeinsamen `AtlasHistory`; der Resolver nutzt
  dafür die vorhandene Ownerregistry des Graphen, keine zweite Registry;
- Dungeonowner-ID und die kanonischen `documentBytes` des Begin-Snapshots;
- der vollständige `DungeonPlacement`-Record für dieses Dokument aus dem
  bestehenden `spatial`-Target, einschließlich Placement-ID, Parent,
  Anchor, Rotation, Surface-Floor und Entrances;
- der vollständige zugehörige `LocationPlacement`-Record aus dem bestehenden
  `placements`-Target;
- bei `city-building` zusätzlich der vollständige `CityPlacement`-Record und
  der exakte adressierte `CityBuilding`-Record mit ID, Footprint, Position,
  Rotation und Scale;
- der aus genau dieser Kette berechnete `RigidFrame` einschließlich
  `metersPerUnit` und `originUnits`.

Ein einziger reiner Resolver liest dieselbe Kette bei Begin, vor jedem neuen
Preview und unmittelbar vor Handoff erneut. Er verlangt dieselben Source-,
Graph- und Historyobjekte sowie strukturelle Gleichheit jedes genannten
Records, der Dungeonbytes und des Frames. Er leitet keine Revision aus
Payloads ab und akzeptiert keinen gleich aussehenden Ersatzadapter.

Zusätzlich abonniert der Gesturezustand beim Begin genau diese
`AtlasHistory`. Jede Benachrichtigung durch Execute, Undo oder Redo setzt ihn
terminal auf `changed-basis`, entfernt das Preview und löst das Abonnement.
Damit bleibt auch A→B→A stale: spätere Rückkehr zu strukturell gleichen
Records reaktiviert eine alte Geste nicht. Eine direkte Source-/Graph-/
History-Auswechslung mit bytegleichen Dungeondaten wird durch die
Objektidentitäten und den erneuten Resolververgleich erkannt.

`changed-basis` ist ein Abbruchzustand, kein Rebase. Update erzeugt danach
kein Preview; Handoff gibt keinen `AtlasChange` zurück; ein verspätetes
Pointer-up bleibt wirkungslos. Ein neuer Zug darf erst mit einem neuen Begin
auf der dann aktuellen Basis starten. Der Guard besitzt keine Execute-,
Save-, Draft-, Repository-, Vault- oder Dateioperation.

Der erfolgreiche Handoff prüft die Basis ein letztes Mal und läuft ohne
asynchronen Yield im selben Aufruf weiter zur bestehenden Komposition. Er
übergibt weiterhin **genau einen** Dungeon-`AtlasChange`; der Orchestrator
führt weiterhin den vollständigen Befehl durch ein `check()` und genau ein
`execute()`. Vor Handoff wird das History-Abonnement gelöst, sodass das
anschließende beabsichtigte gemeinsame Execute keinen bereits übergebenen
UI-Zustand reaktiviert. Es entsteht weder eine zweite Autorität noch ein
zweiter Commit.

## Gesture- und Vorschaulebensdauer

1. Pointer-down im Select-Werkzeug trifft Room31 und zusätzlich einen
   expliziten äußeren Vertexgrip. Der Editor friert Owner/Floor/Room,
   Kontur-/Punktadresse, Gripkoordinate, Sourcebytes, Pointerstart und die
   vollständige oben definierte Gesturebasis ein und aktiviert ihr
   History-Abonnement. Ein normaler Raumtreffer ohne Grip behält sein heutiges
   Verhalten.
2. Pointer-move prüft zuerst Source-/History-/Parentbasis. Nur bei Gleichheit
   wird mit dem eingefrorenen Frame und derselben relativen Kamera in
   Dungeonfelder zurückprojiziert und rein ein neues Proposal berechnet.
   `SpatialCanvas` liest dessen `preview` als ownergebundenen
   Dokumentoverride; Source und `AtlasHistory` bleiben unangetastet.
3. Ein Historyereignis oder ungleiche aktuelle Basis wechselt terminal auf
   `changed-basis` und entfernt Preview/Abonnement. Escape, `pointercancel`,
   Fenster-`blur`, Tool-/Source-/Dokumentwechsel und ein explizites Cancel
   tun dasselbe ohne Historywirkung. Nach jedem dieser Endzustände darf ein
   verspätetes Pointer-up nichts finalisieren.
4. Die Undo-/Redo-Aktion des Atlas-Editors bricht einen aktiven Dungeonzug vor
   dem Historyaufruf ab. Die angeforderte Historyaktion läuft danach normal;
   der Abbruch selbst erzeugt keinen Eintrag und leert insbesondere keinen
   vorhandenen Redostand.
5. Pointer-up finalisiert nicht selbst. Nach letzter Basisprüfung löst der
   Editor das Abonnement und übergibt höchstens den eingefrorenen einzelnen
   `AtlasChange` synchron an den bestehenden PR-#13-Orchestrator. Dieser setzt
   ihn mit tatsächlichen anderen Ownerbeiträgen zu einem Befehl zusammen,
   ruft `check()` auf diesem Gesamtbefehl und anschließend genau einmal
   `execute()` auf demselben Gesamtbefehl auf.
6. Save, Draft, Journal, Copy/Discard und frischer Prozess konsumieren danach
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
2. **Source-/Basis-Stale-Prüfung:** Die `before`-Bytes des finalen Change sind
   exakt die beim Begin eingefrorenen Sourcebytes. Source-, Graph- und
   Historyobjekte sowie DungeonPlacement/Binding, LocationPlacement,
   gegebenenfalls CityPlacement/House und berechneter Frame müssen bis zum
   Handoff dieselben bleiben. Historyereignis oder Vergleichsabweichung führt
   terminal zu `changed-basis`; kein Auto-Rebase und kein stilles Übernehmen
   eines bytegleichen Ersatzowners.
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

### N01-Pflichtrepros für I01

Jede Folge beginnt mit gültigem Room31/Floor32-Preview und endet mit exakten
Zähler-, Byte- und Dateivergleichen:

1. Haus105 verschieben, Geste beginnen, gemeinsames Undo der Hausbewegung,
   Update und verspätetes Pointer-up: Preview weg, kein Dungeonchange, Undo
   erzeugt den normalen Redostand und der Abbruch leert ihn nicht.
2. Dasselbe mit Redo sowie mit einer Locationbewegung. Ein Historyereignis
   invalidiert auch dann terminal, wenn A→B→A am Ende wieder dieselben Records
   und denselben Frame ergibt.
3. DungeonBinding/Anchor oder zugehöriges CityPlacement ändern, ohne die
   Dungeonbytes zu ändern: Update/Handoff blockiert; nach Rückkehr kein
   Wiederaufleben der alten Geste.
4. `DungeonAtlasSource`, `LocationSource`, gegebenenfalls `CitySource`,
   `TerrainSource`/`SpatialGraph` oder die gemeinsame `AtlasHistory` durch
   einen neuen Adapter mit identischen Dungeonbytes und strukturell gleichen
   Records ersetzen: alte Geste blockiert.
5. Nach jedem `changed-basis`, Escape, `pointercancel`, `blur` und
   Sourcewechsel ein late pointer-up senden: null AtlasChanges, gegenüber dem
   unmittelbar nach einer erlaubten Historyaktion gemessenen Stand keine
   zusätzliche Undo-/Redo-Änderung, kein Repositorydirty, kein Draft-/Datei-
   oder Journalwrite.
6. Anschließend auf der aktuellen Basis neu beginnen: Preview und finaler
   einzelner Dungeonchange verwenden denselben aktuellen Frame; gemeinsame
   `check`/einmalige-`execute`-Komposition und ein Undo/Redo-Schritt bleiben
   unverändert.

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
Topologie-/Closure-Grenze sowie sämtliche sechs N01-Pflichtrepros ab. Ein
Instrumentierungsfall verbietet
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
| CL-I01 `060abca843…` | abgeschlossen | unabhängigen CL-R01 auf Exact-SHA | N01, Produktcode oder Self-Merge |
| CL-R01 `060abca843…` | enger Dokumentations-PASS | den getrennten N01-Lauf | Produkt-I01 |
| N01 | dieser Planrepair; nur `DUN-GEO-P01-R01-01` | unabhängigen Exact-SHA-P01-R02 | Produkt-I01, Host- oder E2E-Go |
| P01-R02 `58c24b161a…` | unabhängiger enger PASS; nur Planrepair | Produkt-I01 | Host- oder E2E-Go |
| Produkt-I01 `400fb47e2f…` | Implementierungskandidat; check, 490/490 Tests und Build bestanden | unabhängigen Code-R01 | Stewardintegration ohne Review |
| Code-R01 `455b7e606f…` | `CHANGES_REQUIRED`, genau `DUN-GEO-I01-R01-01..03` | getrennten engen Produkt-N01 | Port-Handoff oder Cleanup |
| Produkt-N01 `7d3f0deaca…` | Reparaturkandidat; check, 494/494 Tests und Build bestanden | unabhängigen engen Code-R02 | Stewardintegration vor PASS |
| Code-R02 `cfe6e0e4db…` | `CHANGES_REQUIRED`; R01-02/03 geschlossen, ein Vor-`update()`-Pfad aus R01-01 offen | engen Produkt-N02 | Stewardintegration oder Cleanup |
| Produkt-N02 `26a29e816d…` | Restreparaturkandidat; check, 495/495 Tests und Build bestanden | unabhängigen engen Code-R03 | Stewardintegration vor PASS |
| Code-R03 | offen | erst bei PASS den geprüften Owner-SHA | fremde Domainratifikation |
| Steward-Handoff | offen | Übernahme des geprüften Owner-SHA in den einzigen PR-#13-Kandidaten | zweiten Kandidaten oder Dungeon-eigenes Execute |
| Produkt-Cleanup-P/I/R | offen und weiterhin nach der Funktionsabnahme | ausschließlich bereinigten geprüften Produktstand | Gesamtfreigabe |

Der Hex-E2E-01-Steward besitzt die Mehrownerkomposition; der Dungeon-Strang
ratifiziert keine fremden Owner. Campaign/Data, P02/P04, vollständiger
E2E-01-Lauf, Originalparität, große Welt, physische Eingabe und
Nutzervaultinstallation bleiben ausdrücklich offen.

## Produkt-I01-Ergebnis

Der Produktcommit `400fb47e2f9acfb15321b68a09ec5947b37c4c6a` setzt ausschließlich den
bestandenen Vertrag um. `DungeonGeometryGesture` besitzt Begin/Update/Cancel/
Handoff ohne Executor; `SpatialGraph.dungeonBasis()` liest die vorhandene
Ownerregistry und die vollständige Parentkette. `SpatialCanvas` überlagert
genau ein Dungeon-Preview in derselben Lesesicht und Kamera. Der Atlas-Editor
beendet die Geste bei History-, Tool-, Pointer-, Blur- und Kontextwechsel und
führt nach erfolgreichem Handoff denselben Ein-Change-Befehl durch `check()`
und einmal `execute()`.

Die fokussierten Regressionen bestätigen Parent-Undo bei identischen
Dungeonbytes, Binding-/Anchor- und A→B→A-Wechsel, bytegleiche Source-/Graph-/
Historyersetzung, late Handoff ohne Wirkung, normalen Redostand, Fresh Begin,
abhängigen Portal-Follow, unveränderte IDs/Markdownclosure und den vorhandenen
Maßstab 1,524 m/Feld. `npm run check`, `npm test` mit 490/490 Fällen und
`npm run build` bestanden. Fixturebytes wurden nicht geändert. Der darauf
folgende unabhängige Code-R01 verlangte die drei unten dokumentierten
Reparaturen; kein GUI- oder Hostlauf wurde ausgeführt.

## Produkt-N01-Ergebnis nach Code-R01

Der unabhängige Code-R01 auf Exact-SHA
`455b7e606f9b753043e8f8f94896f8ffd60924f8` forderte ausschließlich drei
Reparaturen. Produktcommit `7d3f0deaca89f5bb2667a1478047475d9e28bee3`
adressiert diese Grenzen ohne neuen Portumfang:

- `DungeonGeometryGesture.update()` verwirft vor jedem Sample das bisherige
  Proposal. Nullsegment-, sonstige Topologie- und nicht-finite Ablehnungen
  lassen daher dieselbe leere Sicht für Preview und Handoff zurück; ein später
  gültiges Sample kann ausschließlich seinen aktuell sichtbaren Stand liefern.
- Der bei Begin tatsächlich getroffene Pointer wird als immutable Wert
  gehalten und bleibt der Delta-Ursprung für off-center, Rückkehr und Snap.
- `projectRecordChanges()` ist die eine reine RecordChange-Prüfungs- und
  Anwendungsgrenze für `projectDocumentCommand()` und `Session.apply()`;
  beide verwenden außerdem dieselbe Indexergänzung und Reihenfolgelogik.

Die fokussierten Regressionen reproduzieren valid→Nullsegment/non-finite→
release ohne Source-, History- oder Redowirkung, Korrektur auf ein neues
sichtbares Proposal, off-center/Rückkehr/Nullzug mit und ohne Snap sowie den
gleichen Kontur-/Portalcommand über pure Projektion und native Session mit
identischen Bytes, Kennungsreihenfolge und stale-/invalid-Ablehnung.
`npm run check`, `npm test` mit 494/494 Fällen, `npm run build` und
`git diff --check` bestanden. Fixturebytes wurden nicht geändert. Code-R02,
Cleanup-P/I/R, GUI-/Host-/physische Eingabe und E2E-01 bleiben ausdrücklich
offen; der N01-Kandidat ist noch kein Steward-Handoff oder Produkt-Go.

## Produkt-N02-Ergebnis nach Code-R02

Der unabhängige Code-R02 auf Exact-SHA
`cfe6e0e4db95176c42c8b19c4096c27eae627e53` bestätigte R01-02 und
R01-03. Offen blieb ausschließlich ein Pfad aus R01-01: Im tatsächlichen
`AtlasEditor.bind()` konnte `unprojectLocal()` vor `gesture.update()` werfen.
Der Catch entfernte dann nur die sichtbare Vorschau, während Pointer-up das
ältere Proposal weiter finalisieren konnte.

Produktcommit `26a29e816d23a2a08a0e932a2cb60f78b080651b` ergänzt dafür genau eine
enge Grenze. `DungeonGeometryGesture.rejectSample()` widerruft nur das aktuelle
Proposal einer weiterhin aktiven Geste. Der bestehende Dungeon-Pointermove ruft
diese Grenze im Catch vor dem Leeren der sichtbaren Vorschau auf. Erfolgreiche
Updates, Beginpointer-, RecordChange-, Basis-, History- und Handoff-Semantik
bleiben unverändert.

Die fokussierte Regression registriert die tatsächlichen `bind()`-Callbacks,
erzeugt eine gültige Vorschau, löst anschließend mit einem synthetischen
nicht-finiten Pointer den Umrechnungsfehler vor `update()` aus und sendet den
tatsächlichen Pointer-up. Dungeonbytes, Undo-Tiefe, vorhandenes Redo und
Draftsignal bleiben unverändert; ein frischer Begin kann danach wieder ein
gültiges Proposal erzeugen. `npm run check`, `npm test` mit 495/495 Fällen,
`npm run build` und `git diff --check` bestanden. Code-R03, Cleanup-P/I/R,
GUI-/Host-/physische Eingabe und E2E-01 bleiben offen; N02 ist kein
Steward-Handoff oder Produkt-Go.
