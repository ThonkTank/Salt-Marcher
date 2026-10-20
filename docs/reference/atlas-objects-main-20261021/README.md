# Gebäudehöhen und Ausgabe in der Hauptkamera

21.10.2026. Zusammenführung des vorhandenen R6/R7-Terrainstands mit dem
normalen Atlas auf `codex/unified-spatial-atlas`; keine neue Kartenoberfläche.

`terrain-object-view.ts` baut Körper aus den Raumgrundrissen einschließlich
Innenhöfen und getrennten Komponenten. Unveränderte Körper behalten ihre
GPU-Ressourcen. Geländegebundene/feste Höhen, Geschosse und Eingangshöhen
verwenden weiterhin den kanonischen Speicher. Der normale Objektinspektor
bearbeitet diese Werte. Die sichtbaren Körper liefern ihre ursprünglichen
Auswahlkennungen an den Atlas; Pinsel treffen weiterhin die Geländeoberfläche.

`atlas-terrain-export.ts` verbindet den vorhandenen Exportablauf samt Abbruch,
Quellenrevision und Dateidialog mit demselben `TerrainSpatialView`. Perspektivische
Teilbilder verwenden Unterausschnitte derselben Kamera. Öffentliche Höhen
stammen ausschließlich aus der freigegebenen Spielerprojektion.

## Ausgeführt

- 44 gezielte Prüfungen für Raumregionen, Übergänge, Projektion, Hauptszene,
  Körpergrundrisse und perspektivische Bildkacheln bestanden.
- 11 übernommene Terrainprüfungen für kanonische Objekt-/Eingangshöhen,
  History, Wiederöffnen, Spielerwissen, Ausgabeabbruch und Rasterwiederverwendung bestanden.
- 18 teils überlappende abschließende Körper-/Picking-/Anzeigetests bestanden.
- `tools/test-desktop-atlas-objects-main.mjs` öffnete die normale Kampagne → Atlas,
  neigte dieselbe Canvasfläche, exportierte PNG mit 2048 Pixeln, wählte ein
  sichtbares Dach, änderte Höhen im Inspektor und prüfte sie im frischen Prozess.
  Beide Prozesse endeten regulär mit Code 0; PIDs danach nicht vorhanden,
  keine Rendererfehler. Build-Hashes in `native-result.json`.

Die native Probe erfasst den damaligen uncommittierten Build auf `09e07027a`.
Die danach ergänzte Abwehr verspäteter Projektionsantworten ist separat durch
`terrain-projection-ui.test.mjs` belegt. Die Prüfung des tatsächlichen
Repository-Starts wird getrennt protokolliert.

## Grenzen

Dies ist eine technische Funktionsprobe mit einer kleinen synthetischen Karte.
Das leere lokale Zeichnungsobjekt erzeugt weiterhin eine unerwünschte
Platzhalterbeschriftung. Großstadt-/Weltleistung, sämtliche Autoren-Arbeitsebenen,
semantische Detailstufen und vollständige öffentliche Ausgabe sind nicht damit
abgenommen. Keine Aussage über CI, Main, Paketinstallation oder Ownerabnahme.
