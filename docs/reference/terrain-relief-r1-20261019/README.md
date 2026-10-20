# R1 — Höhenkern, Speicher und automatische Küsten

Bezug: [Relief-Roadmap](../../plans/maps/terrain-relief.md), Phase R1; R0 wurde durch die Nutzerantwort „Passt“ am 19.10.2026 visuell abgenommen. Dieser Durchlauf implementiert R1 im Electron-Produkt. Die gezeichnete Reliefdarstellung, vollständige Höhenpinseloberfläche und räumliche Ansicht bleiben R2–R5.

## Datenvertrag

- `src/app/terrain-height.ts` ist der gemeinsame browserfähige Kern. Eine Kachel enthält 64 × 64 Stützpunkte in Weltmetern, Float32 little-endian, `height.version: 1`. Unbeschriebene Stützpunkte erben den gröberen Stand. Ohne Autorenhöhe beträgt der Untergrund −100 m; anfänglicher Meeresspiegel 0 m.
- Bilineare Interpolation liest Nachbarkacheln auch bei negativen Koordinaten. Die gespeicherten räumlichen Grenzen umfassen den Interpolationsrand. Fein ausdrücklich gesetzte Stützpunkte haben Vorrang vor groben Änderungen; unbeschriebene Teile derselben Kachel folgen weiterhin dem gröberen Feld. An den Grenzen von Detailkorrekturen geht dieser Vorrang über eine Stützpunktweite weich in die geerbte Fläche über.
- Land entsteht bei Höhe **über** Meeresspiegel; Wasser bei Höhe **kleiner oder gleich** Meeresspiegel. Meeresspiegel ist ein kampagneneigener Metadatensatz im vorhandenen Landschaftsspeicher und Teil derselben History. Er hat keinen eigenen räumlichen Fußabdruck für den Kartenausschnitt. Änderungen daran überschreiben keine Höhenkacheln. Bei Meeresspiegel unter −100 m wird auch der bisher unbeschriebene Untergrund sichtbar und kann bemalt werden. Eine Füllung dieser unbegrenzten Grundfläche wird mit Hinweis auf den Farbpinsel abgewiesen.
- Bestehende Landwerkzeuge erzeugen Höhenkacheln: Hinzufügen hebt mindestens auf Meeresspiegel +100 m, Entfernen senkt höchstens auf Meeresspiegel −100 m. Die zeitabhängigen Varianten verändern Meterwerte. Das sind R1-Vorgaben; frei einstellbare Stärke, Glätten und Zielhöhe folgen in R2. Die bestehende Höheneigenschaft schreibt ebenfalls in den Höhenkern; ihr explizites Zurücksetzen gibt die betroffenen Stützpunkte wieder frei.
- `TerrainSampler.sample/query` liefert Höhe, tatsächlichen Stützpunktabstand, Neigung, Normale und Revision; `atlasHeight` stellt eine begrenzte Main-Abfrage über Preload bereit. Bereichs-/Vorschauantworten tragen die gemeinsame Atlasrevision. Die Anschlüsse aller Wetter-/Sicht-/Profilnutzer bleiben R6; daraus werden keine neuen Spielregeln abgeleitet.
- Süßwasser besitzt eine Autorenfläche und einen gespeicherten `waterLevelM`. Ohne eingegebene Vorgabe wird beim Anlegen der erste Punkt +1 m verwendet, mindestens Meeresspiegel +1 m. Gelände oberhalb des Wasserstands bleibt trocken; die Autorenfläche begrenzt den See. Keine Ausbreitung oder Abflussberechnung.
- Farbe bleibt eigenständig. Die Küsten- und Farbdarstellung wird aus den Höhen abgeleitet. Neue Landaufträge schreiben keine Landmaske. Bestehende Masken bleiben als historische Lesedaten erhalten; für diese Roadmap werden neue Kampagnen verwendet, vorhandene Kampagnen werden nicht gelöscht.
- Speicherformat 49 verhindert das Öffnen durch ältere Appversionen. Höhen und Meeresspiegel nutzen `atlas_landscape`, die vorhandenen Transaktionen, Befehlsbelege, Undo/Redo und Archive. Archivkopien behalten die Werte bei remappten IDs und bleiben weiterbearbeitbar. Darstellungskacheln und Lesecaches sind abgeleitet.

## Vollständigkeit und Zielabstimmung

| R1-Anforderung | Anschluss / Nachweis |
| --- | --- |
| Kontinuierliche gekachelte Höhen, lokale Verfeinerung | Bekannte schiefe Ebene, negative Koordinaten und Kachelgrenzen; Schutz feiner Korrekturen, explizites Reset und Undo |
| Gemeinsame Abfragen und versionierte Speicherung | Main-/Preload-Abfrage, Formatprüfung, exakte Wiederöffnung, Archivkopie und Weiterbearbeitung; doppelte Kacheln werden zurückgewiesen |
| Automatische Küste, keine zweite beschreibbare Maske | Land-/Radierwerkzeuge schreiben Meter; Vorschau und gespeicherter Raster stimmen bytegenau überein; native Fensterpixel für Insel, Meerenge und überflutete Fläche |
| Meeresspiegel und getrennte Farbe | Eigene Kampagneneinstellung mit Undo; Höhenbytes bleiben bei Meeresspiegeländerung gleich; bestehende Farbregressionen |
| Begrenztes Süßwasser mit Geländeprüfung | See über einer Fläche, trockene erhöhte Stelle, begrenzter Rand, Eraser und Archivkopie |
| Insel → Meerenge → Undo → Neustart | Native Electron-Eingaben und Screenshots; kanonische Daten zusätzlich direkt gelesen |
| Lesen und Fehlschläge verändern keine Autorenwerte | Vorschau-/Punktabfragen erhalten die Änderungskennung; simulierte SQLite-Schreibfehler und ungültige Versionen rollen atomar zurück; Escape verwirft den nativen Entwurf |

## Lokale Prüfung

Bestanden: [breiter Regressionslauf 93/93](regression.log), [abschließende Höhen-/Farbprüfung 18/18](final-checks.log), davon acht Höhenkern- und zehn Farbtests. Die abschließenden Läufe enthalten Wiederholungen und werden nicht zu einer Gesamtsumme addiert. `npm run check`, `check:desktop`, `check:repo`, Desktop-Build und `git diff --check` bestanden.

Der [native Ergebnisbericht mit Quellen-/Bundlehashes](result.json) bestätigt fünf vollständige Prüfabschnitte, keine Rendererfehler und regulären Prozessabschluss. Die aufgezeichneten Hashes wurden anschließend gegen die Arbeitskopie geprüft ([Verifikation](verification.json)). Native Fensterbilder: [Insel](01-island.png), [Meerenge](02-strait.png), [Meeresspiegel 150 m](03-sea-level.png), [Neustart](04-reopened.png). Insel- und Wasserfarben wurden zusätzlich direkt in den Fensterpixeln geprüft.

**R1 ist lokal vollständig implementiert und gegen seine Phasenanforderungen geprüft.** Keine R2–R7-Funktion wird als abgeschlossen gezählt. Der Nachweis gilt für die gemeinsame lokale Arbeitskopie; dort vorhandene Änderungen anderer Aufgaben wurden erhalten. Keine Paketinstallation, Main-Integration, exact-SHA-Candidate-CI oder Nutzerabnahme von R1 behauptet.

Reproduktion:

```sh
node build.mjs --test
node --test --test-concurrency=1 tests/terrain-height.test.mjs tests/desktop-land-mask.test.mjs tests/desktop-landscape-tools.test.mjs tests/desktop-land-color-separation.test.mjs tests/desktop-coast-render.test.mjs tests/desktop-atlas-region.test.mjs tests/desktop-atlas-regions.test.mjs tests/desktop-archive-transfer.test.mjs
npm run check
npm run check:desktop
npm run check:repo
npm run build:desktop
node tools/test-desktop-terrain-height.mjs
```

Die native Probe verwendet ein neues temporäres Profil, echte Electron-Controls sowie Maus-/Tastatureingaben über Playwright. Nur Einrichtung und Beobachtung lesen die Testdatenbank. Sie beendet die gestarteten Fenster regulär. Anfangs verwendete ältere Testselektoren passten nicht zur aktuellen Atlasnavigation; außerdem war `xdotool` auf diesem Host nicht vorhanden. Der neue Prüfweg benutzt die sichtbaren Bereichs-/Werkzeugbuttons und benötigt `xdotool` nicht.

Kein Leistungsnachweis für R7: Große Weltbestände, 30 FPS, 100-ms-Rückmeldung und das 16-GiB-Gerät sind durch diese Funktionsprobe nicht qualifiziert. R1 nutzt begrenzte Kacheln und bestehende Bereichsantworten; weitere Leistungsarbeit bleibt erforderlich.
