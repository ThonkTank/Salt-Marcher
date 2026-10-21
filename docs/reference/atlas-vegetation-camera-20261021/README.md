# Vegetation an der gemeinsamen Atlaskamera

Lokaler Teilbeleg vom 21.10.2026 für P4, Quellstand
`587655ec6768f32bad0bb1c628e8ead34d1aae12`. Keine Main-/Candidate-CI-,
Paket-, Installations- oder Nutzerabnahme.

## Änderung

Die vorherige Kronenbreite wurde beim Datenabruf festgeschrieben; gröbere
Zellen wählten jeweils neue Vertreter. Jetzt bilden regionale Stufen eine
verschachtelte Teilmenge derselben kanonischen Kandidaten. Automatische
Kronen reagieren im Material auf die Kameratiefe, ohne Instanzmatrizen
hochzuladen. Nicht mehr benötigte Vertreter blenden vor der nächsten
Quellschwelle aus. Größe, Position, Höhe und Einzelkorrekturen werden nicht
zurückgeschrieben. Die Auswahl folgt derselben Breite und Sichtbarkeit;
Felsen und Unterwuchs behalten ihre physischen Maße. Der Canvas-Fallback
verwendet die gleichen Ausblendschwellen und vergrößert geschützte Objekte nicht.

Besitzer: `vegetation-lod.ts` für Kandidatenhierarchie und Skalenregeln,
`vegetation-display.ts` für GPU-Darstellung und Treffer,
`atlas-spatial-vegetation.ts` für die instanzierten Modelle.

## Geprüft

- [26 Daten-/Auswahlregressionen](tests.log): negative Weltzellen, mehrere
  Seeds, verschachtelte Bestände, kanonische Eigenschaften, Reihen,
  Dichte-/Geländeänderungen, Einzelkorrekturen, History und Neustart;
  kameraabhängige Treffer, Typfilter und Geländeverdeckung. Vier anfangs
  fehlgeschlagene Fälle verwendeten einen veralteten Renderer-Mock;
  Pixeldichte, Größenabfrage, Zeichen-Hooks und Namenslayer wurden ergänzt.
- [Native Bedienung](native.json), `tools/test-desktop-vegetation.mjs`:
  malen, freihalten, Findling setzen/auswählen/verschieben/skalieren/drehen,
  Neigen in derselben Hauptfläche, Undo/Redo, Fläche und Reihe zeichnen,
  Abbruch und frischer Electron-Prozess. Acht Prüfmarken einschließlich
  isolierter Bildfixture, keine Rendererfehler, drei normale Exits mit Code 0.
  Die zusätzlich beobachteten Produkt-PIDs 2480561 und 2484189 waren danach
  nicht mehr vorhanden; der Sitzungswrapper beendet auch eigene Kinder.
- [GPU-Pixelprobe](pixels.json), `tools/vegetation-camera-probe.mjs`:
  die automatische Beispielkrone bleibt bei 0,5–4 m/logischem Pixel sechs
  Pixel breit, auch bei DPR 2 und bei 60° Neigung. Der geschützte Baum
  behält seine physische Größe und wird bei weitem Zoom subpixelklein.
  Der entfallende Kandidat ist bei 2,1 m/Pixel vollständig unsichtbar.
  Instanzmatrizen bleiben identisch; Gesamtbild und vier Exportkacheln
  haben keine Abweichung über einem Farbwert. Zwei Shaderprogramme.
- [Wörtlicher Repository-Start](repository.json),
  `tools/test-desktop-development-atlas.mjs`: `npm run start:desktop`,
  Kampagne → normaler Atlas, Neigen/Drehen/Zoom während Verfeinerung,
  GPU-Höhenlinien, tatsächlicher Kontextverlust mit Canvas-Fallback und
  explizite Wiederaufnahme derselben Hauptkamera. Derselbe Quellstand,
  keine Rendererfehler, normaler Exit 0, Prozess danach nicht vorhanden.
- App-/Desktop-Typprüfung, Desktop-Build und Repositoryprüfung bestanden.

Die isolierte, geladene Kamerafahrt enthält 880 Objekte, 8 Zeichenaufrufe
und 37.666 Dreiecke: 79 gemessene Frameintervalle, Mittel 55,31 FPS,
p95 23,10 ms; CPU-Zeichenaufruf p95 1,80 ms. Das ist kein Nachweis für
20.000 Objekte, kaltes Laden, den gesamten Editor oder lange Sitzungen.

## Sichtprüfung und Grenzen

[Draufsicht](main-top.png), [geneigte Hauptansicht](main-tilted.png) und
[frisch geöffnet](main-reopened.png) zeigen die normale Atlasoberfläche.
Die rechteckigen Wald-/Geröllflächen sind ausdrücklich so gezeichnete
Testflächen. Es gibt keine zusätzliche Stadtkarte oder Stadtfläche.
Der sichtbare blaue Rand hinter dem geladenen Gelände ist weiterhin eine
Lücke der Geländeabdeckung. Die stilisierten Kronen sind lesbar; natürliche
Waldränder, große dichte Bestände und weitere Assetgestaltung bleiben offen.

Beim Hineinzoomen können noch fehlende feinere Kandidaten erst nach dem
Bereichsread erscheinen. Deren Einblendung und vorauseilendes Laden sind
nicht durch die sofortige Darstellung bereits geladener Objekte gelöst.
Auch große Datenmengen, dicht überlappende halbtransparente Kronen,
LOD-Abdeckung bei starker Perspektive und zusätzliche Landmarkenpolitik
brauchen weitere Qualifikation. P4 und das Gesamtziel bleiben offen.
