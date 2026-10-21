# R0 — Reliefprototyp und Zielabgleich

Dieser Nachweis gehört zur [Relief-Roadmap](../../plans/maps/terrain-relief.md), ausschließlich Phase R0. Die Produktdateien in `src/app/` und `desktop/` wurden durch diesen Ausbau nicht geändert. Bestehende fremde Arbeitskopieänderungen bleiben getrennt. Quellprototyp, keine installierte Produktversion und keine exact-SHA-CI-Abnahme.

## Prüfumfang

| R0-Anforderung | Tatsächlicher Nachweis | Urteil |
| --- | --- | --- |
| Küste, verzweigtes Gebirge, breites Tal, Pass, Plateau, Fluss und Bergdorf | Feste analytische Landschaft in `tools/terrain-relief-prototype/terrain.mjs`, numerische Höhenproben und native Bilder | Implementiert; endliches Testgebiet |
| Dieselben Daten in Draufsicht und räumlicher Ansicht | Canvas2D und Three.js lesen denselben Terrainstand; native Anheben-/Ansichtswechselprobe mit identischer Höhe | Bestanden |
| Schattierung und Schattierung mit Felsstrichen vergleichen | Zwölf native Aufnahmen: drei Maßstäbe × zwei Ansichten × zwei Stile | Vorhanden; siehe Bildvergleich |
| Kontinent, Region und Ort | Explizite Ansichtsvorgaben derselben Testlandschaft | Bestanden für R0; keine Welt-/Streamingqualifikation |
| Kamerabewegung und Geländetreffer | Tatsächliches Ziehen, Mausrad und Neigungsregler; Projektion → sichtbarer Mesh-Treffer vor/nach Navigation geprüft | Bestanden |
| Höhenpinsel im nativen Fenster | Pass über echte Zeigereingaben anheben; Undo, Redo, Escape und Ansichtswechsel | Bestanden |
| Natürlichkeit und Lesbarkeit | Ursprüngliche Spiegelung, übertriebene Ortshöhe und gleichmäßige Felsstriche visuell verworfen; überarbeitete Aufnahmen mit lesbarem Pass und Dorf | Agentenprüfung und anschließende Nutzerabnahme erfolgt |
| GPU auf dem Zielhost | Native Electron-Aufnahmen, GPU- und WebGL-Angaben in `summary.json` | Konkreter Hostnachweis; kein allgemeiner Hardwarebeleg |
| Visuelle Nutzerabnahme vor Produktintegration | Nutzerantwort „Passt“ am 19.10.2026 | **Abgenommen; R1 freigegeben** |

## Tests und Wiederholung

Die sechs Modelltests prüfen Land/Meer und Geländeformen, begrenzte Pinselwirkung, Abbruch/History, Wasserwechsel, abfragegleiche Meshelemente sowie kontinuierliche Züge bei wenigen/vielen Eingabeereignissen und Richtungswechseln. Der native Test betätigt die echten Controls und erfasst Screenshots aus dem tatsächlichen Electron-Fenster. Er prüft normalen Exitcode 0. Die technischen Cases ersetzen keine visuelle Nutzerabnahme.

### R0-Nachprüfung: kontinuierliche Pinselzüge

Die erste Probe bewegte den Zeiger beim Malen nur um einen Pixel und belegte deshalb keinen längeren Zug. Die Quellenprüfung fand eine Lücke: nur einzelne Abdrücke trugen Höhe bei; ein schneller Zug konnte dazwischen unverändert bleiben. Zwei zusätzliche Modelltests reproduzierten dies zunächst als Fehler. Der Kern berechnet jetzt den Abstand zum gesamten erfassten Linienzug. Abweichende Ereignisdichte und erneutes Überfahren innerhalb derselben Geste ändern die Stärke nicht; Ecken werden nicht diagonal abgekürzt.

Im erneuten nativen Gesamtlauf wurden zusätzlich 4 km mit 500 m Radius und 300 m Stärke einmal mit einem Bewegungsschritt und einmal mit 24 Schritten gezeichnet. An 17 Punkten war die Wirkung durchgehend 300 m (maximale numerische Abweichung unter 0,000001 m); zwischen beiden Zugvarianten betrug die Abweichung 0. Ein Randpunkt außerhalb blieb unverändert. Rücknahme entfernte den ganzen Zug, Ansichtswechsel erhielt ihn. Normaler Exitcode 0.

[Nachlauf mit Quellenbindung](continuity/summary.json), [Draufsicht](continuity/continuous-fast-stroke-top.png), [räumliche Ansicht](continuity/continuous-stroke-tilted.png), [vorher fehlgeschlagene Tests](continuity/before-tests.log), [danach bestandene Tests](continuity/after-tests.log). Die ursprüngliche `summary.json` und der Stilvergleich bleiben historische R0-Belege; `continuity/summary.json` bindet die überarbeitete Quelle. Das bereits offene Sichtungsfenster wurde nicht neu geladen und behält seinen vorherigen Sitzungsstand; die Korrektur ist im neu gebauten Prototyp enthalten.

Für die Wiederholung am aktuellen Quellstand genügt die Root-Installation. Die unten gebaute R0-Anwendung verwendet dieselbe exakt gepinnte Three.js-Abhängigkeit; die historischen Quellenhashes und Aufnahmen oben bleiben Belege ihres damaligen Standes.

```sh
npm ci
node tools/terrain-relief-prototype/build.mjs
node --test tests/terrain-relief-prototype.test.mjs
node tools/test-desktop-relief-prototype.mjs
```

Zusätzlich geprüft: ES-Modul-/Main-Syntax, `git diff --check`, `npm run check:repo`. Kein produktiver TypeScript-Einstieg verändert; kein Produktpaket erstellt. Gesamte Candidate-CI gehört vor Integration der späteren Produktlieferung.

## Zielabstimmung und technische Folgen

- Kein Berg-Decal als Höhenersatz: Schattierung, Striche und Mesh entstehen aus derselben Fläche. Pinsel ändert echte Meterwerte.
- Küste wird aus Höhe 0 abgeleitet. Der Prototyp besitzt keine separat bearbeitbare Landmaske.
- Überhöhung und Kameramaßstab verändern keine gespeicherten beziehungsweise sitzungsgebundenen Höhen.
- Der nachgewiesene Pinsel arbeitet pro Zug mit begrenzter Stärke; er ist nicht das endgültige R2-Werkzeug.
- Die gezeichnete Optik bleibt eine frühe Stilprobe. R4 muss den Stil mit produktiven Autorenformen und kontinuierlichen Maßstabsübergängen erneut qualifizieren.
- Kleine Änderungen aktualisieren nur betroffene Rasterpunkte/Vertexattribute. Kameraschwenken verwendet die vorhandene Geometrie innerhalb ihres gepufferten Bereichs weiter. Komplette Neuaufbauten sind weiterhin synchron und teilweise deutlich langsamer; Worker/Streaming und Großbestandsgrenzen bleiben R1/R5/R7-Arbeit.
- Laufzeitangaben messen JavaScript-Verarbeitung bis Render-Aufruf, keine physische Bildschirmpräsentation. RAF-Abstände enthalten Leerlauf und sind kein Navigations-FPS-Nachweis. Der Host besitzt rund 39 GiB RAM; die echte 16-GiB-Prüfung bleibt offen.
- Im ursprünglichen Lauf betrug die letzte erfasste Pinselverarbeitung **189,5 ms**, im Kontinuitätsnachlauf **34,8 ms**. Die Proben unterscheiden sich; daraus folgt kein direkter Leistungsvergleich und keine Behauptung, das 100-ms-Ziel sei durchgehend erreicht. Vollständige Neuaufbauten liegen teilweise über 300 ms. Der Engpass ist für die produktive Umsetzung weiter offen.
- Keine SQLite-Persistenz, Kampagnenmigration, Heightmap-Übernahme, produktive Gebäudebindung, Spielregeländerung oder Spielerprojektion vorgezogen.

## Ergebnis des Durchlaufs

R0 ist technisch implementiert, lokal funktional geprüft und durch die Nutzerantwort „Passt“ am 19.10.2026 visuell abgenommen. Die zuvor dokumentierte Blockade durch ausstehende Nutzerbewertung ist aufgehoben. R1 folgt als eigener Durchlauf; dessen Produktnachweis steht getrennt in der Roadmap.
