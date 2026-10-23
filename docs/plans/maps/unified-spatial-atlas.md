# Roadmap: neuer Atlas-Kern mit allen acht Ansätzen

Verbindlicher Plan vom 23.10.2026. Er ersetzt die bisherige technische Atlas-Roadmap
und deren nächsten Arbeitsauftrag. Alle acht Ansätze werden fest integriert;
Ansatz 6 wurde auf Nutzerauftrag durch eine metrische Atlas-Kamera mit stabilen
Weltkacheln ersetzt. deck.gl und WASM bleiben Produktbestandteile. Die bisherige
MapLibre-Pflicht ist ausdrücklich aufgehoben.
Der [vorherige Stand](https://github.com/ThonkTank/Salt-Marcher/blob/d3d31363fc40cff1f0f2f5d0b6699dacd54e8b30/docs/plans/maps/unified-spatial-atlas.md)
bleibt als historischer Nachweis erhalten. Dieser Plan ist kein Implementierungs-
oder Leistungsnachweis.

## Ziel und verbindliche Entscheidungen

Der Atlas erhält eine zusammenhängende neue technische Grundlage für flüssige
Navigation und unmittelbare Bearbeitung von Welt bis Innenraum. Alle acht
besprochenen Ansätze werden produktiv integriert: persistente Detailstufen,
GPU-Terrain, gebündelte Objektgeometrie, entkoppelte Bearbeitung, neue
Auftragsverarbeitung, metrische Kamera und stabile Weltkacheln, deck.gl und WASM.

**Die Atlas-Kamera besitzt Navigation und Projektion; deck.gl zeichnet direkt
in einer gemeinsamen Kartenfläche.** Der bisherige Atlas bleibt während der Entwicklung als lauffähige
Referenz erhalten. Nach vollständiger Ablösung werden ersetzte Produktpfade entfernt.
Diese Datei bleibt die einzige aktuelle technische Atlas-Roadmap; es entsteht keine
zusätzliche parallele Roadmap unter einem neuen Dateinamen.

## Aktueller Arbeitsstand

- **Aktive Etappe:** M2 – persistente Darstellungspyramide aufbauen.
- **Status:** M0 und der isolierte M1-Kern abgeschlossen; M2–M8 offen. [Aktuelle Ausgangsmessungen und Etappenprüfung](../../reference/atlas-rebuild-m0-20261023/README.md)
  sowie [vollständige Übernahmeliste](../../reference/atlas-rebuild-m0-20261023/inventory.md)
  liegen vor. Produktcode und Leistungsstand sind durch M0 noch nicht verbessert.
- **Ausgangsreferenz:** Repositorystand `d3d31363fc40cff1f0f2f5d0b6699dacd54e8b30`;
  in M0 nach Fetch als aktueller Main-Stand bestätigt, native Proben regulär beendet.
- **Vorhandene Belege:** [Asterfall und feste Ansichten](../../reference/atlas-workflow-20261023/README.md),
  [persistenter Index](../../reference/atlas-persistent-index-20261022/README.md),
  [GPU-Detaildarstellung](../../reference/atlas-gpu-detail-20261022/README.md).
  Diese historischen Messungen sind keine neue Baseline.
- **M0-Ergebnis:** Auf dem Entwicklungsrechner Navigation p95 22,1 ms;
  zwei Pixelreaktionen 140,5/64,9 ms, neue Autorenrevision nach Pointerup spätestens
  nach rund 1,2 s beobachtet. Vollständige Details folgen deutlich später.
  Ein Folgezug vor kompletter Nachladung ist belegt, sofortige Folgeeingabe und
  die Zielgeräte-/Gesamtabnahme bleiben offen. Messgrenzen stehen im Bericht.
- **M1-Ergebnis:** Metrische Kamera, direkte deck.gl-Fläche, lokale Geometriepuffer
  und stabile vorzeichenbehaftete Weltkacheln ersetzen den MapLibre-Anschluss.
  [Ersatzprüfung und Grenzen](../../reference/atlas-metric-core-20261023/README.md):
  40 gezielte Tests, 15 native Objekttreffer auf fünf Maßstäben, kanonische
  Höhen/Geschosse/Verdeckung, Ursprungswechsel während einer Geste mit behaltenen
  GPU-Modellen, Resize, Kontextverlust und frisches Wiederöffnen bestanden.
  MapLibre ist aus Quellcode, Build und Abhängigkeiten entfernt; datierte
  [Szenenbelege](../../reference/atlas-maplibre-scene-20261023/README.md) und
  [Kamerabelege](../../reference/atlas-maplibre-camera-assets-20261023/README.md)
  bleiben historische Evidenz.
- **M2-Zwischenstand:** Persistente Terrainkacheln mit Höhen, Grundfarben und
  Bewuchsmaske, Übersicht vor Detail, atomarem Stufenwechsel sowie begrenztem
  RAM-/Kampagnen-Plattencache sind implementiert.
  [32 gezielte Tests und native Wiederöffnung](../../reference/atlas-terrain-tiles-20261023/README.md)
  belegen Wiederverwendung ohne neue Rasterisierung, lokale Änderungen samt
  Eltern und Randbereich, Undo/Redo und aktuelle verknüpfte Ortsnamen.
  Die native Detailabfrage dieser kleinen Probe sank von 291 auf 23 ms;
  die erste Abfrage nach Prozessstart benötigte weiterhin 202 ms.
- **Nächste Arbeit:** M2 bleibt aktiv: Geometriedetailstufen, eigenständige
  Materialkanäle, kampagnenübergreifendes Plattenbudget, Übergänge bei Pan und
  vollständige Weltlast fehlen noch. Auch die Abhängigkeitsprüfung nach einer
  Quellenänderung muss unter Weltlast vermessen werden. Die bisherigen fünf
  Maßstabsproben verwenden skalierte Testgeometrie. Der normale Atlas bleibt bis
  zur vollständigen Werkzeugübernahme auf dem bisherigen Renderer; ein
  Produktleistungsgewinn ist noch nicht belegt.
- **Fortschrittsführung:** Nur diesen Abschnitt für aktive Etappe, Beleg, Ergebnis
  und nächste Arbeit fortschreiben. Produktgewinn und offene Grenzen ausdrücklich benennen.

## Zielarchitektur und Schnittstellen

| Bestandteil | Verbindliche Verantwortung |
| --- | --- |
| **Main und SQLite** | Kanonische Autorendaten, validierte Änderungen, History, Receipts und Recovery. |
| **Persistenter Darstellungsbestand** | Räumlich adressierte Höhen-, Material- und Geometriedetails in mehreren Auflösungen; aus Autorendaten wiederherstellbar. |
| **Metrischer Atlas** | Kamera, Navigation, gemeinsame Projektion und Auswahlstrahlen; stabile Weltkacheladressen und sichtabhängige Nachladung. |
| **Beschriftung** | Bestehende Quellen, Hierarchie und Rechteck-Kollisionsprüfung; Texte und Symbole über deck.gl, gemeinsame Regeln für Bildschirm und Export. |
| **deck.gl** | Gebündelte Gebäude-, Raum-, Straßen-, Vegetations- und Objektschichten samt Auswahl. |
| **GPU-Terrain** | Eigene deck.gl-Schicht mit Höhenfeld-Clipmaps, Materialdarstellung und unmittelbarer Pinselvorschau. |
| **Rust/WASM** | Höhenabtastung, Materialrasterisierung und Aufbau gröberer Rasterstufen innerhalb begrenzter Workeraufträge. |
| **Bearbeitungssitzung** | Sofortige lokale Arbeitsfassung, asynchrone Bestätigung und kontrollierte Zusammenführung. |

Terrain, Objekte und Beschriftung teilen **einen WebGL2-Kontext, eine Kamera und
Tiefenverdeckung**. deck.gl 9.4.0 erhält eine öffentliche View-/Viewport-Anbindung
mit kartesischen Meterkoordinaten. Weltkoordinaten bleiben doppelt genau;
GPU-Puffer enthalten lokale Koordinaten pro Geometriebündel. Ein beweglicher
Darstellungsursprung ändert Transformationen, nicht die gespeicherten Geometrien.
MapLibre ist aus Quellcode, Laufzeitbuild und Abhängigkeiten entfernt. Der vorherige
Anschluss bleibt in der Git-Historie als überprüfbare Entwicklungsreferenz erhalten.
[deck.gl-Koordinatensysteme](https://deck.gl/docs/developer-guide/coordinate-systems).

Vier gemeinsame interne Verträge ersetzen verstreute Übergaben:

- **Kamera:** Weltfokus in Metern, Maßstab, Drehung, Neigung, Viewport und gemeinsamer
  lokaler Darstellungsursprung.
- **Darstellungskachel:** stabile räumliche Adresse, Detailstufe, Quellenstand,
  Format-/Stilversion, Objekt-IDs und binäre Datenpuffer.
- **Änderung:** betroffene Objekte, Kanäle und Weltbereiche einschließlich nötiger
  Randbereiche; daraus entstehen lokale Aktualisierungen.
- **Bearbeitung:** Gesten-ID, Ausgangsrevision, Eingabesegmente, vorläufiges Ergebnis
  und bestätigter beziehungsweise ungeklärter Schreibstatus.

Der Renderer erhält weiterhin ausschließlich begrenzte Fähigkeiten über die
Preload-Brücke. WASM besitzt keine eigene Datenbank- oder Dateiautorität.

## Umsetzung in neun Etappen

### M0 – Vergleichsbasis und vollständige Funktionsübernahme sichern

- Aktuellen Main-Stand, Runtime, Gerätebedingungen und vorhandene Atlasfunktionen festhalten.
- Die eingefrorene Asterfall-Welt für Bildvergleiche und die große Mischwelt für
  Lastprüfungen weiterverwenden.
- Öffnen, Navigation, Pinselbeginn, Pinselabschluss, Folgezug und Detailnachladung
  getrennt messen.
- Bestehende Werkzeuge und Verbraucher ihren Anforderungen und tatsächlichen Tests
  zuordnen; offene Produktfunktionen bleiben sichtbar.

**Abschluss:** Reproduzierbare Ausgangsmessungen und eine vollständige Übernahmeliste
liegen vor. Historische Messungen werden nicht als neue Baseline übernommen.

### M1 – Metrische Kamera und deck.gl direkt verbinden

**Setzt Ansätze 6 (ersetzt) und 7 um.**

- Vorhandene Atlas-Kameramathematik als gemeinsamen Besitzer für Darstellung,
  Auswahlstrahlen und Autorenwerkzeuge verwenden. Weltfokus einschließlich Höhe,
  Meter pro Pixel, 360° Drehung, 0–75° Neigung, Überhöhung und Zoom am Mauspunkt erhalten.
- deck.gl direkt über öffentliche View/Viewport-Schnittstellen anschließen;
  Terrain und Objekte teilen WebGL2 und den Tiefenpuffer.
- Stabile dyadische Weltkacheln mit vorzeichenbehafteten Rasteradressen verwenden:
  256 m auf Stufe 0, Seitenlänge 256 × 2^LOD. Wachstum ergänzt Kacheln, ohne
  vorhandene Adressen, Kamera oder GPU-Geometrie neu zu codieren.
- Weltpositionen doppelt genau halten, lokale GPU-Puffer und kameranahen,
  auf 256 m eingerasteten Darstellungsursprung verwenden. Ursprungswechsel dürfen
  während einer Geste weder Kamera noch Auswahl versetzen.
- Sichtbares Objekt per GPU bestimmen, seinen genauen Weltpunkt mit dem gemeinsamen
  Strahl verfeinern. Veraltete Frames sperren Auswahl; Tiefenpräzision bleibt Pflicht.
- Szenenmodelle, stabile IDs und Prüfungen übernehmen. Bibliotheken, Schriften und
  Symbole lokal bündeln; Main/SQLite und eingeschränkte Rendererrechte erhalten.

**Abschluss:** Terrain, Gebäude und Räume stimmen auf fünf Maßstäben überein;
auf jeder Stufe sind passend große Objekte tatsächlich auswählbar. Neigung,
Höhenfokus, Geschosse, Verdeckung, Resize, Kontextverlust, negative und weit entfernte
Koordinaten sowie Ursprungswechsel sind nativ geprüft. Unveränderte GPU-Puffer
bleiben erhalten. Anschließend entfallen MapLibre-Anschluss, Wurzelwechsel,
Projektionskorrekturen und ungenutzte Abhängigkeiten. Historische Belege bleiben.

### M2 – Persistente Darstellungspyramide aufbauen

**Setzt Ansatz 1 um.**

- Kachelanbindung vollständig im Atlas besitzen; persistente Daten, Nachladung,
  Invalidierung und begrenzter Cache verwenden dieselben stabilen Weltadressen.

- Vorhandene persistente räumliche Indizes um Höhen-, Grundfarben-, Material-,
  Vegetations- und Geometriedetailstufen ergänzen.
- Zuerst eine kleine nutzbare Übersicht bereitstellen; benötigte Details nach
  Sichtbarkeit und Maßstab nachladen.
- Verfügbare gröbere Stufen während des Nachladens verwenden.
- Änderungen räumlich bis zu ihren übergeordneten Detailstufen fortschreiben;
  unveränderte Bereiche bleiben gültig.
- Cacheversionen, atomare Veröffentlichung, Speicher-/Plattenlimits und Wiederaufbau
  beschädigter Bestände implementieren.

**Abschluss:** Eine unveränderte Welt benötigt beim erneuten Öffnen keine
vollständige Terrain- oder Geometrieaufbereitung. Lokale Änderungen erneuern
ausschließlich ihre fachlich betroffenen Bereiche.

### M3 – Auftragsverarbeitung und WASM-Kern integrieren

**Setzt Ansätze 5 und 8 um.**

- Interaktive Auswahl und sichtbare Aktualisierung von Hintergrundverfeinerung und
  Export trennen.
- Zunächst einen interaktiven und einen Hintergrund-Rechenworker verwenden;
  weitere Worker nur bei nachgewiesenem Gesamtnutzen.
- Lange Aufgaben in begrenzte, abbrechbare Abschnitte zerlegen. Überholte
  Kameraaufträge verwerfen; unklare Schreibvorgänge niemals automatisch wiederholen.
- Binäre Puffer und explizite Besitzübergaben verwenden; Kopien über jede
  Prozessgrenze messen.
- Höhenabtastung, Materialrasterisierung und Rasterverkleinerung nach Rust/WASM
  übertragen. Die bisherigen Implementierungen dienen während der Umstellung
  als Testreferenz.
- Rust-Toolchain, reproduzierbaren WASM-Build, Lizenzdateien und Paketierung in die
  vorhandenen npm-/CI-Einstiege aufnehmen.

**Abschluss:** Auswahl und Navigation bleiben während Hintergrundarbeit bedienbar.
WASM liefert fachlich gleichwertige Ergebnisse und übernimmt reale Produktberechnungen.

### M4 – GPU-Terrain und Materialdarstellung ersetzen

**Setzt Ansatz 2 um.**

- Kamerazentrierte Höhenfeld-Clipmaps mit wiederverwendeten GPU-Puffern implementieren.
- Höhe, Wasser, Grundfarbe und Materialmasken getrennt laden und lokal aktualisieren.
- Fels, Schnee, Beleuchtung und Höhenlinien aus den aktuellen Daten auf der GPU darstellen.
- Übergänge zwischen Auflösungen, Küsten, Wassergrenzen und große Koordinaten ohne
  sichtbare Nähte behandeln.
- GPU-Kontextverlust, Ressourcenfreigabe und Wiederaufbau integrieren.

**Abschluss:** Gelände bleibt bei Navigation stabil; Höhenänderungen aktualisieren
auch die Materialwirkung unmittelbar. Darstellung und Höhenauswahl stimmen überein.

### M5 – Städte, Räume und Landschaftsobjekte effizient darstellen

**Setzt Ansatz 3 um.**

- Geometrien räumlich bündeln, binär an deck.gl übergeben und unveränderte GPU-Puffer behalten.
- Wiederholte Bäume, Felsen und Symbole instanziert zeichnen.
- Maßstabsabhängige Darstellungen für Siedlung, Gebäude und Innenraum vorberechnen.
- Gebäudehüllen, Geschosse, Räume, Ausstattung und Beschriftung mit stabilen Objekt-IDs verbinden.
- Auswahl und Änderungen auf einzelne Objekte beziehungsweise betroffene Bündel begrenzen.
- Vorhandene Beschriftungsquellen, Prioritäten und Rechteck-Kollisionsprüfung
  wiederverwenden; deck.gl zeichnet sämtliche Namen und Symbole. Bildschirm und
  Export teilen Platzierungsregeln, ohne doppelte kartografische und Autorennamen.

**Abschluss:** Die große Stadt lässt sich bis zum eingerichteten Innenraum
durchgehend erkunden und bearbeiten. Detailreduktion verändert keine Autorendaten
und verhindert keine gezielte Auswahl.

### M6 – Bearbeitung ohne Nachladepausen ermöglichen

**Setzt Ansatz 4 um.**

- Terrain-, Farb- und Objektwerkzeuge sofort gegen eine lokale Arbeitsfassung darstellen.
- Eingaben gesammelt asynchron an den bestehenden Writer übergeben; dessen
  bestätigte Änderungen in die Darstellung übernehmen.
- Pinselabschluss von feiner Farb- und Geometrienachladung entkoppeln.
- Folgezüge gegen die aktuelle lokale Arbeitsfassung ermöglichen;
  Schreibreihenfolge und Ausgangsrevision bleiben eindeutig.
- Geschützte Geometrie, Wasserregeln und zulässige Bearbeitungsbereiche bereits
  in der Vorschau berücksichtigen.
- Bei Ablehnung oder ungeklärter Bestätigung betroffene Bearbeitung kontrolliert
  anhalten und Wiederherstellung anbieten.

**Abschluss:** Große Pinselzüge zeigen laufende Änderungen; unmittelbar danach ist
ein weiterer Zug möglich. Undo/Redo behandelt jeden Zug als einen Schritt.

### M7 – Vollständigen Atlas und seine Ausgaben übernehmen

- Sämtliche vorhandenen Werkzeuge aus M0 anschließen: Terrain, Gewässer, Trassen,
  Bewuchs, Regionen, Assets, Gebäude, Räume und räumliche Bearbeitung.
- Reise, Maße, Suche, Inspector, Wissensfilter und Spieleranzeige übernehmen.
- PNG/JPEG einschließlich gekachelter Ausgabe bis mindestens 8192 × 8192 Pixel aus
  demselben Szenen- und Materialmodell erzeugen.
- Ausgabe an einen festen Quellenstand binden; sie beeinflusst weder Kamera noch
  laufende Bearbeitung.
- Save/Reopen, Archive, Backupwiederherstellung, Offlinebetrieb und tatsächlichen
  App-Einstieg prüfen.

**Abschluss:** Die Übernahmeliste ist vollständig abgearbeitet; keine bestehende
Funktion benötigt den alten Atlas.

### M8 – Zielgerät qualifizieren und den alten Kern ablösen

- Vollständige Autorenreise und große Lastwelt auf dem Pentium Gold 7505 bei 1080p prüfen.
- Messungen unter normalem Startpfad durchführen; Bildauslesen und Profilierung
  getrennt erfassen, damit sie die Navigationsmessung nicht verfälschen.
- Nach erfüllten Funktions-, Bild- und Leistungszielen den neuen Atlas zum einzigen
  regulären Produktpfad machen.
- Ersetzte Renderer, Berechnungen und Übergangsadapter entfernen;
  historische Prüfarbelege behalten.
- Installiertes Paket, regulären Neustart und erneutes Öffnen qualifizieren.

**Abschluss:** Alle acht Ansätze haben eine nachgewiesene Produktfunktion; die
vollständige Atlasfläche erfüllt die gemeinsamen Abnahmekriterien.

**Reihenfolge:** M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8.
Jede Etappe wird an einem vollständigen Nutzerablauf beurteilt. Zwischenstände
dürfen isoliert bleiben, bis sie zusammenhängend lieferfähig sind.

<a id="4-verbindliche-abnahme-und-testfälle"></a>

## Gemeinsame Abnahme

| Bereich | Verbindliches Ziel |
| --- | --- |
| Navigation | Bildintervalle p95 ≤16,7 ms, p99 ≤33,3 ms |
| Kamera | Reaktion im nächsten darstellbaren Bild, unabhängig von Datenbank und Nachladung |
| Terrainbearbeitung | Erste tatsächliche Gelände-/Farbänderung p95 ≤100 ms |
| Raum-/Objektvorschau | p95 ≤50 ms |
| Kaltes Öffnen | Nutzbare grobe Übersicht p95 ≤2 s |
| Gewöhnliches Speichern | p95 ≤500 ms; Darstellung wartet nicht darauf |
| Lange Aufgaben | Fortschritt binnen 100 ms; über 2 s abbrechbar |
| Ressourcen | Begrenzte Bestände und Speicherplateau über mindestens 30 Minuten Navigation mit Bearbeitung |

Zusätzlich verpflichtend:

- Getrennte Messreihen für Erstaufbau, Prozessneustart mit persistenten Daten und
  warme Navigation; keine vermischten Ergebnisse.
- Wiederholte große und kleine Pinselzüge einschließlich Folgezug, Undo/Redo und
  frischem Öffnen; der große Lastfall umfasst weiterhin 2.500 Meilen Pinselradius.
- Visueller Vergleich derselben vollständig geladenen Welt: Küsten, Relief, Wald,
  Straßen, Namen, Gebäude und Innenräume.
- Fehlerprüfungen für beschädigte Caches, überholte Antworten, Workerabbruch,
  GPU-Verlust, Schreibfehler und ungeklärte Bestätigung.
- Konstante Datenmenge und vergleichbare sichtbare Details; ausgelassene Inhalte
  zählen nicht als Beschleunigung.
- Lokale Messergebnisse, physische Zielgeräteprüfung und persönliche Nutzerabnahme
  bleiben getrennte Nachweise.

<a id="arbeitsweise-ab-23102026"></a>

## Lieferung und Fortschrittsführung

- Bestehende Anforderungen und Quellenbindungen erhalten; die Roadmap ersetzt die
  technische Lieferfolge, nicht den Produktumfang.
- Tatsächlich geprüfte Abläufe und Testdateien im Capability-Katalog pflegen und
  mit `--geprueft` erfassen.
- Während der Entwicklung betroffene Tests, Typ-/Buildprüfungen und native Abläufe ausführen.
- Vor Integration alle vorgeschriebenen Prüfungen über die echte
  **Candidate · exact-SHA aggregate**-CI bestehen: `npm run check:repo`,
  `npm run check`, `npm run check:desktop`, `npm test`, `npm run build` und
  `npm run build:desktop`. Linear auf aktuellem `origin/main` integrieren.
- Nach jeder Integration die Zehn-PR-Releasepflicht prüfen und gegebenenfalls den
  signierten Release einschließlich Paket-/Neustartprüfung abschließen.
- Keine pausierten Automationen reaktivieren. Fortschritt anhand erfüllter
  Etappenkriterien berichten; Zeitaufwand und Beschleunigungsfaktoren erst aus
  tatsächlichen Ergebnissen ableiten.
- Nach Unterbrechungen tatsächlichen Prozess-, Git- und Prüfstand feststellen.
  Nutzerinhalte, fremde Arbeit und die lauffähige Referenz erhalten. Keine
  erzwungene frühe Teilintegration, keine uhrzeitgebundenen Releases und keine
  drei fehlerfreien Audits als Ersatz für erfüllte Abschlusskriterien.

## Fortgeltender Produktumfang

Eine gemeinsame Kartenfläche im wachsenden ebenen Meterraum verbindet Welt,
Landschaft, Stadt, Gebäude und Innenraum. Draufsicht und Nordausrichtung bleiben
unmittelbar erreichbar. Räumliche Bearbeitung ist auch innerhalb von Gebäuden
und Dungeons ohne erzwungene Draufsicht möglich. Darstellungsauflösung und
Bearbeitungsauflösung bleiben getrennt; große Pinsel dürfen feine Details nicht
stillschweigend zerstören.

Straßen, Gebäude, Plätze und andere Objekte bleiben unabhängig. Benannte Gebiete
auf politischen, geographischen oder eigenen Ebenen besitzen weder eine Stadt
noch deren Geometrie. Gebiet ändern oder löschen verändert keine darunterliegenden
Objekte; alte Stadtdokumente erzeugen keine impliziten Marker oder Grenzen.

Bestehende Dateien, Identitäten, `CampaignWorkbench`-Daten und Archivformate
bleiben geschützt. Noch offene eigenständige Stadt-/Dungeon-Paritätsfeatures
bleiben in ihren Fachroadmaps. Ein bestandener technischer Umbau erklärt sie
nicht für umgesetzt. Die [Werkzeug- und Verbraucherzuordnung](unified-atlas-baseline.md#umfang-und-quellenzuordnung)
sowie [scope-sources.json](../../scope-sources.json) bleiben der Umfangsanschluss.
Die vorhandenen Abnahmefälle, darunter `E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001`,
`E2E01-HEX-SPACE-STORE-001`, `E2E01-HEX-SPACE-HOST-001` und `CTY-007.01`, werden
nicht durch diesen Roadmapwechsel auf bestanden gesetzt.

Technisches Nutzerziel bleibt unmittelbare Navigation wie bei Google Maps;
gestalterisches Ziel sind lesbare Fantasykarten. Zusammenhängende Wälder,
scharfe Küsten, verständliche Straßen-/Flussklassen und maßstabsabhängige Namen
werden über Welt-, Kontinent-, Königreich-, Stadt- und Innenraumansicht gemeinsam bewertet.

### Verbindlicher Landschaftswerkzeugumfang (21.10.2026)

Die folgende Konkretisierung des Nutzerauftrags bleibt neben M0–M8 verbindlich. Sie beschreibt
Sollverhalten; vorhandene Werkzeuge und einzelne Nachweise gelten nicht als
Abnahme des gesamten Umfangs. „Aufrauen“ ist ausdrücklich bestätigt.

| Werkzeug | Gefordertes Verhalten | Fachlicher Anschluss |
| --- | --- | --- |
| Terrain: Sculpt | Einfaches Erhöhen, Senken und Aufrauen mit natürlichen Unebenheiten; Aufrauen ist eine eigene Wirkung, nicht nur eine Zufallsvariation beim Erhöhen. | [Relief](terrain-relief.md), M6 |
| Terrain: Smooth | Gelände gezielt glätten, mit nachvollziehbarer Stärke und Bearbeitungsskala. | [Relief](terrain-relief.md), M6 |
| Terrain: Feature | Hügel, Bergketten, Schluchten und vergleichbare komplexe Formen mit wenigen Eingaben schnell erzeugen und weiterbearbeiten. | [Relief](terrain-relief.md), M6–M7 |
| Gebirgsmaterial (ergänzt 23.10.2026) | Höhe und Hangneigung modulieren Geländefarbe und Textur: steinigere Hänge und schneebedeckte Gipfel oberhalb einer einstellbaren Schneegrenze, mit weichen Übergängen. Gemalte Grundfarben bleiben erhalten. | [Relief R4](terrain-relief.md#r4--den-gezeichneten-kartenstil-ausarbeiten), M4–M7 |
| Geländearten | Wald, Wüste, Sumpf und weitere Typen auf weiter, mittlerer und naher Distanz lesbar darstellen; weiche Übergänge an ihren Rändern. | [Landschaft](landscape-tools.md), [Bewuchs](vegetation.md), M4–M7 |
| Wasser | Flüsse finden sinnvolle geländeabhängige Wege zwischen gesetzten Punkten; Seen füllen passende Geländebecken. | [Trassen und Gewässer](terrain-routes.md), M6–M7 |
| Infrastruktur | Feldweg, Hauptstraße, Gasse und weitere Straßenarten erhalten passende Linien-/Texturdarstellung, Bildschirmbreiten und Sichtbarkeitsübergänge beim Zoom. | [Trassen](terrain-routes.md), [Kartografie](atlas-cartography.md), M4–M7 |
| Gebäude | Gebäude mit D&D-Raster in den Innenräumen und mehreren Etagen bleiben Teil derselben Atlasfläche. | [Raumgruppen](room-groups.md), [räumliche Dungeons](../dungeon/smr04-spatial-coverage.md), M7 |
| Gebiete | Benannte gemalte Gebiete auf voreingestellten politischen und geographischen Ebenen sowie eigenen Ebenen; jede Ebene hat ihre eigene Hierarchie. Die Geometrie darunter bleibt unabhängig. | [Kartografie](atlas-cartography.md), M4–M7 |

Für die abschließenden Untersuchungen ist jeder Tabellenpunkt als vollständiger
Ablauf im normalen Atlas zu prüfen: Anlegen, sichtbare Bearbeitung, Zoom über
weite/mittlere/nahe Distanz, Neigen/Drehen, Auswahl, Undo/Redo, Speichern und
frisches Öffnen sowie passende Ausgabe. Zusätzlich zu diesen gemeinsamen
Schritten gelten folgende fachliche Prüfungen:

- Aufrauen erzeugt Erhebungen und Vertiefungen; große Pinsel, Übergänge und
  wiederholte Züge bleiben kontrollierbar. Smooth und Feature behalten ihre
  eigenen verständlichen Bedienaufgaben.
- Geländearten bilden erkennbare zusammenhängende Flächen, mit weichen Rändern
  und zunehmenden Details, ohne sichtbare Nähte oder wechselnde Objektidentitäten.
- Gebirgsmaterial folgt Terrainänderungen und der eingestellten Schneegrenze;
  Zoom und visuelle Höhenüberhöhung verändern die physische Grenze nicht.
  Fels- und Schneetexturen bleiben beim Navigieren stabil und stimmen zwischen
  normalem Atlas, geneigter Kamera und Bildausgabe überein. Der
  [Materialschritt](../../reference/atlas-mountain-material-20261023/README.md)
  ergänzt den gemeinsamen Rasterkern; sofortige Materialreaktion beim Sculpt
  und die vollständige Leistungs-/Gestaltungsabnahme bleiben offen.
- Flüsse berücksichtigen Höhenverlauf und Senken; Seen passen zu ihrem Becken.
  Nach Terrainänderungen bleibt der Zustand nachvollziehbar und korrigierbar.
- Straßenklassen bleiben unterscheidbar, mit lesbaren Namen und stabilen
  Übergängen bei schnellen Zoomrichtungswechseln.
- Politische, geographische und eigene Gebietsebenen lassen sich unabhängig
  bearbeiten und hierarchisch ordnen. Gebiet ändern oder löschen verändert
  weder Straßen, Gebäude, Gewässer noch andere Objekte.

Die Leistungs- und visuellen Kriterien aus der gemeinsamen Abnahme gelten für alle diese
Abläufe. Bekannte Lücken verhindern den Gesamtabschluss; Etappen enden nach den
in M0–M8 festgelegten Ergebnis- und Regressionskriterien, nicht nach einer Auditanzahl.

## Historische Nachweise

<a id="p0--umfang-und-vergleichbare-ausgangsbasis-sichern"></a>
<a id="beauftragte-umsetzung-vorhandenen-atlas-weiterentwickeln"></a>

Die früheren Phasen P0–P8 und inkrementellen Arbeitsentscheidungen sind durch
M0–M8 ersetzt. Historische Links auf P0 oder die frühere beauftragte Umsetzung
führen deshalb hierher. Ihre damaligen Kriterien und datierten Messungen stehen
im [unveränderlichen Vorgängerstand](https://github.com/ThonkTank/Salt-Marcher/blob/d3d31363fc40cff1f0f2f5d0b6699dacd54e8b30/docs/plans/maps/unified-spatial-atlas.md).
Alle vorhandenen Berichte unter `docs/reference/` bleiben erhalten. Aussagen wie
„keine Engine ausgewählt“ oder frühere nächste Schritte gelten ausschließlich
für ihren datierten Stand, nicht für diesen Beschluss.
