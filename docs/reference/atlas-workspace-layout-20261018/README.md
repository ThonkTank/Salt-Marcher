# Atlasarbeitsplatz: native Layout- und Bedienprüfung

Die Anwendungshülle und der Atlas wurden gemeinsam umgebaut. Verglichen wurden eigene synthetische Kampagnen im nativen Electron-Fenster. Die Baseline stammt aus `3dae9db238ec1d1a6456ad520d10e7165d8915e1`; der neue Stand ist eine darauf aufbauende Arbeitskopie. `after.json` hält die tatsächlich geprüften Renderer-/CSS-Prüfsummen fest. Das ist kein Installations- oder Owner-Abnahmebeleg.

| Zustand bei 1280 × 800 | Tatsächliche Canvasfläche | Anteil am Fenster |
| --- | --- | --- |
| Vorher | 670 × 522 | 34,15 % |
| Eine Werkzeugleiste | 1000 × 730 | 71,29 % |
| Werkzeugleiste eingeklappt | 1280 × 730 | 91,25 % |
| Karte maximiert | 1280 × 800 | 100 % |

[Vorher](before.png), [neuer Arbeitsplatz](after.png), [Bebauungsvorschau](city-preview.png), [neu gezeichneter Raum](new-room.png).

Geprüft wurden Suche/Auswahl, Raumtextänderung, rechte Zusatzleiste, Einklappen/Maximieren, Flusszeichnung mit Enter, Space-Ziehen, Straßen-/Viertelzeichnung, Übernahme einer Bebauungsvorschau, Raumrechteck per Ziehen, Bildausgabe und Rückkehr aus einem anderen Produktbereich. Musik-, Status-, Bereichs- und weitere Menüs verändern die Kartenabmessungen nicht. Nach normalem Beenden wurde die Kampagne in einem neuen Prozess geöffnet und der neue Raum über die Suche wiedergefunden. Die gespeicherten Raumtexte und die Stadt wurden anschließend auch im kanonischen Store geprüft.

Weitere tatsächliche Fenstermaße: 1366 × 768 und 1920 × 980; die angefragte Höhe 1080 wurde vom nativen Fenstersystem auf 980 begrenzt. 200 % UI-Skalierung bei 1280 × 800 entspricht 640 × 400 CSS-Pixeln. Alle geprüften Zustände hatten keine horizontale Seitenscrollleiste. Auf schmalen Fenstern wird kein zweites dauerhaftes Seitenpanel erzwungen.

Die bestehende Autorenprüfung mit 1600 Räumen bestand bei Zoomfaktor 1 und 2: mehrdeutige Trefferwahl, echte Raumgriffe über Rasterdarstellung, fortgesetzter Polygonentwurf, Canvas-Wiederherstellung, Abbrechen, Eckpunktänderung, Undo/Redo und Wiederöffnung. Sämtliche dort erfassten Prozesse endeten normal. Zusammenfassung: [authoring.json](authoring.json). Layoutläufe: [before.json](before.json), [after.json](after.json).

Wiederholen mit Node.js 22 nach `npm ci`, `npm run desktop:runtime` und `npm run build:desktop`:

```sh
python3 tools/ui-session.py node tools/test-desktop-atlas-layout.mjs
python3 tools/ui-session.py node tools/test-desktop-atlas-author-overlay.mjs
```

95 gezielte Tests nach der Zusammenführung mit den aktuellen Tür- und Wiederaufnahmeänderungen für Atlas, Frame-/Reisekontext, Autorenüberlagerung, Dungeonentwürfe, Raumtexte und gemeinsame Livefläche bestanden lokal. Die verpflichtende vollständige Candidate-CI bleibt ein eigener Nachweis. Der direkte vollständige Bedienvergleich mit allen vier Originalprodukten, physische Touchpadgesten und die visuelle Owner-Abnahme sind damit nicht abgeschlossen. Benutzerbestände wurden für diese Prüfungen nicht geöffnet; eine installierte Produktversion wurde nicht ersetzt.


## Grundriss bis zur PNG-Ausgabe, 19.10.2026

Neue direkte Prüfung der Aufgabe: leere Kampagne öffnen, Dungeon platzieren,
Torhalle/Wachstube/Archiv zeichnen und benennen, zwei Türen setzen, Torhalle
am Wandgriff vergrößern, aktualisierte PNG ausgeben. Native Wiederöffnung,
Undo/Redo, Raum-/Türidentitäten und unveränderte Raumtexte wurden zusätzlich
geprüft. Normale und doppelte Geräteskalierung, vier normale Prozessexits.
Der vorhandene automatische Fokus nach Dungeonplatzierung funktioniert;
die Probe wartet jetzt seinen Abschluss ab.

Die vorherige Ansichtsausgabe hatte viel leeren Rand. **Dungeon-Grundriss**
verwendet stattdessen die vollständigen indizierten Geschossgrenzen, auch bei
Offscreen-Räumen oder Rasterdarstellung. Der Rahmen wird nach einer späteren
Vergrößerung neu abgeleitet, fehlt bei unpassenden Geschossdaten ausdrücklich
und schreibt keine Geometrie. Eine überlagernde rechte Leiste verdeckt die
Vorschau nicht mehr. Der Maßstab erhält eigenen Platz unter dem Grundriss.
Freie Ansicht und manuell gezogener Ausgabebereich bleiben verfügbar.

[Vorherige Ansichtsausgabe](groundplan-viewport-before.png),
[ausgegebener Grundriss](groundplan-framed.png),
[native Vorschau bei doppelter Skalierung](groundplan-preview-200.png),
[Prozesse und Quellhashes](groundplan-20261019.json).

Dieselbe Aufgabe wurde in der echten Weboberfläche von Dungeon Scrawl
(`https://app.dungeonscrawl.com/`, 19.10.2026; keine Buildnummer sichtbar)
ausgeführt: Rechtecke/Korridore, zwei Türsymbole, separate Raumtexte mit
Schriftkorrektur, überlappende Erweiterung der Torhalle, tatsächlicher
PNG-Download (1400 × 910) und visuelles Öffnen der Datei. Eine versehentlich
nicht überlappende Erweiterung wurde rückgängig gemacht. Das finale Ergebnis
ist zusammenhängend. Der vorgeschlagene Inhaltsrahmen ersparte dort manuelles
Einrahmen. [Weboberfläche](groundplan-scrawl-ui.jpg),
[tatsächliche PNG](groundplan-scrawl.png). Keine Anmeldung, öffentliche
Veröffentlichung oder Neustartqualifikation des Vergleichsprodukts.

Wiederholen: `python3 tools/ui-session.py node tools/test-desktop-dungeon-groundplan.mjs --moved-wall --dungeon-frame`.
95 gezielte Canvas-, Export-, Autorenüberlagerungs- und Entwurffälle bestanden
lokal. Vier neue Fälle sichern Offscreen-/gedrehte Geschossgrenzen,
Neuberechnung nach Vergrößerung, Maßstabsabstand und unverdeckte Vorschau.
Diese begrenzte Aufgabe belegt weder vollständige Dungeon-Scrawl-Parität noch
menschliche GM-Vorlieben, installierte Pakete oder Owner-Abnahme.
