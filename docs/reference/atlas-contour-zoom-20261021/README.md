# Automatische Höhenlinien im erreichbaren Hauptatlas

Stand: 21.10.2026. Geprüfter Produktcommit: `ac4ca984cea3c8c24b74557154b1effefac8a9c0`.
Der Lauf startet im Repository `/home/aaron/Schreibtisch/projects/SaltMarcher`
mit dem tatsächlichen `npm run start:desktop`, einem isolierten Prüfprofil und
normaler Kampagnennavigation. Nutzerdaten werden nicht geöffnet.

## Ergebnis

„Automatisch“ ist die Voreinstellung für Höhenlinien. Bildschirmableitungen
bestimmen feinere oder gröbere, ineinander enthaltene Meterintervalle. Deren
Deckkraft wird überblendet; ihre Höhen wandern nicht. Feste Intervalle und „Aus“
bleiben wählbar. Hauptkamera und perspektivische Ausgabe verwenden denselben
Shader, Canvas2D dieselbe mathematische Regel. Das Umschalten in der Hauptkamera
braucht keinen Bereichsread. Eine verspätete Terrainantwort kann den alten Modus
nicht wiederherstellen.

Leere Zeichnungskontexte erzeugen keine Marker, Beschriftungen oder Kartentreffer.
Sie bleiben ausdrücklich fokussierbar und behalten ihre Autorenkoordinaten.
Bestehende Räume und unabhängige Objektgeometrie bleiben erhalten.

## Ausgeführte Prüfung

- [57 Regressionen](tests.log): Bereichsprojektion, leere Zeichnungskontexte,
  Terrainpinsel, Projektionsvalidierung und Wiederverwendung der Kameraquelle.
- [17 Kontur-/Rasterfälle](contour-tests.log): kontinuierliche Intervallgrenzen,
  feste Höhen, Wasserflächen, negative Koordinaten und nahtlose Rasterstücke.
- [11 Anzeigefälle](display-tests.log): aktuelle Kontureinstellung bei verspäteter
  Antwort, Quellwiederverwendung und Live-/Commitgrenzen. Diese Serien überschneiden
  sich; die Zahlen sind keine Summe unterschiedlicher Tests.
- `npm run check`, `npm run check:desktop` und `npm run check:repo` bestanden.
  Der Entwicklungsstart hat den Desktopbuild ebenfalls erfolgreich ausgeführt.
- [Native Probe](../../../tools/test-desktop-development-atlas.mjs) und
  [GPU-Pixelprüfung](../../../tools/terrain-contour-probe.mjs): vier automatische
  Maßstäbe stimmen mit maximal einem Farbwert Abweichung zur Referenz überein.
  Zwei Exportkacheln ergeben dieselbe Pixelzeile wie das ganze Bild (Abweichung 0).
  Feste Linien behalten zwei Pixel Breite in den drei gemessenen Maßstäben.
- Neigung 45°, Rotation 25° und Radzoom behalten dieselbe Hauptcanvasinstanz.
  [Resultat und Buildhashes](result.json), [Startprotokoll](development-command.log).
  Keine Rendererfehler, normaler Prozessabschluss mit Code 0, Startprozess beendet.

Die erste native Probe scheiterte an einer zu engen Testgrenze: 128 von 512
Pixeln waren mit Konturfarbe belegt; die Referenzabweichung war bereits 0.
Die Grenze wurde auf höchstens ein Drittel der Zeile korrigiert. Zweiter Lauf
und Wiederholung am obigen Produktcommit bestanden. Keine Fehlprobe wurde als
Produktqualifikation gezählt.

## Sichtprüfung und verbleibende Arbeit

[Draufsicht](01-repository-atlas.png) und [geneigter Hauptatlas nach Zoom](02-repository-tilt-zoom.png)
zeigen die Konturen ohne den früheren Schriftzug „Neue Zeichnung“.
Die Reliefstriche stammen aus dem gezeichneten Rasterstil. Ihre Vergrößerung und
sichtbare Facetten des 193×193-Geländenetzes bleiben offen; dieser Schritt ersetzt
keinen Kachel-/LOD-Ausbau. Küstenkonturen, übrige Objektklassen, 200-%-Darstellung,
Langzeit-/Latenzabnahme und die drei abschließenden Gesamtprüfungen fehlen weiterhin.
Kein Main-, Release-, Installations- oder vollständiger Produktabnahmebeleg.
