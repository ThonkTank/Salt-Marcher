# M1: planarer MapLibre-/deck.gl-Anschluss

Stand 23.10.2026. **Isolierte Integrationsprobe bestanden; M1 als Produktetappe
bleibt offen.** Maßgeblich ist die [Atlas-Roadmap](../../plans/maps/unified-spatial-atlas.md).
Die Probe verwendet synthetische Geometrie in einer eigenen Electron-Anwendung;
sie ersetzt weder den regulären Atlas noch dessen Autorendaten. Der
[Nachfolgestand mit instanzeigener Bridge und lokalem Desktopmodul](../atlas-maplibre-bridge-20261023/README.md)
führt die inzwischen erledigte Auslagerung und die verbleibenden M1-Arbeiten fort.

## Gesicherter Ausgangslauf

`result.json.gz` stammt aus dem Lauf `1792778938026-1004114` auf dem lokalen
Entwicklungsrechner, Fensterinhalt 1152 × 852. Quellenbasis war
`404a9733e082929e0411ad261db5395f6c36f999` plus die im Ergebnis einzeln gehashten,
damals unversionierten Probe-Dateien. Alle 14 aufgezeichneten Eingaben waren vor
und nach dem Lauf identisch. Electron PID 1004151 endete regulär mit Code 0,
ohne Signal; danach war die PID nicht mehr vorhanden. Renderer-, Probe- und
Console-Fehlerlisten sind leer. Dies ist keine Leistungs- oder Zielgeräteprüfung.

Alle zwölf Prüfungen bestehen:

| Prüfung | Tatsächlich nachgewiesener Umfang |
| --- | --- |
| Planare Projektion | Je drei Meterpunkte bei Welt, Kontinent, Königreich, Stadt und Innenraum; größter Roundtripfehler unter 0,000001 m. |
| MapLibre-Auswahl | Exakter Markerpunkt über alle fünf Maßstäbe; 20 px daneben kein Treffer; temporäre Transformänderung wiederhergestellt. |
| Eingaben unverändert | SHA-256 der 14 im Ergebnis benannten Quellen, Sperrdateien und Laufzeitartefakte vor/nach dem Lauf identisch. |
| Terrainmeter | Synthetischer lokaler DEM liefert 450 m mit Toleranz 0,01 m. |
| WebGL2 | MapLibre besitzt einen WebGL2-Kontext mit 24-Bit-Tiefenpuffer. |
| Style-Neuladen | Vollständiger Style-Ersatz, Quellenbereitschaft, anschließend genau eine Deck-Layergruppe hinter der MapLibre-Extrusion. |
| Ortsfeste Geometrie | Kamera verschoben, gezoomt und geneigt; unveränderte Deck-Geometrie und fester Szenenursprung projizieren weiter deckungsgleich. |
| Drehung | 0° und 360° liefern dieselbe Projektion. |
| Darstellungswurzel | Neue Karte mit vierfacher Wurzel, Fokus bei 100 Millionen Metern, äquivalenter Kamerapose und Kacheladresse z+2 bei gleichem x/y; fünf erneute Deck-/Tiefenprüfungen. |
| Deck-Anschluss | Caller-provided View und MapLibreOverlay zeichnen auf dasselbe Canvas mit demselben WebGL2-Objekt. |
| Deck-Auswahl | Zwei synthetische extrudierte Polygone über alle fünf Maßstäbe identifiziert, inklusive lokaler Koordinatenrückrechnung. |
| Gemeinsame Tiefe | Deck-Gruppe liegt hinter der MapLibre-Extrusion in der Zeichenfolge. Ausblenden der Extrusion verändert den verdeckten Dachpixel, lässt den freien stabil; Einblenden stellt den Pixel exakt wieder her. |

`shared-canvas.png` zeigt die gemeinsame Fläche. `projection-*.png` halten die
fünf Projektionsansichten fest. Die automatische Pixelprüfung gilt für alle fünf
Maßstäbe; sie ist keine gestalterische Abnahme einer Fantasykarte.

## Gefundene Integrationsprobleme und Lösung

- Der Standard-Viewport von `@deck.gl/maplibre` unterstützt dieses eigene CRS
  nicht. Eine eigene View mit ID `maplibre` übernimmt die gemeinsame Projektion.
  Der erwartete Standardpfad-Fehler bleibt im Ergebnis als Gegenprobe sichtbar.
- `defaultProjectionData.mainMatrix` erwartet normalisierte Koordinaten der
  Darstellungswurzel; die rohe `modelViewProjectionMatrix` hat eine andere
  Einheitendomäne. Die View verwendet `inverse(P) * mainMatrix * T(Szenenursprung)`
  und separat `P`. Der Szenenursprung bleibt mit den Geometriepuffern verbunden,
  auch wenn die Kamera bewegt wird.
- Neue Render-Matrizen müssen den Deck-Viewportcache invalidieren. Der Probeanschluss
  setzt dazu eine revisionierte View über `setProps`.
- Decks privater `_handleStyleChange` fragt trotz eigener View eine nicht
  unterstützte Projektion ab. Der eng begrenzte Adapter ist auf MapLibre 6.15.0
  und deck.gl 9.4.0 abgesichert und erhält die Layergruppenabstimmung über das
  öffentliche `setProps`. Nach Style-Neuladen wartet er auf Quellenbereitschaft;
  beim Entfernen des Overlays wird der Listener entfernt.
- Bei 75° Neigung liefert MapLibre 6.15 am oberhalb des Horizonts liegenden
  Viewport-Eckpunkt einen negativen `maxPitchScaleFactor` (hier etwa −4,098).
  Die Kachel-Vorauswahl schrumpft dadurch und verliert sichtbar gerenderte Marker.
  Der Adapter ersetzt ausschließlich diesen Wert während der synchronen Abfrage
  durch eine positive Schranke aus Far-Clippingebene und Kameradistanz.
  Abfragepunkt und exakte Geometrieprüfung bleiben unverändert.

`before-query-fix.json.gz` dokumentiert den Fehler vor der Korrektur: die vier
75°-Markerabfragen scheitern, während alle anderen elf Driver-Prüfungen bereits
bestehen. Der korrigierte Lauf verwendet keine verbreiterte Trefferbox als Ersatz
für die exakte Punktauswahl.

## Ausgelagerter Auswahladapter

Die laufende Probe ruft jetzt denselben typisierten Adapter unter
`src/app/atlas-metric-query.ts` auf, der für den Produktanschluss vorgesehen ist.
Er hält keinen globalen Kartenzustand und nimmt die tatsächliche Bibliotheksversion
explizit entgegen. Die Abfrage bleibt synchron und unverbreitert. Zwölf Tests
prüfen die Skalierung sowie geerbte Methoden, eigene Daten-/Accessor-Deskriptoren,
nicht konfigurierbare schreibbare Methoden, unveränderbare Methoden, fremde
Versionen, ungültige Clipdaten, Fehler, verschachtelte Abfragen und getrennte Karten.
Auch beim Fehler wird der ursprüngliche Deskriptor im `finally` wiederhergestellt.
Zusammen mit den fünf Meterraumtests bestehen 17 gezielte Unit-Tests; die
TypeScript-Prüfung besteht. Die Nutzung im normalen Produkt-Atlas folgt noch.

## Native Bediengesten nach der Auslagerung

`native-gestures.json.gz` ist der aktuelle Wiederholungslauf
`1792779515094-1010636` mit dem ausgelagerten Auswahladapter und fünf zusätzlichen
Bedienprüfungen. Alle ursprünglichen zwölf Prüfungen und alle fünf neuen Prüfungen
bestehen. Die 14 gehashten Laufzeiteingaben blieben unverändert; Electron PID
1010681 endete regulär mit Code 0, ohne Signal, und war anschließend nicht mehr
vorhanden. Es gab keine Renderer-, Probe- oder Console-Fehler.

Der Driver sendet native Browser-Eingaben über Playwright; er setzt die Kamera
während dieser Gesten nicht direkt. Die Probe zeichnet vertrauenswürdige Pointer-
und Wheel-Ereignisse auf und vergleicht die Zähler zwischen den Schritten:

- Linke Maustaste verschiebt den Weltfokus bei unveränderten Geometriepuffern.
- Mausrad zoomt am vorher unter dem Pointer bestimmten Weltpunkt; dessen
  abschließende Abweichung beträgt rund 0,000000164 CSS-Pixel (Grenze 1 Pixel).
- Rechter Drag nach oben dreht die Kamera und erhöht die Neigung von 0° auf
  rund 41,86°. Die programmatische Fünfmaßstabsprobe deckt separat 75° ab.
- Das native Fenster wird von 1152 × 852 auf 960 × 720 geändert; beide Viewports
  übernehmen die neue Größe ohne einen manuellen `map.resize()`-Aufruf.
- Nach jeder Geste und der Größenänderung stimmen MapLibre-/Deck-Projektionen
  desselben ortsfesten Weltpunkts überein; größte Abweichung unter 0,000000002 Pixel.

`native-gestures.png` zeigt den Endzustand. Dies qualifiziert die Eingaben der
isolierten gemeinsamen Fläche, noch nicht die Werkzeuge des normalen Atlas,
Gesten unter Last, Terrainkontakt oder Bearbeitung während eines Wurzelwechsels.
Die sehr kleinen Projektionsabweichungen sind Konsistenzwerte derselben Kamera,
keine Aussage über reale Eingabe- oder Bildlatenz.

## Reproduktion und Quelleneinstiege

Mit Node.js 22 und den installierten Repository-Abhängigkeiten:

```sh
node tools/atlas-maplibre-interop-prepare.mjs
node tools/atlas-maplibre-interop-build.mjs
node tools/atlas-maplibre-interop-run.mjs
node --test tests/atlas-metric-space.test.mjs tests/atlas-metric-query.test.mjs
npm run check
npm run check:repo
```

Die ursprünglichen gespeicherten Läufe verwendeten eine separate Sperrdatei
unter `tools/atlas-maplibre-interop/` (Quellenstand `5ee895c10`). Die aktuelle
Probe verwendet nach der Auslagerung in den Produktbuild die Haupt-Sperrdatei;
`npm ci` im Repository installiert ihre Abhängigkeiten, die Vorbereitung prüft
nur noch die Versionen. MapLibre 6.15.0, deck.gl 9.4.0 und math.gl 4.1.0 bleiben festgelegt. Runtime, Worker und Styles werden lokal ausgeliefert.
Die Probe bewahrt den normalen Produktbuild und verwendet ein eigenes Profil;
Main öffnet nur einen lokalen Testserver, der Renderer bleibt sandboxed, ohne
Node-Zugriff und mit Context-Isolation. Jeder Lauf erzeugt einen eigenen Ordner
unter `.build/atlas-maplibre-interop/runs/`; Fehlerläufe werden nicht überschrieben.

Quellen: [Meterraum](../../../src/app/atlas-metric-space.ts),
[Auswahladapter](../../../src/app/atlas-metric-query.ts),
[native Probe](../../../tools/atlas-maplibre-interop-probe.mjs),
[Driver und Abschlussprüfung](../../../tools/atlas-maplibre-interop-driver.mjs),
[Meterraumtests](../../../tests/atlas-metric-space.test.mjs),
[Auswahltests](../../../tests/atlas-metric-query.test.mjs).

## Abgleich mit M1 und nächste Arbeit

Die Belege bestätigen einen tragfähigen technischen Anschluss. Sie beweisen noch
nicht die vollständige Etappe:

1. Den View-/Style-Anschluss aus dem globalen Probezustand in einen instanzeigenen,
   typisierten Atlas-Besitzer überführen und mit echten Szenendaten verbinden.
2. Terrain, Gebäude und Räume gemeinsam räumlich prüfen. Der separate 450-m-DEM
   ist kein Beleg für ko-registriertes Gelände unter den extrudierten Polygonen.
3. Sichtbare Szenenauswahl vereinheitlichen. Decks eigener Picking-Pass trifft
   auch das durch MapLibre verdeckte Objekt; der gespeicherte Test benennt dies
   ausdrücklich und behauptet keine gemeinsame Sichtbarkeitsentscheidung.
4. Die bestandenen nativen Bediengesten in den normalen Atlas übertragen und dort
   mit Autorenwerkzeugen, Terrainkontakt und laufender Nachladung wiederholen.
5. Wurzelwechsel als laufenden Produktübergang integrieren. Der Probe-Neuaufbau mit
   äquivalenten Kamerawerten beweist noch keinen verlustfreien Wechsel während
   einer Bearbeitung oder eine produktive Kachelmigration.
6. Bibliotheken, Worker, Schriften und Symbole im Produktbuild lokal bündeln und
   den vollständigen Offline-Einstieg prüfen. Die Probe enthält keine Symbol-Layer
   und qualifiziert daher keine Schrift-/Symbolpipeline.

Die numerische Unterscheidbarkeit von 0,125 m und 0,250 m in lokalen Float32-
Koordinaten ist kein Nachweis für echte Raumgeometrie. GeoJSON-Quelldetails enden
weiterhin bei Zoom 24; höherer Kamerazoom fügt keine Präzision hinzu. M2–M8,
Leistungsziele, Paketierung, Installation und persönliche Nutzerabnahme bleiben
von dieser Probe unberührt.
