# R0: Reliefstudie

Isolierter Prototyp zur [verbindlichen Roadmap](../../docs/atlas/requirements/terrain-relief.md). Kein Zugriff auf CampaignWorkbench, kein Produktformat, keine Persistenz. Ein endliches synthetisches Gelände demonstriert Küste, verzweigte Bergkämme, Pass, Tal, Plateau, Fluss und Dorf. Maßstabsnamen sind Ansichten dieser Testlandschaft, kein Beleg für weltweites Streaming.

## Starten und prüfen

Node.js 22; Root-Abhängigkeiten einschließlich Electron müssen installiert sein.

```sh
npm ci
node tools/terrain-relief-prototype/build.mjs
node_modules/electron/dist/electron .build/relief-r0/main.cjs --ozone-platform=x11
```

```sh
node --test tests/atlas/terrain-relief-prototype.test.mjs
node tools/test-desktop-relief-prototype.mjs
```

Native Belege: `.build/relief-r0-evidence/`, mit `QA_EVIDENCE_DIR` umleitbar. Der Test startet ein eigenes Electron-Fenster und einen temporären Profilordner, benutzt tatsächliche UI-Eingaben, prüft normales Ende und erfasst GPU-Informationen. Er behauptet keine Nutzerabnahme oder Produkt-/Paketqualifikation. Build und Prototyp verwenden die exakt gepinnten Root-Abhängigkeiten einschließlich Three.js; eine zweite Installation oder ein eigenes Lockfile ist nicht nötig. Das gebaute Fenster bleibt ohne Produktzugriff isoliert.

## Bedienung

- Draufsicht/Räumlich zeigen denselben Höhenstand; drei Maßstäbe und zwei Stile vergleichen.
- Erkunden: ziehen und Mausrad; räumlich Neigung/Drehung einstellen.
- Anheben/Absenken: ziehen; Radius in Metern, Höhenänderung pro Zug. Kein zeitabhängiges Aufsummieren beim Halten.
- Auch schnelle Züge wirken entlang des gesamten Linienverlaufs. Zusätzliche Ereignisse und erneute Überfahrten innerhalb desselben Zugs verstärken ihn nicht. Kurven folgen den erfassten Segmenten; nicht erfasste Kurven werden nicht erfunden.
- Eine Geste = ein Undo-Schritt; Escape verwirft, Rückgängig/Wiederholen bleibt ansichtsübergreifend.
- Rechte Maustaste verschiebt auch beim Malwerkzeug. Fokusverlust bricht einen offenen Pinselzug ab.
- Höhenüberhöhung betrifft nur Darstellung. Maßstabswechsel setzt sinnvolle Ansichtsvorgaben (Kontinent 8×, Region 2×, Ort 1×), keine Höhen.

## Gestaltungsentscheidung R0

Landschaft ist die Hauptfläche, links eine schmale Werkzeugspalte. Ruhige, linksbündige Bedienelemente; keine dekorativen Kartenkacheln. Noto Sans für Werkzeuge, Noto Serif für Ortsnamen. Palette: Wasser `#acc8cd`, Wiese `#bfc6a6`, Fels `#bbb6a5`, Schrift `#263c43`, Werkzeugakzent `#326273`, Oberfläche `#f8fafa`. Farbe trägt Material und Höhe, dezente hangorientierte Striche nur steile Felsbereiche. Keine animierte Kamerafahrt.

Erste Bildkritik: gespiegelte räumliche Orientierung, zu hohe Ortsüberhöhung und gleichförmige Striche wurden vor Weitergabe korrigiert. Abgelehnte Aufnahmen bleiben lokal unter `.build/relief-r0-rejected/` getrennt vom aktuellen Prüflauf.

## Grenzen gegenüber R1–R7

Analytische endliche Landschaft und sitzungsgebundene Pinselzüge statt produktivem Kachelstore; einfaches Raster statt dynamischer Weltverfeinerung; Dorfkörper/Fluss sind Testgeometrie. Gebäude-/Dungeonbindung, Höhenimport, Terrain-Commands, SQLite, Spielerprojektion und Exporte folgen erst in ihren Roadmapphasen. Sichere und flüssige Großbestandsbedienung muss separat qualifiziert werden.
