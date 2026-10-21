# Live-Gelände in der gemeinsamen Atlaskamera

Lokaler Entwicklungsbeleg vom 21.10.2026. **Nicht im geteilten Repository-Start
übernommen, nicht auf Main integriert, nicht installiert oder vom Nutzer
abgenommen.** Die Prüfung lief in
`~/.cache/saltmarcher/unified-atlas/implementation`, auf uncommittierten Änderungen
über `1a896813a5c31a4215feb723a2b0ff7f7f9403c0`.

## Verhalten und Ursache

Formen, Glätten und Farbe schreiben während der Geste über den vorhandenen
Main-Writer. Ein Zug bleibt eine Historygruppe. Bestätigte Teilstände werden
unabhängig vom Writer angezeigt; pro Geste wird erst beim Abschluss der ganze
Atlasbereich neu gelesen. Die Trefferfläche bleibt während des Ziehens fest,
damit wachsendes Gelände den Pinsel nicht verschiebt.

Kompatible Terrainnetze, Texturen und das lokale Detailbild behalten ihre
GPU-Ressourcen. Bestätigte Änderungsrechtecke begrenzen die Uploads; entfernte
Straßen bleiben erhalten. Die Detailtextur ergänzt das bestehende
Konturenmaterial. Das Maßkästchen folgt dem projizierten Geländepunkt als
Bildschirmanzeige. Höhenprofile verwenden dieselbe Karte und den Main-Leser.

Die native Prüfung fand und behob einen stehenbleibenden Undo-Button
(fehlender Live-Zustand im Panelcache) und einen numerischen Fehler beim
Farbzuschnitt an angrenzenden Sichtbarkeitsstreifen. Diese Streifen werden nun
vor dem Schnitt vereinigt. Der erste Profilanschluss initialisierte vor dem
Ansichtsmenü; die Reihenfolge wurde korrigiert und über den tatsächlichen
App-Start erneut geprüft.

## Ausgeführte Prüfung

```sh
npm run build:desktop
TERRAIN_COVERED_PROBE=1 QA_EVIDENCE_DIR=.build/atlas-live-main-native-r5 \
python3 tools/ui-session.py timeout --signal=TERM --kill-after=10s 480s \
node tools/test-desktop-terrain-live.mjs
```

[Ergebnis und Quell-/Build-Hashes](result.json): normale Atlasnavigation aus der
Kampagne, WebGL-Hauptfläche, direkt gespeicherte Höhen-/Glättungszüge, kumulative
halbdeckende Farbe, Escape, Fokusverlust und 1.024-m-Pinsel auf feinem Terrain.
Jeder Zug lässt sich mit einem Undo zurücknehmen. Neigen behält dieselbe
Hauptfläche; kein separater Landschaftsdialog. Höhenprofile in beiden Posen
schreiben keine Pinseloperationen. Frischer Prozess: gespeicherte Höhen bleiben
erhalten, ein Undo stellt den Ausgangsstand wieder her. Beide Starts endeten
mit Code 0 ohne Signal; PIDs waren danach abwesend, keine Rendererfehler.

Ein vorheriger 240-s-Lauf wurde vor dem letzten Abschluss am Zeitlimit beendet
und zählt nicht als bestandene Gesamtprobe. Die längere Grenze dient der
vollständigen Funktionsprüfung. Dies ist keine Latenz-, FPS- oder Großweltabnahme.

[Geneigte Hauptkarte während des Ziehens](04-tilted-live.png),
[gestoppter Farbzug](02-color-stopped.png). Die Bilder stammen aus der
Arbeitskopie, nicht aus dem vom Nutzer gestarteten Projektordner.

Automatisierte Teilbelege: [60 Interaktions-/Darstellungsfälle](interaction-tests.log),
[10 Sichtbarkeits-/Historyfälle](visibility-history-tests.log),
[drei Abschluss-/Anzeigefälle](finalization-tests.log),
[sieben Treffer-/GPU-Fälle](picking-tests.log). Die Gruppen überschneiden sich;
sie sind keine summierte Vollabnahme. App- und Desktop-Typprüfung, Desktopbuild
und Repositoryprüfung bestanden ebenfalls.

## Noch offen

Objekt-Höhenbindung/Volumen und perspektivische Ausgabe müssen vor der
Repository-Übernahme mit den dortigen Terrainarbeiten abgeglichen werden.
Große Welt, flüssiger Zoom, vollständige semantische Detailstufen und geringe
Pinselverzögerung sind weiterhin zu qualifizieren. Im Bild bleiben die grobe
Terraintriangulierung und ein Name einer leeren Zeichnung sichtbar.
Kampagnenwechsel während eines noch ausstehenden Live-Abschlusses benötigt
einen eigenen Ablaufcheck. Die drei vollständigen Produktaudits stehen aus.
