# Technische Atlasbereinigung – 22.10.2026

Die beiden Workbench-Dateien bündeln jetzt ihre Komponenten, statt auch deren
gesamten Zustand zu besitzen. [Zuständigkeiten und Datenfluss](../../development/atlas-rendering.md#zuständigkeiten-und-datenfluss)
beschreiben Laden, Autorenaktionen, Zeichnung, Reise, Ausgabe, Pinselzug,
Trassensitzung und Landschaftsauswahl. Main/SQLite, IPC, Datenformate,
Werkzeugangebot und Oberfläche bleiben unverändert. Die konkrete Korrektur:
späte Close-/Ready-Callbacks einer alten Trassensitzung dürfen die nächste
Sitzung nicht leeren; Kontextwechsel entwerten die zugehörigen Lese-/Ausgabeaufträge.

## Lokale Regressionen

- 439 gezielte Atlas-, Landschafts-, Terrain- und Controllerfälle bestanden.
- Weitere 19 Drawing-Draft-Lifecycle-Fälle bestanden. Die Testvorbereitung
  verwendet die echten extrahierten Komponenten; bestehende Fault-Injections
  und Aussagen bleiben über einen ausschließlich im Test verwendeten Adapter
  erreichbar. Keine Produktions-Kompatibilitätsschicht.
- `npm run check:repo`, `check`, `check:desktop`, `build`, `build:desktop` bestanden.
- `tests/atlas-controller-lifecycle.test.mjs` hält erste Geländeantworten und
  Trassensitzungen gezielt zurück und prüft Abbruch und Nachfolgesitzung.

Die vollständige Repositoryqualifikation gehört zum verpflichtenden
Candidate-CI des exakten PR-SHA. Lokale Teilprüfungen ersetzen sie nicht.

## Native Abläufe

Alle Sitzungen verwenden isolierte künstliche Profile und den normalen
Electron-Start auf demselben Wayland-Host. Kein installiertes Paket oder
persönlicher Datenbestand wurde verändert.

| Ablauf | Beleg | Ergebnis |
| --- | --- | --- |
| Hauptkamera neigen/drehen, Raum und Objekt wählen, Raum erstellen/Eckpunkt ändern, Undo/Redo, Stadtobjekte, GPU-Ausfall/Retry, frischer Prozess | [Vorher](camera-before.json), [nachher](camera-after.json), [Bild vorher](camera-before.png), [Bild nachher](camera-after.png) | Beide bestanden, keine Rendererfehler, normale Prozessenden |
| Raum suchen, PNG speichern, Atlasmenü nach Ausgabe benutzen, Katalog/Atlas wechseln, erneut auswählen, frisch öffnen | [100 Prozent](output-100.json), [200 Prozent](output-200.json), [Bild](output-200.png) | Beide bestanden, PNG-Inhalt/Größe geprüft, je zwei normale Prozessenden |
| Straße und Fluss in derselben Hauptkamera planen, Einheiten/200 Prozent, speichern, Schutz umschalten, Löschen/Undo, echter Geländepinselzug, frisch öffnen | [Ergebnis](routes-after.json), [Bild](routes-after.png) | Bestanden, keine Rendererfehler |

Reproduktion nach `npm run build:desktop` und installiertem Electron-Runtime:

```sh
QA_EVIDENCE_DIR=.build/cleanup-camera python3 tools/ui-session.py node tools/test-desktop-atlas-main-camera.mjs
QA_EVIDENCE_DIR=.build/cleanup-output python3 tools/ui-session.py node tools/test-desktop-atlas-cleanup.mjs
QA_EVIDENCE_DIR=.build/cleanup-routes python3 tools/ui-session.py node tools/test-desktop-terrain-routes.mjs
```

## Vergleich großer Karten

`tools/measure-atlas-runtime.mjs` verwendet nun die aktuelle Werkzeugleiste,
verwirft den Vorschauzug vor Pointer-up und prüft die unveränderte Datenrevision.
Der Menüweg und die Standardplattform entsprechen dem normalen Start. Beide
Versionen verwenden dasselbe aktualisierte Messskript; die Nachher-Läufe lesen
Kopien derselben vorbereiteten SQLite-Bestände. Umfang: 101.200 Landschaftsrecords
und 5.000 Gebäude, 100 Prozent, je ein Pan-/Hover-/Vorschau-/Zoomzyklus.

Die [Messwerte](performance.json) enthalten zwei Paare in wechselnder Reihenfolge,
Runtime-Hashes, CPU-/Task-Zeiten und normale Prozessenden. Das ist ein begrenzter
Vergleich auf diesem Rechner, keine statistische oder physische 16-GiB-Abnahme.
Vorhandene Überschreitungen der 16-ms-Kamera- und 50-ms-Vorschauziele bleiben
sichtbar. Aus dem Umbau wird keine Leistungsverbesserung abgeleitet.

| Messwert in ms, Spanne der beiden Läufe | Vorher | Nachher |
| --- | ---: | ---: |
| Landschaft öffnen | 4645–4719 | 4650–4795 |
| Landschaft erneut einblenden | 1902–2002 | 2001–2390 |
| Stadt öffnen | 2769–2806 | 2576–2659 |
| Stadt erneut einblenden | 1406–1448 | 1432–1528 |
| Stadt-Zoom CPU Median | 86–93 | 95–96 |
| Stadt-Zoom CPU p95 | 119–131 | 147–148 |

Insbesondere der Stadt-Zoom hat in diesen Läufen höhere CPU-Spitzen, während
die Task-p95-Spannen überlappen (vorher 184–247 ms, nachher 206–209 ms).
Zwei Läufe trennen Hostschwankungen und einen kleinen Refactoringeffekt nicht
verlässlich; eine generelle Performance-Regressionsfreiheit wird nicht behauptet.

Die Vorher-Runtime wurde vor den Produktänderungen aus
`02673afb2e04e828a32cf17b22e86cac45fc48ea` gebaut und separat eingefroren.
Ihr Renderer-SHA256 ist
`35d0d4b2ea64427a3db4091454acd9abf736105d4565283f44ed2628cdeb34a7`.
Die Nachher-Runtime hat den Renderer-SHA256
`be81c81d3fc9112d59061b8642cd3346f56bf3c52bf1e1cdd82405e0644bab2c`.
Die Belege entstanden vor dem Commit: `source`/`commit` nennen deshalb den
Basiscommit und `dirty` ist wahr. Bei Vorher-Sitzungen identifizieren die
Runtime-Hashes den ausgeführten Stand; Quellhashes aus dem gleichzeitig
bearbeiteten Checkout sind kein Beleg für dessen Vorher-Quellen.

## Bekannte offene Grenzen

`tools/test-desktop-region-export.mjs` scheitert sowohl mit der eingefrorenen
Vorher-Runtime als auch nachher an derselben Beschriftungsnaht:
`Falkenbrück must continue right of the 512-pixel seam` (Zeile 70).
Die vorangehenden Terrain-/Orts-/Wegaktionen und der PNG-Auftrag liefen durch;
der anschließende 200-Prozent-/Wiederöffnungsabschnitt dieses Ablaufs wurde
nicht erreicht. Der neue Ausgabe-/Navigationscheck ersetzt diese Nahtprüfung
nicht. Deren Assertion wurde unverändert gelassen.

Drei ältere Einstiegsproben waren bereits vor dem Umbau rot: Atlas-Layout
wartet nach der Stadtgenerierung auf Undo, Atlas-Navigation erwartet noch eine
flache Hintergrundfarbe, Navigation-Pending scheitert an der gehaltenen
Detailantwort. Sie werden hier nicht als bestanden oder redundant bewertet.
Die erfolgreichen, oben verlinkten Abläufe sind eine gezielte native
Regression, keine vollständige Produkt- oder Eigentümerabnahme.
