# Aufrauen im normalen Sculpt-Werkzeug

21.10.2026. Nutzerbestätigung: „Aufrauen“ bedeutet natürliche Unebenheiten.

Unter **Landschaft → Land formen → Wirkung → Aufrauen** erzeugt derselbe
Höhenpinsel jetzt Erhebungen und Vertiefungen. Das vorhandene weltfeste,
mehrskalige Rauschen wird um null zentriert und mit Dauer, Stärke und weichem
Rand gewichtet. Die gespeicherten additiven Höhenbänder, Sichtprüfung,
Trassenschutz und direkte Gesten-/History-Verarbeitung bleiben die gemeinsamen
Besitzer. Vorschau und kanonische Berechnung verwenden denselben Seed.

Stärke, Radius und weicher Rand bleiben bedienbar. Zielhöhenbegrenzung und
Rauheitsmodulation für gerichtetes Erhöhen/Absenken werden beim Aufrauen
weder angezeigt noch angewendet. Beim Zurückwechseln bleiben deren Werte
vorhanden. Smooth bleibt das eigene Glätten-Werkzeug; Feature ist weiterhin
separat zu vervollständigen.

## Belege

- [30 lokale Regressionen](tests.log) bestanden. [Pinseltests](../../../tests/terrain-brush.test.mjs)
  prüfen beide Höhenrichtungen, Seed, Zeit-/Ereignisverteilung, unveränderten
  Außenbereich, Erhalt feiner Höhenbänder, Vorschaugleichheit und kanonische
  Speicherung mit Undo/Redo/Neustart. Die
  [Werkzeugtests](../../../tests/desktop-atlas-tool-hierarchy.test.mjs) prüfen
  Wechsel und Erhalt der gerichteten Einstellungen.
- TypeScript für App/Desktop und Desktopbuild bestanden.
- [Native direkte Terrainprobe](native.json) mit
  [bestehendem Prüfeinstieg](../../../tools/test-desktop-terrain-live.mjs):
  Erhöhen, Glätten, Bemalen, Escape und Fokusverlust sowie Aufrauen über die
  geneigte Hauptkamera. Aufrauen erzeugte im gehaltenen Testzug Änderungen
  zwischen −50,97 und +127,80 m. Ein Undo/Redo erhält exakt die Höhenbänder;
  frischer Prozess liest denselben Stand und kann den ganzen Zug zurücknehmen.
  Zwei normale Exits 0, beide PIDs beendet, keine Rendererfehler.
- [Bild während des gehaltenen Pinselzugs](tilted.png): Aufrauen ist im normalen
  Atlas ausgewählt, Relief und Höhenlinien zeigen die entstandenen Unebenheiten.
  Der bewusst starke Testzug ist keine gestalterische Empfehlung für jeden
  Maßstab; Stärke und Dauer bestimmen die Ausprägung.

Der erste Versuch mit dem älteren `test-desktop-terrain-brush.mjs` scheiterte
bereits vor dem Aufrauen an dessen veralteter Erwartung eines „Vorschau“-Textes.
Der direkte Pinsel veränderte unterdessen sichtbar das Gelände. Der
[Fehlerbeleg](legacy-probe-failure.json) bleibt erhalten; dieser alte Ablauf
wird nicht als bestanden geführt. Die Erweiterung wurde stattdessen in den
bereits vorhandenen Test für direkte Terrainbearbeitung aufgenommen. Eine
vollständige Migration aller alten Vorschautests bleibt offen.

Quellbasis der nativen Probe: d0eccad9d9985eee4244b47d5ed912af96e98e31 plus
lokale Änderungen; die Datei enthält Quellhashes. Dessen Wald-Fix wurde als
PR #1337 nach main integriert. Die Roughen-Änderung setzt darauf auf.

## Grenzen

Dies ist ein Werkzeugteilschritt. Große Weltlasten, allgemeine Eingabelatenz,
weiche Geländeartenränder, komplexe Feature-Werkzeuge, Wasser-/Straßen- und
Gebietsumfang sowie die Gesamtgestaltung bleiben offen. Keine Paket- oder
Nutzerabnahme und keine der drei abschließenden Gesamtuntersuchungen.
