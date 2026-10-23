# M1: kanonische Terrain-, Gebäude- und Raumszene

Historischer Integrationsstand: MapLibre wurde anschließend durch den direkten metrischen Atlas ersetzt. Die historischen Codepfade beziehen sich auf den erhaltenen lokalen Übergangsstand `c891b74b0d6b9f91c4f5f746f93d3fa74db63768`; Wiederholungen dieser historischen Probe benötigen dessen Checkout. Einzeldateien lassen sich mit `git show c891b74b0:PFAD` lesen. Dieser Checkpoint ist noch nicht veröffentlicht.

23.10.2026. Lokaler Zwischenstand auf `atlas/rebuild-m0-20261023`, ausgehend von
`3be408dcc`. Die finalen Quellen- und Buildhashes stehen in [native.json.gz](native.json.gz).
M1 bleibt offen; dies ist weder Produktleistungs- noch Zielgeräteabnahme.

## Implementierung und überprüftes Ergebnis

- Szenenmodell (`src/app/atlas-maplibre-scene-model.ts`, historischer Checkpoint): liest bestehende
  `AtlasRegionView`-/`TerrainGrid`-Antworten. Terrain verwendet dieselben Samples,
  das verfeinerbare Gridlayout und dieselbe Dreieckstopologie für Bild und Auswahl.
  Gebäude und Räume behalten kanonische IDs, Scope-Frames, Löcher und Geschosshöhen.
  Offene Gebäude behalten ihren Terrainanker, ohne die Räume durch eine Hülle zu verdecken.
- Szenenbesitzer (`src/app/atlas-maplibre-scene.ts`, historischer Checkpoint): indexed meshes über
  `SimpleMeshLayer` 9.4.0 im vorhandenen gemeinsamen Kartenanschluss; Kameraänderungen
  bauen keine Szenenpuffer neu. Noch ein Mesh pro Objekt, keine vorgezogene M5-Batchingabnahme.
  Auswahl liefert das sichtbare semantische Objekt und einen aus GPU-Tiefe
  rekonstruierten Meterpunkt. Ein Terrain-Treffer ist kein kanonischer Rasterzellenbezeichner.
- XY bleiben positive root-relative Meterfraktionen; Z ist absolute physische Höhe
  mal Darstellungsüberhöhung. Der alte Three-Y-Flip und dessen Fokusabzug gehören
  nicht in die MapLibre-Matrix. Koordinaten werden vor Float32-Konvertierung lokalisiert.
  Ein fester Szenenursprung darf außerhalb der aktuellen Darstellungswurzel liegen.
- Kanonische Fixture (`tools/atlas-maplibre-canonical-fixture.mjs`, historischer Checkpoint) erzeugt
  einen Hügel, ein Stadtgebäude mit Raumgruppe und ein geklontes Obergeschoss über
  bestehende Writer. Sie schließt und öffnet SQLite erneut und prüft die gespeicherten
  Werte. Kein direktes SQL-Seeding, keine Änderung eines Nutzerprofils.
- Native Probe (`tools/test-desktop-atlas-maplibre-scene.mjs`, historischer Checkpoint) startet den
  regulären Desktopbuild in einem privaten Profil und lädt Region und Terrain über
  die echte Preload-Brücke mit identischer Revision/Fence. Die Testfläche liegt über
  der Startansicht; der normale Atlas ist noch nicht auf diesen Renderer umgestellt.

Finaler Lauf `1792782000004-1042176`:

| Prüfung | Ergebnis |
| --- | --- |
| Gespeichertes Terrain | 4.225 Samples; Hügelspitze 140 m |
| Gebäude | Basis 141 m, Wandoberkante 150 m, Dachoberkante 152 m |
| Zwei Geschosse | Raumflächen exakt 141/145 m; beide kanonisch auswählbar |
| Kamera | Drehung/Neigung 0°/0°, 37°/55°, −143°/75°; richtige Gebäude-ID |
| Unabhängiger XY-Abgleich | Drei nichtnullige XY-Punkte gegen MapLibre; Fehler <0,01 px |
| Verdeckung | Terrain trifft vor einem darunterliegenden Raum; ohne Terrain trifft derselbe Raum; Wiederherstellung verdeckt ihn wieder |
| Resize und vollständiges Style-Neuladen | 800×580; richtige Obergeschoss-ID und beide Auswahlpuffer weiterhin 24 Bit |
| Prozess | PID 1042279, normaler Exit 0 ohne Signal, anschließend nicht vorhanden |
| Fehler/Quellenbindung | Keine Renderer-/Konsolenfehler; Quellen und Buildbytes vor/nach unverändert |

Die Tiefenrückrechnung am Dach liegt im Test innerhalb eines Meters; dies ist kein
Nachweis zentimetergenauer Autoreninteraktion über alle Weltmaßstäbe. Raumhöhen
im Szenenmodell sind exakt; der GPU-Treffer ist pixel- und tiefenauflösungsabhängig.
Screenshots: [Hügel und Gebäude](canonical-hill-building.png),
[Obergeschoss](canonical-upper-room.png). Die bewusst steile technische Testwelt
und einfache Materialdarstellung sind keine Kartenstilabnahme.

## Gefundene Fehler und Nacharbeit

Die erste Gebäude-/Geschossprobe war grün, prüfte aber noch keine knappe Verdeckung.
Die ergänzte Gegenprobe traf einen Raum bei etwa 20,0005 m trotz Terrain bei etwa
20,1150 m darüber. Das Abschalten von Decks voreingestelltem, layerabhängigem
Polygon-Tiefenversatz allein beseitigte den Fehler nicht.

Deck 9.4.0 legt seine beiden Picking-Puffer mit `depth16unorm` an. Diese Genauigkeit
reichte bei der verwendeten Kamera nicht zur Trennung der Flächen. Der
begrenzte Picking-Adapter (`src/app/atlas-maplibre-picking.ts`, historischer Checkpoint) ersetzt
ausschließlich fehlende oder bekannte 16-Bit-Puffer durch `depth24plus`, behält
die RGBA8-/RGBA32F-Farbformate bei und prüft Version, private Struktur und
Fähigkeiten. Erst nach erfolgreicher Allokation werden die Referenzen getauscht.
Deck behält Resize/Finalize; alte externe Farbtexturen werden ebenfalls freigegeben.
Unbekannte Verträge scheitern ausdrücklich, statt ungenaue Auswahl zu liefern.

Zwei weitere Probenfehler wurden korrigiert: Die luma-WebGL-Abfrage „renderable“
prüft Farbrenderbarkeit und war deshalb für ein Tiefenformat ungeeignet; der
Adapter prüft Tiefentexturunterstützung und tatsächliche Framebuffer-Erstellung.
Eine Style-Differenz löst nicht zwingend `style.load` aus; die Lifecycle-Probe
fordert nun bewusst ein vollständiges Neuladen mit vorher registriertem Listener an.

Alle acht Läufe einschließlich Fehlern sind in [runs.json](runs.json) und den
verlinkten komprimierten Rohdaten erhalten. Fehlgeschlagene Läufe beanspruchen
keinen normalen Exit; ihre PIDs wurden separat als nicht mehr vorhanden geprüft.

## Lokale Prüfungen und offene Etappenarbeit

49 gezielte Tests bestanden:
Szenenmodell (`tests/atlas-maplibre-scene-model.test.mjs`, historischer Checkpoint),
Szenenbesitzer (`tests/atlas-maplibre-scene.test.mjs`, historischer Checkpoint),
Picking-Ressourcen (`tests/atlas-maplibre-picking.test.mjs`, historischer Checkpoint),
Kartenanschluss (`tests/atlas-maplibre-bridge.test.mjs`, historischer Checkpoint),
Projektion (`tests/atlas-maplibre-projection.test.mjs`, historischer Checkpoint),
MapLibre-Abfrage (`tests/atlas-metric-query.test.mjs`, historischer Checkpoint),
Meterraum (`tests/atlas-metric-space.test.mjs`, historischer Checkpoint).
`npm run check`, `npm run check:desktop`, `npm run build:desktop` und
`npm run check:repo` bestanden. Der lokale Runtime-Lizenzbestand enthält jetzt
80 Pakete/81 Dateien; der im npm-Paket fehlende Draco-Lizenztext ist aus dem
genauen Upstreamtag übernommen und version-/hashgebunden.

**M1 noch offen:** derselbe reale Szenenstand über alle fünf Maßstäbe, Nahkamera
auf erhöhten Innenräumen, laufende Wurzelerweiterung mit Szenenübernahme,
Autorenprojektion und Werkzeuganschluss sowie lokale Schrift-/Symbolpipeline.
Nicht abgebildete Zeichnungselemente, Landschaftsobjekte, Gebiete und Labels
werden als Coverage-Lücken ausgewiesen. Das Mesh pro Objekt und die aktuelle
CPU-Geometrieaufbereitung werden in M4/M5 ersetzt/gebündelt. M2–M8 sind offen.

Keine neue Leistungsreihe, kein vollständiger `npm test`-Lauf, keine Candidate-CI,
Integration, Installation, Veröffentlichung oder persönliche Nutzerabnahme.
