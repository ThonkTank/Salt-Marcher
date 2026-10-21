# Aktuelle Kamera im selben Animationsschritt zeichnen

21.10.2026, Änderung auf `e3da51d64` / 0.181.0, normaler Atlas.

Die Zoomanimation und die Kartenzeichnung besaßen getrennte RAF-Aufträge.
`zoom` änderte die Kamera und plante über `set → apply` erst die nächste
Zeichnung ein. Ein bereits geplanter Overlayauftrag zeichnete stattdessen
noch die alte Kamera, bevor der Zoomauftrag sie fortschrieb. Damit liefen
Zeichnung und Kamerazustand während der Animation um einen Schritt auseinander.

`AtlasCanvas.requestFrame` besitzt jetzt den gemeinsamen Auftrag. Er berechnet
zuerst den aktuellen Zoom und zeichnet danach Karte und Hilfsebene. Während
der Kameraberechnung bleibt der Auftrag belegt, damit `set/apply` keine zweite
Zeichnung einplant. Während des Zeichnens dürfen animierte Hilfsebenen das
nächste Bild anfordern. Retargeting, Abbruch und Kamerawechsel verwenden den
aktuellen Zustand und dessen Generation. Das Stoppen einer Zoomanimation
verwirft keine gleichzeitig geplante Karten-/Hilfsebenenaktualisierung.

Der gemeinsame RAF-Zeitstempel kann vor einer schon verarbeiteten Eingabe
liegen. Die Zeit des tatsächlichen Aufrufs verhindert einen zusätzlichen
leeren Zoomschritt. Anker, Umkehr, Historie, reduzierte Bewegung und die
Freigabe von Autorentreffern nach erfolgreichem Zeichnen bleiben erhalten.

## Nachweis

Zwei neue Regressionen schlugen vorher gezielt fehl: im ersten Zoomframe
keine Zeichnung beziehungsweise bei bereits eingeplanter Hilfsebene eine
Zeichnung mit alter Kamera. Jetzt zeichnen beide Fälle in jedem geprüften
Schritt genau einmal die aktuelle Kamera. Weitere Fälle prüfen einen neuen
Kameraauftrag innerhalb der Rückmeldung und Grafikverlust während des Zooms.
137 betroffene Regressionen, beide TypeScript-Prüfungen und Desktop-Build
bestanden.

`tools/atlas-camera-frame-probe.mjs` ordnet GPU-Clears dem laufenden RAF zu
und vergleicht deren Kamerazustand mit dem Zustand am Ende desselben RAF.
Die rohe Navigationstrace ist in [vorher](before.json) und [nachher](after.json)
enthalten. `WORLD_CAMERA_TRACE=1` zeichnet auf;
`WORLD_CAMERA_TRACE=current` verlangt zusätzlich null veraltete
Navigationsframes. Das misst **GPU-Aufträge und Kamerazustand**, keine
Compositor-Präsentation oder Eingabe-bis-Pixel-Latenz.

| Native Weltprobe | Vorher | Nachher |
| --- | ---: | ---: |
| Gezeichnete RAFs bei Navigation | 79 | 83 |
| Davon Zeichnung mit vorheriger Kamera | 65 | 0 |
| Davon mehrfach gezeichnet | 0 | 0 |
| Zusätzliche Aufträge außerhalb RAF | 6 | 6 |
| Navigation RAF p95 | 26,4 ms | 24,5 ms |

108.076 Landschaftsobjekte, Intel i5-8365U / UHD 620. Keine parallelen eigenen
Builds oder nativen Proben während der Messung. Vorher PID 3154876, nachher
3157336: normaler Abschluss mit Code 0, Prozesse verschwunden, keine
Rendererfehler. Die nachgeladene Terrainveröffentlichung behält ihren
bisherigen Ablauf; während des Sculptings gibt es weiterhin auch RAFs mit
mehreren GPU-Aufträgen. Der gemeinsame Kameraauftrag behauptet keine globale
Ein-Zeichnung-Regel für alle asynchronen Terrainveröffentlichungen.

Die zusätzliche GPU-Gegenprobe enthält 43 exakte Bildvergleiche ohne
abweichende Pixel, darunter zwölf Kameraposen mit einer gemeinsamen Zeichnung.
Die gemessene erste Änderung in der Pinselinnenfläche lag nachher bei
189,1 ms und beim zweiten Zug bei 149,0 ms. Diese asynchron ausgelesenen
Pixelwerte enthalten Messaufwand; sie erfüllen das 100-ms-Ziel noch nicht.

Das 60-FPS-Ziel, die vollständige gemischte Welt, Pentium-7505-Qualifikation,
das Speicherplateau und die gestalterische Fantasykarten-Abnahme bleiben offen.

## Autoren- und Bedienweg

Der [native Autorenablauf](authoring.json) durchlief alle acht Schritte:
[Kontinente](02-continents.png), Relief, Wald, [unabhängiges Königreich](05-kingdom.png),
[Straße und drei Gebäude](06-settlement.png), [einen Raum bearbeiten](07-building-room.png)
und Wiederöffnen in einem frischen Prozess mit identischem gespeicherten Bestand.
Die Gebäude erzeugten keine Stadtdokumente. Die Prozesse 3158480 und 3159554
endeten normal und verschwanden; keine Rendererfehler.

Die Bilder wurden gesichtet: Die wenigen breiten Pinselzüge erzeugen weiterhin
stark gerundete Landformen; Relief und Bewuchs bleiben in dieser Übersicht
gestalterisch zu schwach. Dieser technische Autorenablauf ist deshalb kein
Nachweis einer ansprechenden fertigen Fantasywelt.

Die [Probe mit zurückgehaltenen echten Speicher-/Terrainantworten](pending.json)
bestand ebenfalls: Navigation und Pose bleiben nach Loslassen frei,
Autorenparameter bleiben geschützt, Undo/Redo liefern erfolgreiche Antworten.
Prozess 3159996 endete normal und verschwand; keine Rendererfehler.

Die bestehende [Pinselbedienprobe](brush-ux.json) bestand mit neun Gruppen,
einschließlich 640-px-Fenster, 200 % Zoom, Shift-Rad, aktiver Pinselsperre,
gekipptem Atlas, PNG und Wiederaufnahme bei 125 %. Prozesse 3160549, 3161134:
normaler Abschluss, verschwunden, keine Rendererfehler.
