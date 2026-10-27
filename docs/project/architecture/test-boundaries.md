# Tests an Fachanschlüssen und überprüfbare Modulgrenzen

Status: Current; bestehende Kopplungen und offene Qualifikation ausdrücklich benannt.
Owner: project
Last Reviewed: 2026-10-27
Source of Truth: Benannte Produktionsanschlüsse, `tools/module-responsibilities.mjs`, `tools/check-module-boundaries.mjs` und die ausführbaren TypeScript-Umgebungsprüfungen.

## Ausführbare Fachinstanzen

Die Arbeitsflächenaktivierung gehört `createWorkspaceActivation`, die Rückkehr in
Ansichten `createWorkspaceViewOpener`. Der Renderer verbindet diese Instanzen mit
den tatsächlichen Editoren, Preload-Aufrufen, Elementen und Scrollpositionen.
Die Aktivierung besitzt Warteschlange, Schreibsperre, Quell-Drain und spätere
Aktivierungsabsicht. Die Öffnung besitzt die Gültigkeit später Atlasfehler und
Scrollrückbindungen; auf andere Bereiche wird weiterhin gewartet. Fachliche
Writes bleiben beim jeweiligen Editor und Store.

`desktop-editor-activation.test.mjs` und `desktop-atlas-opening.test.mjs` laden
jetzt diese vollständigen Produktionsmodule. Sie schneiden keine Funktionen aus
`renderer.ts` heraus und erfinden deren lokale Variablen nicht nach. Ein interner
Funktionsname oder eine Verschiebung innerhalb des Anschlusses ist damit kein
Testvertrag mehr. Die Tests behalten fehlgeschlagenes Laden mit Wiederholung,
abgewiesenen Drain, konkurrierende Kampagnenabsichten, entfernte Arbeitsflächen,
nicht blockierende Atlasöffnung und verspätete Fehler. Zusätzlich prüfen sie die
Eigentümerschaft verzögerter Scrollwiederherstellung. Native Proben prüfen die
Zusammensetzung des tatsächlichen Renderers, die isolierten Tests den Fehlerpfad.

Fachliche Fixtures und Assertions bleiben in ihren bisherigen Testdateien.
Gemeinsame Helfer bauen Module, stellen DOM-Technik bereit oder prüfen echte
Quellstruktur. Der ungenutzte Funktionsausschneider `sourceFunctions` entfällt.
Quellprüfung für verbotene Imports, Preload-/Sicherheitsgrenzen, Einstiegspunkte
und deklarierte Markupstruktur bleibt sinnvoll. Die historische Obsidian-
Hostprobe verwendet noch einen ausgeschnittenen Shutdown-Ablauf; sie gehört
nicht zum aktiven Desktop-Anschluss und wurde hier nicht umgebaut. Das ist keine
Behauptung, sämtliche historische Quellproben seien bereits beseitigt.

## Benannte Zuständigkeiten und Zyklen

`module-responsibilities.mjs` benennt Arbeitsflächenzusammensetzung,
Vorbereitungs-/Live-/Kampfeditor, Editoroberfläche, Editorlebenszyklus,
Buchungsbelege, kanonischen Speicher und nativen Host. Explizite Besitzer haben
Vorrang vor älteren Dateinamensheuristiken: `storage/preparation.ts` und
`storage/live.ts` sind Speicher, `runtime/combat.ts` ist Darstellung.
Noch nicht erfasste Oberflächen behalten die bisherigen Suffix-/DOM-Prüfungen.

Die Importprüfung verfolgt auch indirekte Imports, Reexports, dynamische
Literalimports, `require` und Typimporte. Renderer dürfen keine nativen oder
kanonischen Speicherfähigkeiten erreichen; reine benannte Fachbesitzer keine
Darstellung, Speicher- oder Hostfähigkeit. Speicher darf keinen ausdrücklich
benannten Oberflächen-/Hostbesitzer erreichen. Diese Ergänzung ersetzt keine
vollständige Typtrennung sämtlicher historischer Darstellungsmodelle.

Der ursprüngliche Ausgangspunkt ist `7ef54e44c295f4adf6cf3800e27f45aa8ad0a0b3`.
Die Baseline wurde nach der Trennung ausdrücklich verkleinert; sie wird bei
Prüfläufen niemals automatisch erweitert. Neue zyklische Kanten, einschließlich
neuer Kanten innerhalb einer bekannten Komponente, bleiben Fehler.

`shared/contracts.ts` enthält nur grundlegende Datenverträge. Die Zusammensetzung
aller Fach-APIs gehört `shared/desktop-api.ts`, die Browserdeklaration
`shared/campaign-window.d.ts`, Raumvalidierung `shared/room-validation.ts`.
`DeskRef` und rohe Textpositionen haben eigene kleine Module. Keines dieser
Grundmodule zieht den vollständigen Desktopvertrag zurück in seine Abhängigkeiten.

Die Wertzyklen Landschaft/Höhen/Masken und Pfadmodell/räumliche Auswertung sind
aufgelöst: `landscape-geometry.ts` besitzt gemeinsame Geometrie,
`path-anchor.ts` gemeinsame Pfadanker. `atlas-drawing-mesh.ts` besitzt den
Meshvertrag, `party-command-contracts.ts` die benötigten Live-Befehle; die
bisherigen Drawing/Route- und Live/Party-Typzyklen entfallen.

| Verbleibende Komponente | Grenze |
| --- | --- |
| 79 Fach-/Atlas-/Vertragsdateien | Der frühere 119-Dateien-Verbund ist kleiner; `shared/contracts` und die Desktop-API gehören nicht mehr dazu. Gegenseitige Fachmodelltypen bleiben gekoppelt. Dies ist keine Behauptung eines vollständig azyklischen Typgraphen. |
| Notiz-/Vorbereitungsverträge (4 Dateien) und Kampfverträge/-initiative (3 Dateien) | Aus dem alten großen Verbund abgetrennte Typkomponenten; keine neuen Wertzyklen. |
| Speichergruppe um `campaign-atlas`, `live`, `session`, `world` | 36 Dateien im Gesamtgraphen, 35 im Wertgraphen. Die fachübergreifenden Writer wurden nicht neu entworfen. |
| `storage/dungeon-key` / `storage/surfaces` | Bestehende Speicherabhängigkeit bleibt. |

Der aktuelle Gesamtgraph hat fünf Komponenten mit 124 Dateien und 368 internen
Kanten; der Wertgraph zwei Komponenten mit 37 Dateien und 109 Kanten. Zuvor waren
es 164 Dateien/533 Kanten beziehungsweise 43 Dateien/117 Kanten. Im Gesamtgraphen
ersetzen 15 Kanten zum/aus dem ausgezogenen Geometrieeigentümer frühere
Landschaftskanten; dies ist eine explizite Eigentümerverschiebung, keine pauschale
Freigabe neuer Kopplungen. Der Wertgraph enthält ausschließlich eine echte
Teilmenge der alten Baseline. Die Baseline ist keine zweite Testzuordnung.

## Vollständige Einstiegspunkte und Umgebungsprüfung

`npm run check` führt die vollständige Projektprüfung und `check:environments`
aus. Jede Konfiguration prüft die folgenden produktiven Einstiege einschließlich
ihrer gesamten transitiven Quellen:

| Konfiguration | Einstiege | Fähigkeiten |
| --- | --- | --- |
| `tsconfig.renderer.json` | Spielleiter, Spieleranzeige, Preseteinstellungen, Atlas-Deck-Runtime | ES2022/DOM; eigene Quellen zusätzlich semantisch gegen Node-Fähigkeiten geprüft |
| `tsconfig.worker.json` | Store-, Regions-, Raumverzeichnis-, Terrainroute- und Backupvalidierungsworker | ES2022/Node, kein DOM |
| `tsconfig.browser-worker.json` | Atlas-Brush-Worker | ES2022/WebWorker, kein Window/Document oder Node |
| `tsconfig.host.json` | Main, beide Preloads, Updatehelper und Updateprobe | ES2022/Node und Electron-Verträge; getrennt von Node-Workern |
| `tsconfig.domain.json` | Editorübergang, Belege, Würfel, Atlaskamera, Rasterkernel, Literaltexte und Raumvalidierung | ES2022, weder Node noch DOM |

Die Build-Einstiegsinventur `desktop-entry-environments.mjs` wird vom echten
Desktopbuild geprüft: unbekannte, falsch zugeordnete oder nicht gebaute Einstiege
brechen ab. Der Umgebungstest verlangt jeden Einstieg in seiner Konfiguration.

Die vollständigen Browserquellen erreichen weiterhin transitive Node-Deklarationen
über die Fremdbibliothek `apache-arrow`. `types: []` alleine ist deshalb kein
Schutznachweis. `check-environment-capabilities.mjs` prüft mit dem echten
TypeScript-Symbolauflöser sämtliche eigenen Browserquellen auf Verwendung von
Node-Deklarationen und native Imports, auch bei globalen Eigenschafts-/Indexzugriffen.
Fremdbibliotheksdeklarationen werden nicht als eigene Browserfähigkeiten zugelassen.
Die produktiven Atlasquellen werden weder ausgeschlossen noch durch `any`-Attrappen
ersetzt. Typprüfung und semantische Fähigkeitsprüfung bilden gemeinsam das Gate.
Die Negativtests verwenden die echte vollständige Konfiguration und injizierte
Prüfquellen; sie prüfen direkte, aliasierte und indizierte Node-Zugriffe sowie
unzulässige Globals in den anderen Umgebungen.

Der Höhenkachelcodec verwendet nun in Node und Browser denselben `atob`-Pfad;
Bytes, Validierung und gespeichertes Format bleiben gleich. Canvas-Textmessung
gehört ausschließlich `map-text-measure.ts`; die Browseransicht und ihr Export
verwenden diese Messung, umgebungsfreie Leser behalten die deterministische
Ersatzmessung in `atlas-cartography.ts`.
Der Browser-Brush-Worker schützt seine Registrierung durch eine reine
Eigenschaftsprüfung; er benötigt dafür keine DOM-Deklaration von `document`.

Die `better-sqlite3`-Deklaration beschreibt den strukturellen Anschluss und gibt
ungeprüfte Zeilen/PRAGMA-Werte als `unknown` zurück. Betroffene Leser validieren
Felder mit `checkedRow`/`sqliteInteger`. Das beseitigt die pauschale Treiberattrappe;
ältere explizite `any`-Felder etwa im großen Store sind damit nicht vollständig
migriert. Editorlebenszyklus benötigt weiterhin `AbortController` und wird nicht
als reine ES2022-Fachlogik ausgegeben.

## Nachweise und Zuordnung

`tests/workspace/module-boundaries.test.mjs` und `module-graph.test.mjs` prüfen
positive und negative Strukturbeispiele, indirekte Grenzen, vorhandene und neue
Zyklen sowie Typ-/Wertunterschiede. `renderer-boundary.test.mjs` baut weiterhin
den tatsächlichen Renderer für den Browser. `atlas-brush-boundary.test.mjs` lädt die echten Browserbundles und prüft
registrierungsfreie Vorschau, Worker-Registrierung, Pixeltransfer und Fehlerantwort.
`desktop-atlas-paint.test.mjs` vergleicht Geometrie, Markup und DOM mit den
bestehenden Referenzen. Host-, Speicher- und Editorprüfungen
bleiben an ihren bisherigen Fachanschlüssen.

Benutzerabläufe und ihre tatsächlichen Testdateien werden ausschließlich im
Capability-Katalog verknüpft und mit `--geprueft` fortgeschrieben. Native
Raumöffnung, Atlasexport bei 100/200 % und passive Spielerfreigabe prüfen die
Rendererzusammensetzung. Die optionale dichte Stadt-/Regionsprobe, Installation,
veröffentlichte Pakete und menschliche Produktabnahme sind dadurch nicht belegt.

### Native Browsertrennung (2026-10-26)

`tools/test-desktop-brush-worker.mjs` lädt den ausgelieferten Worker im echten
Electron-App-Protokoll und prüft Pixelantwort, Fehlerantwort und einen weiteren
Auftrag nach dem Fehler, einschließlich regulärem Prozessende. Exportproben bei
100/200 % samt frischer Wiederöffnung und die normale Raumprobe bestehen.

Die relevante UI-Grenze prüft `tools/test-desktop-terrain-brush.mjs --preview-only`:
Eine native Geste senkt eine einfache, ungeschützte Insel unter den Meeresspiegel.
Der Pixelvergleich misst einen inneren Bereich oberhalb des Zeigers, außerhalb
von Cursor, Pinselrand und Tooltip, sowie einen unberührten Kontrollbereich.
Sichtbares Land muss bereits bei gedrücktem Zeiger zur Wasserfarbe des
Kontrollbereichs wechseln, während die kanonischen Höhendaten unverändert sind.
Pointer-up schreibt die Geste; ein Undo stellt Daten und Pixel wieder her,
Redo stellt beides erneut her. Kamera und Zielhöhe werden über die tatsächliche
Ansicht beziehungsweise stabile Fensterpixel begrenzt. Ready-Flags dienen nur
der Synchronisation, nicht als Sichtbarkeitsnachweis. Ein Gegenversuch mit
vorübergehend unterbrochenem `previewHeight`-Anschluss ausschließlich im lokalen
Testbundle scheitert an der Pixelassertion; das Originalbundle wurde danach
wiederhergestellt.

Die frühere Textannahme „Vorschau“ ist überholt. Der tatsächliche UI-Pfad läuft
über `LandscapeBrushSession` → `previewHeight` → `AtlasSurfaceDraft` und die
Rasterdarstellung. `TerrainDraftStroke` übergibt erst bei Pointer-up an die
Speicherqueue. „Malt direkt“ beschreibt lokale sichtbare Rückmeldung, keine
vorzeitige Speicherung. Der isolierte Browserworker besitzt einen separaten
Protokollnachweis und ersetzt diese UI-Probe nicht. Der begrenzte Modus lässt
die weiteren Assertions der umfassenden Probe bestehen, qualifiziert sie aber
nicht mit.

Die umfassende Höhenprobe bleibt offen: `test-desktop-height-workflow.mjs:178`
meldet am geschützten Punkt 50 statt 300 Meter. Derselbe Fehler wurde auf dem
sauberen, frisch gebauten Basiscommit `57d2f2f2f` reproduziert. Das unabhängige
Vorschau-Fixture benötigt diesen Feindetailschutz nicht. Die Raumprobe
protokolliert beim Schließen IPC-/Shutdown-Meldungen trotz bestandener Assertions
und drei regulärer Prozessenden. Verpackung, Installation und menschliche
Produktabnahme sind weiterhin nicht belegt.

### Prüfung der vollständigen Umgebungen (2026-10-27)

Die vier produktiven Browser-Einstiege und fünf Node-Worker werden vollständig
geprüft. Die Browserprüfung kombiniert echte Typdiagnosen und semantische
Fähigkeitsdiagnosen; sie behauptet keine Node-freie Fremdbibliotheksdeklaration.
`tests/shared/sqlite-driver.types.ts` sichert ab, dass native Zeilen und PRAGMA
keine ungeprüften Strings/Zahlen liefern. Der Transfervertrag behält alle
145 Modelle/602 Formen; nur der Quellname von `GraphPreviewState` wandert.

Der frühere Terrain-Fresh-Pixelvergleich wurde mit identischer Probe auf einem
frisch gebauten Export von `ee58456ab98ee74b064dc711284e3fbb972e693d` reproduziert.
Alle 2.109 exportierten Dateien wurden gegen ihre Git-Blob-IDs geprüft; einzig
die identische Probe enthält die bereits vorhandenen fremden Ergänzungen.
Auch dieser Ausgangsstand scheitert an derselben Fresh-Pixelassertion. Die
Abweichung wurde deshalb nicht durch die Vertrag-/Umgebungstrennung eingeführt.
Belege: `.build/qa-point3-baseline-fresh/source-provenance.json` und
`failure.json` (lokale, nicht versionierte Prüfarbeitsdaten).

Die Probe verglich nach erneutem Such-/Zoomablauf weiterhin die alten
Bildschirmkoordinaten. `terrain-pixel-comparison.mjs` ordnet nun die Messpunkte
anhand unabhängig gemessener Position und Maßstab beider Kameras denselben
Weltpositionen zu. Abtastbereich, Farbgrenze und zulässiger mittlerer Fehler
bleiben unverändert; fehlende Bildabdeckung bricht ab. Der Fresh-Kontrollbereich
wird zusätzlich verglichen. Vier Regressionstests prüfen Translation, Skalierung
mit räumlichem Farbverlauf, echte Terrainänderungen und fehlende Abdeckung.
Alle 20 zuvor vorhandenen fremden Ergänzungszeilen bleiben wörtlich erhalten.

Die korrigierte native Probe bei 100 % bestand auf dem aktuellen Produktbundle:
Vorschau vor Speicherung, Commit, unveränderte Kontrolle, Undo/Redo, frischer
Prozess, gespeicherte Höhen und identischer Kachelhash. Beide Fresh-Pixelvergleiche
meldeten mittleren Fehler 0; beide Prozesse schlossen regulär mit Exit 0 und
verschwundenem PID. Beleg: `.build/qa-point3-fresh-fixed/result.json`.
Dieser Lauf belegt den Modus Absenken bei 100 %, nicht sämtliche Pinselmodi.

Die native Spieler-Szenenprobe bestand anschließend auf dem neu gebauten Stand:
getrennte Spieler-API ohne Kampagnenbridge, wörtliche öffentliche Titel,
100/200-%-Layout, Blank und erneute Freigabe nach Neustart, unveränderte Quelle
und reguläres Schließen (`.build/qa-point3-player/privacy-scene-after.json`).
Sie qualifiziert diesen konkreten Ablauf, nicht sämtliche Atlasausgaben oder
alle Neustartpfade. Verpackung, Installation und menschliche Produktabnahme
wurden in diesem Änderungsschritt nicht durchgeführt.

Die oben dokumentierte Terrain-Fresh-Probe gehört zum gesonderten
Terrain-Skalierungsstand `ee58456ab`; dessen noch nicht integrierte Probe und
Kamerakorrektur bleiben im ursprünglichen Checkout erhalten. Der gemeinsame
Pixelvergleichshelfer und seine Regression sind unabhängig davon verfügbar.
Die Übergabeintegration übernimmt keine fremden Terrain-Skalierungsänderungen.
