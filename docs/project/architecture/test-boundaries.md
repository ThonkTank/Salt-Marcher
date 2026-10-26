# Tests an Fachanschlüssen und überprüfbare Modulgrenzen

Status: Current; bestehende Kopplungen und offene Qualifikation ausdrücklich benannt.
Owner: project
Last Reviewed: 2026-10-26
Source of Truth: Benannte Produktionsanschlüsse, `tools/module-responsibilities.mjs`, `tools/check-module-boundaries.mjs` und die drei zusätzlichen TypeScript-Konfigurationen.

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

Der geprüfte Ausgangspunkt ist `7ef54e44c295f4adf6cf3800e27f45aa8ad0a0b3`.
`module-cycle-baseline.json` bewahrt ausschließlich seine zyklischen Kanten,
getrennt nach sämtlichen deklarierten Imports und nicht ausdrücklich typreinen
Imports. Letztere sind eine konservative Wertimportanalyse, kein Nachweis, dass
TypeScript jede dieser Kanten im Bundle erhält. Beide Graphen werden geprüft:
Neue Kanten innerhalb alter Komponenten und die Umwandlung reiner Typzyklen in
Wertzyklen sind ebenfalls Fehler. Entfernen ist erlaubt; die Baseline wird nicht
bei einem Prüflauf automatisch erweitert.

| Vorhandene stark verbundene Komponente | Einordnung |
| --- | --- |
| 119 Fach-/Vertragsdateien einschließlich `shared/contracts` | Typgraph verbindet breite API- und Modellimporte; erschwert Umgebungsisolierung. Kein entsprechender 119-Dateien-Wertzyklus. |
| `atlas-drawing-geometry` / `atlas-route-geometry` | Gegenseitige Typabhängigkeit; keine Wertkomponente. |
| `live` / `party-topbar-ui` | Typabhängigkeit der UI-Anschlüsse; keine Wertkomponente. |
| `atlas-landscape` / `land-mask` / `terrain-height` | Drei Dateien im Wertgraphen; Daten-/Geometriehilfen greifen zurück. Bestehende Kopplung, nicht bereinigt. |
| `path-model` / `path-spatial` / `spatial-3d` | Drei Dateien in beiden Graphen; gemeinsame räumliche Auswertung. |
| Speichergruppe um `campaign-atlas`, `live`, `session`, `world` | 36 Dateien im Gesamtgraphen, 35 im Wertgraphen; unterschiedliche Writer und Projektionen sind weiterhin gekoppelt. Kein neuer allgemeiner Befehlsläufer als Umgehung. |
| `storage/dungeon-key` / `storage/surfaces` | Gegenseitige Speicherabhängigkeit in beiden Graphen. |

Insgesamt: sechs Komponenten mit 164 Dateien/533 internen Kanten einschließlich
Typimports; vier Wertkomponenten mit 43 Dateien/117 Kanten. Die neue
Arbeitsflächenaktivierung/-öffnung erzeugt keinen Zyklus. Bei der Browsertrennung entfielen ausschließlich die drei zyklischen Kanten
`atlas-camera → shared/contracts`, `terrain-coverage → atlas-camera` und
`terrain-spatial-model → atlas-camera`; die Baseline wurde entsprechend verkleinert.
Die Baseline ist eine
Architekturgrenze, keine zweite Test- oder Capability-Zuordnung.

## TypeScript-Umgebungen: gemessener Nutzen und Grenze

`npm run check` behält die bisherige vollständige Typprüfung und führt zusätzlich
`check:environments` aus. Die drei Konfigurationen prüfen jeweils ihre expliziten
Einstiege **einschließlich transitiver Imports**:

| Konfiguration | Tatsächlich isolierter Umfang | Verfügbare Globals |
| --- | --- | --- |
| `tsconfig.renderer.json` | Editoroberfläche, Textposition, Zahlenrad, Popup und Arbeitsflächenposition und passiver Karten-Canvas | ES2022 und DOM, keine Node-Typen |
| `tsconfig.host.json` | CommitTracker, Storetransport, Atlas-Writeaktivität, Update-Manifest, SQLite-Anschluss, SVG-Markup, Raum-/Stadtgeometrie und reine Brush-Vorschau | ES2022 und Node, kein DOM |
| `tsconfig.domain.json` | Editorübergang, Buchungsbeleg, Würfelformel, Atlaskamera und Rasterkernel | ES2022, weder DOM noch Node |

Die transitive Prüfung umfasst nach dieser Trennung 9 eigene Quelldateien im
Fachbereich, 161 im Hostbereich und 7 im Rendererbereich. Fachbereich und Host
laden keine DOM-Bibliothek; Fachbereich und Renderer laden keine Node-Deklarationen.
Diese Zahlen zählen Quellabschlüsse der expliziten Einstiege, keine vollständige
Produktqualifikation.

`typescript-environments.test.mjs` kompiliert jede echte Konfiguration mit einer
zusätzlichen virtuellen Prüfdatei. Browsercode akzeptiert `document` und weist
`process`, `Buffer`, `require` ab; Hostcode akzeptiert Node und weist `document`/
`window`, Canvas-/SVG-Globals und `self` ab; reine Fachlogik weist beides ab. Die Tests erwarten echte
Compilerdiagnosen. Eine neue transitive Typbibliothek, die verbotene Globals
wieder einführt, lässt diese Tests scheitern. Es gibt keine nachgebauten
Produktfunktionen und keine pauschalen globalen Attrappen.

Ein Versuch mit den **vollständigen** Renderer-Einstiegen und `types: []` ließ
`process` und `Buffer` weiterhin zu: Die Deklarationen von `apache-arrow` führen
über die Atlasdarstellung `@types/node` erneut ein. Die konkreten Canvas-/SVG-/Worker-Bindungen der gemeinsamen Geometrie sind
jetzt getrennt: `CanvasBox` gehört `atlas-camera`, das Paint-Protokoll verwendet
eigene literale Datenwerte, `atlas-paint-svg` serialisiert ausschließlich Markup,
`atlas-paint-dom` erzeugt DOM-Knoten und nur `atlas-brush-worker` registriert
Browsernachrichten. Speicherprojektion und Tests verwenden `atlas-brush-preview`.
Die genannten produktiven Geometrie-/Markup-/Vorschaueinstiege bestehen mit
transitiven Imports ohne DOM. Dafür wurden keine Ersatzglobals, `any`-Shims oder
weiteren Typbibliotheken zugeschaltet.

Die vollständigen Store-/Regionsworker sind damit noch nicht isoliert: Sie
erreichen weiterhin die vorhandene schwache `better-sqlite3`-Deklaration und die
Canvas-Textmessung in `atlas-cartography`. Auch eine vollständige Node-freie
Rendererprüfung bleibt offen: Neben `apache-arrow` verwendet der transitive
Höhencodec `terrain-height` einen direkten `Buffer`-Schnellpfad mit Browserfallback.
Dieser Abschnitt ändert weder Codec noch Textmessung. Auch `literal-text-edit` zieht über `DeskRef` den breiten
Vertragsgraphen ein; `EditorSession` benötigt `AbortController`, das nicht zu
ES2022 gehört. Deshalb werden diese Bereiche nicht als rein umgebungsisoliert
ausgegeben. Globale Ersatzdeklarationen oder pauschales Wiederzuschalten von DOM
würden den gewünschten Fehlernachweis aufheben. Die benannten Teilprüfungen
bringen den oben gemessenen Nutzen; die bisherigen vollständigen Checks und
Importgrenzen bleiben für den übrigen Code bestehen.

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

Die umfassende Höhenprobe bleibt offen: `test-desktop-height-workflow.mjs:178`
meldet am geschützten Punkt 50 statt 300 Meter. Derselbe Fehler wurde auf dem
sauberen, frisch gebauten Basiscommit `57d2f2f2f` reproduziert. Die ältere
`test-desktop-terrain-brush.mjs:285` läuft beim Warten auf den Text „Vorschau“ in
einen Timeout; die aktuelle Oberfläche malt direkt, und ihr Höhenvorschauwert
wird nur zurückgesetzt. Beide Proben zählen nicht als bestanden. Die Raumprobe
protokolliert beim Schließen IPC-/Shutdown-Meldungen trotz bestandener Assertions
und drei regulärer Prozessenden. Die gezielte Workerprobe ersetzt weder diese
offenen Abläufe noch Verpackung, Installation oder menschliche Produktabnahme.
