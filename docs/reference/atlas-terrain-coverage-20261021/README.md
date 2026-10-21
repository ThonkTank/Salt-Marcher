# Geländeabdeckung in der normalen Atlaskamera

Lokaler Teilbeleg vom 21.10.2026 für P3/P4. Die neue Abdeckung wurde in
`5f5dda720052c0833378f958e03d02f6e1933a21` implementiert; Himmel-/Meerfarbe
und gezieltes Zurücksetzen einer behobenen Darstellungsfehlermeldung folgten
in `29b31d4af`. Nativer Quellstand:
`456fb1919226b306e046417f74d8748ab40defb8`.
Keine Main-/Candidate-CI-, Paket-, Installations- oder Nutzerabnahme.

## Verhalten und Besitzer

Der feste dreifache Geländeausschnitt deckte bei gekippter Kamera nicht
alle sichtbaren Strahlen ab. `terrain-coverage.ts` erweitert ihn abhängig
von der Neigung auf die 3-, 6-, 10-, 24- oder 64-fache längste Frame-Seite.
Die quadratische Quelle bleibt beim Drehen gültig. Kamerabewegung ist
unmittelbar; eine erforderliche größere Quelle wird asynchron angefordert.

`terrain-grid-layout.ts` behält 257×257 Knoten und 192 mittlere Intervalle
pro Achse. Die äußeren 32 Intervalle pro Seite wachsen bei großer Abdeckung
in bis zu vier Bändern. Höchstens 81 reguläre Blöcke werden abgetastet;
feine Mitte und gemeinsame Randknoten bleiben erhalten. Der grobe Farbkontext
bleibt auf 512×512 begrenzt, feine Weltkacheln ergänzen den Fokus.

Ab 60° beginnt ein weicher atmosphärischer Horizont. Die Parameter gelten
für das vollständige Bild und damit auch für Exportkacheln. Renderer,
Beschriftungsverdeckung, Treffer und kanonische Pinsel-Sichtprüfung teilen
diese Grenze. Himmel und Meer unterscheiden sich farblich. Das ist ein
endlicher Sichtbereich im ebenen Meterraum, keine Weltkugel.

`terrain-route-clip.ts` teilt Straßen und Flüsse an den Bandgrenzen; nur
nahe Strecken brauchen feine Samples. So verschwinden lange Trassen nicht
wegen des Samplelimits. Das begrenzte Vektorbudget reserviert zuerst
Trassen im Fokus; die Farbtiles verwenden dieselbe Auswahl.

Nach erfolgreicher GPU-Wiederaufnahme löscht die Atlasoberfläche nur die
zugehörige Darstellungsfehlermeldung. Später eingetroffene Schreibfehler
bleiben stehen. Der Canvas-Fallback verwendet nun ebenfalls die vorhandene
blockweise Höhenabtastung, unabhängig von der Größe der Quelldateien.

## Regressionen und Diagnose

- [49 Fälle](tests.log): Abdeckung über Neigung, Rotation, Seitenverhältnis,
  kleine Pan-/Zoombewegungen; begrenztes Fokusnetz, Quellwiederverwendung,
  Sichtprüfung, Trassensampling und Farbtiles.
- [39 Fälle](recovery-tests.log): überlappende Abdeckungs-/Quelltests sowie
  Wiederherstellung und Erhalt fremder Fehlermeldungen.
- [12 Fälle](fallback-tests.log): blockweise Höhen-/Wasserabtastung,
  Vererbung, additive Bänder und pixelgleiche Relief-/Konturausgabe;
  zusätzlich kleine, mehrskalige Binnenland-Fixture im Datenbank-Fallback.
- App-/Desktop-Typprüfungen und nativer Entwicklungsbuild bestanden.

Die erste native Prüfung mit ausgedehntem Binnenland überschritt beim
Grafikverlust das 20-Sekunden-Limit. Eine isolierte Wiederholung desselben
Fallback-Ausschnitts lieferte vier 1024²-Tiles in 20,95 Sekunden. Nach
Umstellung von Einzelpunktabfragen auf den gemeinsamen Blocksampler waren
es 12,79 Sekunden. Das sind zwei lokale Diagnosemessungen, keine robuste
Leistungsabnahme. Diese Wartezeit bleibt Produktarbeit.

Die vorherige kleine Insel-Fixture konnte ihre eigene Küste wie eine
Projektionskante aussehen lassen, weil Himmel und Meer dieselbe Farbe
hatten. Der abschließende native Test verwendet ausgedehntes Binnenland
und prüft zusätzlich tatsächliche GPU-Fog-Uniforms und Bildpixel.

## Nativer Hauptatlas

[Repository-Start](repository.json), `tools/test-desktop-development-atlas.mjs`:
wörtliches `npm run start:desktop`, Kampagne → Atlas, Zoom während
Verfeinerung, GPU-Höhenlinien, tatsächlicher Grafikverlust, vollständiger
Canvas-Fallback und explizite Wiederherstellung. Keine Rendererfehler,
normaler Exit 0, Produktprozess danach nicht vorhanden. Der native
Fallback dauerte 10,625 Sekunden; beide Statusfelder meldeten danach
„Atlaskamera wieder verfügbar“ ohne Fehlerzustand.

[75° Neigung](main-horizon.png), [110° Drehung](main-rotated.png) und
[45° Hauptansicht](main-tilted.png) zeigen die echte Atlasoberfläche.
Die GPU-Fog-Grenze entspricht der geladenen weiten Quelle; 13,06 %
der Binnenland-Aufnahme sind Himmel. Rotation behält Quelle und Canvas.
Die Screenshots erfassen teilweise noch den laufenden Bereichsread;
Terrainbereitschaft allein ist keine Freigabe aller Autorenwerkzeuge.
Feine Linien/Unregelmäßigkeiten im entfernten Gelände bleiben sichtbar.

[Isolierte Pixelprüfung](pixels.json): Beim gleichen aktuellen Renderer
zeigt [der enge Ausschnitt bei 60°](narrow-60.png) 70.920 Himmelpixel
innerhalb des Bodenausschnitts; [die weite Quelle](wide-60.png) keine.
Bei 45° sinkt die Zahl von 2.214 auf null. [75° mit Horizont](wide-75.png)
behält nur den oberen Himmelsbereich; Gesamtbild und vier Exportkacheln
haben keine Abweichung über einem Farbwert. Die Vorher-/Nachherbilder
vergleichen Quellenabdeckung im selben Renderer, keine alten Programmversionen.

[Native Bearbeitung](live.json), `tools/test-desktop-terrain-live.mjs`:
sechs Prüfmarken für direkte Höhenänderung, Profil, Glätten, kumulatives
Malen, Fokusverlust während einer Geste und [geneigte Bearbeitung](main-brush.png).
Die gespeicherte Höhenänderung bleibt nach einem frischen Prozess erhalten;
ein Undo stellt den Zustand vor der Geste wieder her. Keine Rendererfehler;
beide Prozesse endeten normal mit Code 0 und waren danach nicht vorhanden.
Der Lauf verwendet denselben Runtime-Stand; der Dirty-Vermerk betrifft
die begleitende Dokumentation, nicht nachträgliche Runtime-Änderungen.

[Native Trassenbearbeitung](routes.json), `tools/test-desktop-terrain-routes.mjs`:
sieben Prüfmarken für Straßenplanung aus einer bestehenden Linie,
Fluss mit Punktklicks und Koordinatenkorrektur, gespeicherten Schutz,
Löschen/Undo, gemeinsame gekippte Darstellung, echten geschützten
Pinselzug und frischen Prozess. [Der Verlauf wird in der normalen
Seitenleiste bearbeitet](main-route.png); es gibt keine zweite Karte.
Beide Prozesse endeten normal mit Code 0 und waren danach nicht vorhanden.
Die begrenzte Höhen-Fixture besitzt rechteckige Außenkanten; diese sind
autorisierte Testhöhendaten, keine Stadtfläche.

## Verbleibende Arbeit

Kalte Quellenwechsel, Aufbau größerer Abdeckung, neue feine Objekte und
Namen hängen weiterhin von Hintergrundreads ab. Dichte Weltbestände,
weite Farbauflösung, die Geschwindigkeit des Canvas-Fallbacks und lange
Sitzungen sind nicht qualifiziert. Diese Änderung ersetzt kein weltweites
Kachel-LOD. P3/P4 und das Gesamtziel bleiben offen; die drei vollständigen
kritischen Abschlussprüfungen haben noch nicht begonnen.
