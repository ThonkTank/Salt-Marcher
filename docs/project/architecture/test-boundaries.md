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
| 120 Fach-/Vertragsdateien einschließlich `shared/contracts` | Typgraph verbindet breite API- und Modellimporte; erschwert Umgebungsisolierung. Kein entsprechender 120-Dateien-Wertzyklus. |
| `atlas-drawing-geometry` / `atlas-route-geometry` | Gegenseitige Typabhängigkeit; keine Wertkomponente. |
| `live` / `party-topbar-ui` | Typabhängigkeit der UI-Anschlüsse; keine Wertkomponente. |
| `atlas-landscape` / `land-mask` / `terrain-height` | Drei Dateien im Wertgraphen; Daten-/Geometriehilfen greifen zurück. Bestehende Kopplung, nicht bereinigt. |
| `path-model` / `path-spatial` / `spatial-3d` | Drei Dateien in beiden Graphen; gemeinsame räumliche Auswertung. |
| Speichergruppe um `campaign-atlas`, `live`, `session`, `world` | 36 Dateien im Gesamtgraphen, 35 im Wertgraphen; unterschiedliche Writer und Projektionen sind weiterhin gekoppelt. Kein neuer allgemeiner Befehlsläufer als Umgehung. |
| `storage/dungeon-key` / `storage/surfaces` | Gegenseitige Speicherabhängigkeit in beiden Graphen. |

Insgesamt: sechs Komponenten mit 165 Dateien/536 internen Kanten einschließlich
Typimports; vier Wertkomponenten mit 43 Dateien/117 Kanten. Die neue
Arbeitsflächenaktivierung/-öffnung erzeugt keinen Zyklus. Die Baseline ist eine
Architekturgrenze, keine zweite Test- oder Capability-Zuordnung.

## TypeScript-Umgebungen: gemessener Nutzen und Grenze

`npm run check` behält die bisherige vollständige Typprüfung und führt zusätzlich
`check:environments` aus. Die drei Konfigurationen prüfen jeweils ihre expliziten
Einstiege **einschließlich transitiver Imports**:

| Konfiguration | Tatsächlich isolierter Umfang | Verfügbare Globals |
| --- | --- | --- |
| `tsconfig.renderer.json` | Editoroberfläche, Textposition, Zahlenrad, Popup und Arbeitsflächenposition | ES2022 und DOM, keine Node-Typen |
| `tsconfig.host.json` | CommitTracker, Storetransport, Atlas-Writeaktivität, Update-Manifest und SQLite-Anschluss | ES2022 und Node, kein DOM |
| `tsconfig.domain.json` | Editorübergang, Buchungsbeleg und Würfelformel | ES2022, weder DOM noch Node |

`typescript-environments.test.mjs` kompiliert jede echte Konfiguration mit einer
zusätzlichen virtuellen Prüfdatei. Browsercode akzeptiert `document` und weist
`process`, `Buffer`, `require` ab; Hostcode akzeptiert Node und weist `document`/
`window` ab; reine Fachlogik weist beides ab. Die Tests erwarten echte
Compilerdiagnosen. Eine neue transitive Typbibliothek, die verbotene Globals
wieder einführt, lässt diese Tests scheitern. Es gibt keine nachgebauten
Produktfunktionen und keine pauschalen globalen Attrappen.

Ein Versuch mit den **vollständigen** Renderer-Einstiegen und `types: []` ließ
`process` und `Buffer` weiterhin zu: Die Deklarationen von `apache-arrow` führen
über die Atlasdarstellung `@types/node` erneut ein. Ein vollständiger Host ohne
DOM scheiterte an gemeinsam importierten Canvas-/SVG-Modellen und dem
Browser-Brushworker. Auch `literal-text-edit` zieht über `DeskRef` den breiten
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
den tatsächlichen Renderer für den Browser. Host-, Speicher- und Editorprüfungen
bleiben an ihren bisherigen Fachanschlüssen.

Benutzerabläufe und ihre tatsächlichen Testdateien werden ausschließlich im
Capability-Katalog verknüpft und mit `--geprueft` fortgeschrieben. Native
Raumöffnung, Atlasexport bei 100/200 % und passive Spielerfreigabe prüfen die
Rendererzusammensetzung. Die optionale dichte Stadt-/Regionsprobe, Installation,
veröffentlichte Pakete und menschliche Produktabnahme sind dadurch nicht belegt.
