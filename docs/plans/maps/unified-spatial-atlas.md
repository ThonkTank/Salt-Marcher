# Roadmap: neuer Atlas-Kern mit allen acht Ansätzen

Verbindlicher Plan vom 23.10.2026. Er ersetzt die bisherige technische Atlas-Roadmap
und deren nächsten Arbeitsauftrag. Alle acht Ansätze werden fest integriert;
MapLibre, deck.gl und WASM sind Produktbestandteile, keine bloßen Vergleichskandidaten.
Der [vorherige Stand](https://github.com/ThonkTank/Salt-Marcher/blob/d3d31363fc40cff1f0f2f5d0b6699dacd54e8b30/docs/plans/maps/unified-spatial-atlas.md)
bleibt als historischer Nachweis erhalten. Dieser Plan ist kein Implementierungs-
oder Leistungsnachweis.

## Ziel und verbindliche Entscheidungen

Der Atlas erhält eine zusammenhängende neue technische Grundlage für flüssige
Navigation und unmittelbare Bearbeitung von Welt bis Innenraum. Alle acht
besprochenen Ansätze werden produktiv integriert: persistente Detailstufen,
GPU-Terrain, gebündelte Objektgeometrie, entkoppelte Bearbeitung, neue
Auftragsverarbeitung, MapLibre, deck.gl und WASM.

**MapLibre und deck.gl erhalten unterschiedliche Aufgaben innerhalb derselben
Kartenfläche.** Der bisherige Atlas bleibt während der Entwicklung als lauffähige
Referenz erhalten. Nach vollständiger Ablösung werden ersetzte Produktpfade entfernt.
Diese Datei bleibt die einzige aktuelle technische Atlas-Roadmap; es entsteht keine
zusätzliche parallele Roadmap unter einem neuen Dateinamen.

## Aktueller Arbeitsstand

- **Aktive Etappe:** M1 – MapLibre und deck.gl zu einer gemeinsamen Atlasfläche verbinden.
- **Status:** M0 abgeschlossen; M1–M8 offen. [Aktuelle Ausgangsmessungen und Etappenprüfung](../../reference/atlas-rebuild-m0-20261023/README.md)
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
- **M1 in Arbeit:** Der [Meterraumvertrag](../../../src/app/atlas-metric-space.ts)
  erhält Kamerapose und Kachelausdehnung beim Wachsen der Darstellungswurzel.
  Der [instanzeigene Kartenanschluss und lokale Desktopbuild](../../reference/atlas-maplibre-bridge-20261023/README.md)
  bestehen 17 native Integrationsprüfungen, 32 gezielte Unit-Tests und den
  Laufzeit-/Protokolltest im regulären Desktopfenster. Fehler bei 75°-Auswahl und
  während des Style-Neuladens wurden reproduziert, korrigiert und erneut geprüft.
  Eine [kanonische Terrain-/Gebäude-/Raumszene](../../reference/atlas-maplibre-scene-20261023/README.md)
  ist inzwischen über bestehende SQLite-/Preload-Wege angeschlossen. Gebäudeauswahl
  bis 75° Neigung, zwei Geschosse, Terrainverdeckung sowie Resize und Style-Neuladen
  sind nativ geprüft; 49 gezielte Tests bestehen. Ein gefundener Auswahlfehler durch
  16-Bit-Tiefenpuffer ist mit einem versionsgebundenen 24-Bit-Adapter behoben.
  M1 bleibt offen: dieselbe reale Szene über alle fünf Maßstäbe einschließlich erhöhter
  Nahkamera, vollständige Szenenauswahl, Autorenwerkzeuge, laufender Wurzelwechsel
  und lokale Schrift-/Symbolpipeline fehlen. Der normale Atlas nutzt weiterhin den
  bisherigen Renderer; ein Produktleistungsgewinn ist noch nicht nachgewiesen.
- **Ablösung des bisherigen Auftrags:** Die zuvor vorgesehene isolierte Kartenstilprobe
  ist nicht mehr die nächste Etappe. Bildqualität bleibt in M0 und der gemeinsamen
  Abnahme verpflichtend; die beschlossene Technikwahl wird dadurch nicht erneut geöffnet.
- **Fortschrittsführung:** Nur diesen Abschnitt für aktive Etappe, Beleg, Ergebnis
  und nächste Arbeit fortschreiben. Produktgewinn und offene Grenzen ausdrücklich benennen.

## Zielarchitektur und Schnittstellen

| Bestandteil | Verbindliche Verantwortung |
| --- | --- |
| **Main und SQLite** | Kanonische Autorendaten, validierte Änderungen, History, Receipts und Recovery. |
| **Persistenter Darstellungsbestand** | Räumlich adressierte Höhen-, Material- und Geometriedetails in mehreren Auflösungen; aus Autorendaten wiederherstellbar. |
| **MapLibre** | Kamera, Navigation, Kartenebenen, Kachelanbindung und kartografische Beschriftung. |
| **deck.gl** | Gebündelte Gebäude-, Raum-, Straßen-, Vegetations- und Objektschichten samt Auswahl. |
| **GPU-Terrain** | Eigene deck.gl-Schicht mit Höhenfeld-Clipmaps, Materialdarstellung und unmittelbarer Pinselvorschau. |
| **Rust/WASM** | Höhenabtastung, Materialrasterisierung und Aufbau gröberer Rasterstufen innerhalb begrenzter Workeraufträge. |
| **Bearbeitungssitzung** | Sofortige lokale Arbeitsfassung, asynchrone Bestätigung und kontrollierte Zusammenführung. |

MapLibre und deck.gl teilen **einen WebGL2-Kontext, eine Kamera und einen
Tiefenpuffer**. Ausgangspunkt sind MapLibre 6.15.0 und deck.gl einschließlich
`@deck.gl/maplibre` 9.4.0, exakt über die Sperrdatei gebunden. Der offizielle
Anschluss unterstützt gemeinsames Rendering; die konkrete Eignung für unseren
Meterraum wird in M1 geprüft. [MapLibreOverlay](https://deck.gl/docs/api-reference/maplibre/overview).
Diese Versionen sind in der Haupt-Sperrdatei festgelegt und im lokalen Desktopbuild
enthalten. Der eigene Meterraum verwendet einen auf diese Versionen begrenzten
View-/Style-Adapter; die vollständige produktive Atlasübernahme bleibt offen.

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

### M1 – MapLibre und deck.gl zu einer gemeinsamen Atlasfläche verbinden

**Setzt Ansätze 6 und 7 um.**

- MapLibre als Kamerabesitzer integrieren; deck.gl über `MapLibreOverlay` im
  gemeinsamen WebGL2-Kontext anschließen.
- Planare Meterkoordinaten, 360° Drehung, 0–75° Neigung und Zoom am Weltpunkt übernehmen.
- Einen gemeinsamen Projektionsadapter für Darstellung, Auswahl und Autorenwerkzeuge verwenden.
- Die endliche MapLibre-Kachelwurzel als ausschließlich abgeleiteten
  Darstellungsbereich behandeln: bei Bedarf erweitern, Kamerapose erhalten und
  Kacheladressen übersetzen. Es entstehen keine fachlichen Weltgrenzen.
- Alle Bibliotheken, Worker, Schriften und Symbole lokal bündeln.

**Abschluss:** Terrainprobe, Gebäude und Raum liegen über alle fünf Maßstäbe
(Welt, Kontinent, Königreich, Stadt, Innenraum) deckungsgleich; Auswahl und
Tiefenverdeckung stimmen auch bei Neigung und erweitertem Darstellungsbereich.

**Verbindliche technische Hürde:** MapLibres eigenes Koordinatensystem ist
experimentell und sein Kachelbereich begrenzt. Diese Integration wird vor den
großen Folgearbeiten gelöst. Bei Nichterfüllung bleibt M1 offen; weder Weltumfang
noch eine der beauftragten Technologien werden stillschweigend gestrichen.
[Koordinatenvertrag](https://maplibre.org/maplibre-gl-js/docs/guides/custom-crs/).

### M2 – Persistente Darstellungspyramide aufbauen

**Setzt Ansatz 1 um.**

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
- MapLibre übernimmt kartografische Namen; spezielle Innenraum- und
  Autorenbeschriftungen verwenden eine abgestimmte Hierarchie ohne doppelte Namen.

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
