# Vom Kontinent zum unabhängigen Haus

Die normale Autorenprobe beginnt mit einer leeren Kampagne, zeichnet westliche
und östliche Landmassen, Inseln, Kontinentalrelief, Wald und ein unabhängiges
Königreichsgebiet. Anschließend zoomt sie auf 400 m Ausschnittsbreite, zeichnet
eine Straße und platziert drei eingerichtete Häuser. Ein Schankraum erhält einen
Namen; die Welt wird nach regulärem Schließen in einem neuen Prozess geöffnet.
Geometrie wird durch die normalen Werkzeuge angelegt. Nur die leere Kampagne und
ihr Meeresspiegel werden vorbereitet; keine Stadt wird eingespeist.

## Gefundene Fehler

1. **Einzelhaus** benötigte eine historische Stadtkennung. Ohne sie öffnete der
   Klick keinen Dialog. Die Aktion verwendet jetzt den gemeinsamen Raumgruppen-
   Befehl an der Weltposition, auch bei ausgewählter historischer Stadt.
   Die Kamera und das Platzierungswerkzeug bleiben erhalten. Bestehende
   Stadtobjekte werden durch diese Änderung nicht migriert oder gelöscht.
2. Nach dem ersten Haus wurde dessen Eigenschaftenleiste geöffnet. Bei der
   dadurch schmaleren Kartenfläche traf die Strahlabfrage einzelne sichtbare
   Bodenstellen nicht mehr. An einer exakten Rastergrenze bei Weltkoordinaten
   um −8.482 km ergab die inverse Bandrechnung 127,999999… statt 128. Die
   Zellwanderung startete rückwärts und endete bei Distanz null. Die Suche
   vergleicht jetzt die tatsächlichen Meshknoten und die Strahlrichtung.

Die fehlgeschlagenen Autorenläufe enthielten bereits ein korrekt gespeichertes
Haus; sie sind kein bestandener Gesamtworkflow. DOM-Ereignisaufzeichnung
bestätigte den zweiten Klick auf der Karte. Die vorgeschaltete Geländeabfrage
lieferte dabei `null`; Werkzeugumschaltung oder Seitenleistenüberdeckung waren
nicht die Ursache. Der Fehler wurde anschließend ohne Electron reproduziert.

## Regressionen und Grenzen

- `tests/atlas-independent-building.test.mjs`: unabhängige Weltpositionen,
  Namensfeld, Wiederholung, historischer Stadtkontext, Abbruch und Wechsel der
  Kampagne während der Vorschau.
- `tests/atlas-perspective-camera.test.mjs`: konkrete entfernte Weltposition
  und schmale Kartenfläche, an der der native Klick ausfiel.
- `tests/terrain-ray.test.mjs`: Zellwanderung gegen vollständige Dreieckstreffer,
  Blickrichtungen, Vorderseiten, Bereichsgrenzen und entfernte Koordinaten.
- `tools/test-desktop-room-groups.mjs`: vorhandener Stadtkontext darf ein neues
  Einzelhaus nicht in einen Stadteintrag umwandeln; gemeinsamer Raumeditor,
  Skalierung, Teilen, Undo/Redo und Wiederöffnung bleiben geprüft.
- `tools/test-desktop-world-authoring.mjs`: vollständiger Autorenablauf aus
  der leeren Kampagne. [Nativer Ergebnisdatensatz](result.json): acht Stufen,
  drei Raumgruppen mit 72 Räumen, null Stadtdokumente, ein Königreich und eine
  Straße. Alle Daten nach Wiederöffnung identisch; beide App-Prozesse und der
  Starter endeten mit Exit 0, beide PIDs waren anschließend weg. Keine Renderer-
  Fehler. [Siedlung](06-settlement.png), [Raum](07-building-room.png) und
  [Wiederöffnung](08-reopened.png).

Diese Funktionsprobe enthält keine volle Weltlast und ist keine ästhetische
Abnahme. Große Sculpt-Pinsel, vollständige Weltlast und die Qualifikation auf
dem Pentium Gold 7505 bleiben offen. Die unmittelbare Reaktion ist weiter das
verbindliche Ziel der [Atlasroadmap](../../plans/maps/unified-spatial-atlas.md).
