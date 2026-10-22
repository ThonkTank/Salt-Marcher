# Waldabdeckung und Musterstudie, 22.10.2026

Lokaler Baustein nach 0.184.0, auf `bef9af2f4833d97c773c0f73848b7aa579773ef3`.
**Die Musterstudie ist noch nicht an die normale Atlasdarstellung angeschlossen.**
Die laufende Produktanforderung bleibt die vorhandene Hauptkamera, eine sofort
bedienbare volle Welt und eine brauchbare Fantasykarte über alle Maßstäbe.
Dieser Teilbeleg schließt weder die Waldgestaltung noch die Leistungsabnahme ab.

## Datenbaustein

`LandscapeRasterizer` kann ausdrücklich einen zusätzlichen Waldkanal erzeugen:
ein Byte je Ausgabepixel, unabhängig von RGB und Transparenz. Er folgt denselben
supersampelten Flächen, Löchern, Wasserentscheidungen und weichen Rändern wie
die Bodenfarbe. Grundgelände `forest` trägt Wald; spätere Grund-/Bewuchsflächen
ersetzen die Abdeckung in ihrer tatsächlichen Malreihenfolge. Bewuchsdichte wird
als Darstellungsstärke verwendet (0,8 entspricht voller Waldsignatur).

Freihalten, Ausdünnen und Verdichten verändern die Signatur ohne den gemalten
Boden umzudeuten. Korrekturpolygone werden vor der Darstellung in das begrenzte
Samplefeld gerastert, überlappende Teile einer Korrektur nur einmal. Es gibt
keine Punktabfrage gegen alle Korrekturpolygone pro Bildpixel. Pigment ändert
weiterhin nur Farbe; eingebrannte Straßen entfernen die Signatur entsprechend
ihrer sichtbaren Deckung. Die Funktion ist standardmäßig aus: noch keine
zusätzlichen Daten im Workerprotokoll oder in den Produktcaches.

Der Kanal beschreibt kartographische Flächendeckung, keine einzelnen Baum-IDs.
Hangneigung, Baukörperverdrängung und individuelle Bestandsausnahmen sind damit
noch nicht vollständig in der Fernsignatur qualifiziert. Der spätere Anschluss
muss diese Grenzen bewusst mit dem bestehenden Bewuchsvertrag abgleichen.

## Grafikstudie

Die native Electron-Probe verwendet `TerrainSpatialView`, die vorhandene
perspektivische Kamera und den normalen Geländematerialpfad. Sie rendert eine
separate, verborgene Testfläche; sie ist **kein Benutzerablauf im Atlas**.
Die Flächen der endgültigen Studie stammen aus `LandscapeRasterizer` einschließlich
Wasser, Loch, Freihalten und Ausdünnen. Es werden keine Autorendaten geändert.

Ein wiederholtes, prozedural gezeichnetes Kronenmuster bleibt in Weltkoordinaten
verankert. Zwei benachbarte Zweierpotenzmaßstäbe blenden weich ineinander;
zwischen 40 und 80 m/Pixel erscheint die Fernsignatur, passend zum vorhandenen
Übergang zu räumlichen Kronen. Kameraänderungen aktualisieren nur Uniforms.
Die Phase wird vor der GPU-Übergabe relativ zum Renderursprung reduziert.

- [Zu große, gleichförmige Kronen](rejected-large-crowns.png): verworfen; Blasen-/Schuppenwirkung.
- [Flachere, stärker gezackte Form](rejected-flowers.png): verworfen; Blütenwirkung.
- [Feinere Studie](pattern-world.png): zusammenhängendere Struktur, aber weiterhin
  zu generisch für die angestrebte D&D-Kartengestaltung. Keine visuelle Abnahme.
- [Bisherige Fläche derselben Probe](before-world.png), [Kontinent](pattern-continent.png)
  und [geneigte Testfläche](pattern-tilted.png). Die rechteckige Testfläche ist
  ausdrücklich kein Stadtobjekt und kein neuer Ansichtsmodus im Produkt.

Als Referenzen wurden die [offizielle Sword-Coast-Karte](https://media.wizards.com/2015/images/dnd/resources/Sword-Coast-Map_HighRes.jpg)
und das Prinzip wiederholter [MapLibre-Flächenmuster](https://maplibre.org/maplibre-style-spec/layers/#fill-pattern)
betrachtet. Die erste zeigt zusammenhängende Waldmassen mit feinen Kronen und
lesbaren Küsten; die zweite dokumentiert das Musterprinzip. Kein Referenzbild
und kein fremder Implementierungscode wird als Produktasset übernommen.

## Prüfung und Grenzen

Die Tests prüfen Wasser, Löcher, Feathering, Malreihenfolge, Grundwald,
übermalte Wiese, Korrekturüberlappungen, gefärbten Boden, Straßen/Strichelung,
identische Nachbarkacheln, große Koordinaten und kooperative Ausführung.
Der vorhandene RGBA-Kanal bleibt gegenüber `bef9af2f` in allen vier gemessenen
Rasterfällen vollständig gleich, jeweils mit und ohne neuen Kanal.

[raster-parity.json](raster-parity.json) enthält wechselweise ausgeführte
64-/256-Pixel-Proben mit null bzw. 100 Bestandskorrekturen. Der aktivierte Kanal
kostet zusätzliche Rasterzeit (256 Pixel: Median ungefähr 47–49 ms gegenüber
38–39 ms zuvor). Das sind kleine Rasterproben, keine Verbesserung der Öffnungs-
oder Pinselzeiten. Der gegenwärtige Produktpfad fordert den Kanal noch nicht an.

Die Grafikprobe prüft den Renderursprung, benachbarte Exportkacheln, eine sichtbare
LOD-Grenze und vollständiges Ausblenden auf einer tatsächlich bewaldeten Nahfläche.
Gemessen werden RAF-Abstände und CPU-Zeit der Zeichnungsanforderung; keine
GPU-Zeit, keine volle Welt und kein Pentium-Laptop. Die exakten Ergebnisse stehen
in [prototype.json](prototype.json), lokale Prüfungen in [tests.json](tests.json).

Die abschließende [Probe im normalen Atlas](normal-atlas.json) läuft mit dem
gebauten optionalen Rasterbaustein: 80 km → 6 km → 1,2 km → 300 m,
45° Hauptkamera und native PNG-Ausgabe. Autorenzeilen und geschützte Baum-ID
bleiben unverändert; keine Rendererfehler, normaler Prozessabschluss bestätigt.
Weltbild und PNG sind bytegleich zur vorherigen lokalen Probe. Die vier anderen
Bilder wurden erneut angesehen; die bekannte flache Fernfläche, verstreute
Regionalkronen und schlichte Straße bleiben sichtbar. Die 80-km-Probe ist keine
volle Weltkarte und kein vollständiger Fantasy-Autorenweg.

## Nächster Anschluss

Den Kanal gemeinsam mit Farbkacheln transportieren, invalidieren, begrenzen und
als Delta aktualisieren. Basis, Brush-Patch und feine Detailkacheln müssen dieselbe
Quelle und dieselben Überblendgewichte verwenden. Keine zusätzliche Weltabfrage
pro Kameraschritt. Der Shader muss vor der temporären Wasser-/Küstenkorrektur
arbeiten, damit Sculpt keine Waldsignatur auf neuem Wasser hinterlässt.
Anschließend im **normalen Atlas** die volle Welt, Kamera, Bearbeitung, Undo,
Wiederöffnung und PNG mit der bestehenden Probe prüfen. Erst diese Integration
kann eine sichtbare Produktverbesserung belegen.
