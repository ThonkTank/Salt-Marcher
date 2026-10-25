# A4: Grenzenlose Welt skalieren – Arbeitspakete

Status: Planned; alle Pakete offen.
Owner: atlas
Last Reviewed: 2026-10-25 (Zerlegung; keine Umsetzung)
Source of Truth: Paketumfang für A4; Ziele und gemeinsame Ausführungsregeln stehen in der [Roadmap](../performance-roadmap.md).

**Start:** A3 abgeschlossen. **Reihenfolge:** A4.01 bis A4.09.
Unsichtbare Arbeit reduzieren, nicht sichtbare Details. Vorhandene Terrain-LOD-
und Vegetationsregeln bleiben die Qualitätsreferenz.

Für jedes Paket gelten Zuständigkeit, Eingaben, Aufwand und Übergabe aus dem
[gemeinsamen Paketvertrag](handbook.md#gemeinsamer-paketvertrag). Fachkompetenz:
räumliche Geometrie, Kamerapräzision, GPU-Ressourcenbudgets und Quellenrevisionen;
A4.08/A4.09 zusätzlich native Langzeit-/Leistungsmessung. Eingaben sind der
geprüfte A3-Ressourcenvertrag und A1-Referenzen. Blocksichtbarkeit, Tileprodukte
und Auswahl bleiben an dieselbe Quelle gebunden; A5 erhält den qualifizierten
Navigationsstand samt Budget und verbleibenden Grenzen.

### A4.01 — Geometrie in stabile räumliche Blöcke einteilen

<!-- atlas-dependencies {"requires":["A3.12","R3.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A3.12.
- **Auftrag und Ergebnis:** Geometriebatches in kamerafeste Weltbereiche einordnen und konservative Grenzen halten. Bestehendes Welt-/Kachelraster nutzen, soweit geeignet; renderseitige Teilung großer Geometrie erhält Quellenkennung und Auswahlzuordnung. Den räumlichen Index inkrementell bei realen Änderungen aktualisieren.
- **Prüfung / fertig:** Kamerawechsel verändert Blockzuordnung nicht; ein geändertes Objekt aktualisiert nur alte/neue betroffene Blöcke. Grenzüberschreitende Straßen, Gebäude und Bilder erzeugen weder Lücken noch doppelt sichtbare Fläche. Einstieg: `src/app/atlas-world-tiles.ts`, `src/app/atlas-scene-geometry.ts`.

### A4.02 — Unsichtbare Blöcke vor der Zeichenarbeit aussortieren

<!-- atlas-dependencies {"requires":["A4.01","R3.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A4.01.
- **Auftrag und Ergebnis:** Gegen tatsächlichen Kameraausschnitt einschließlich Neigung, Höhe, Horizont, Linienbreite und kameraorientierten Labels prüfen. Nur sicher unsichtbare Blöcke aus der Zeichnung nehmen; Auswahl und Rendering verwenden denselben sichtbaren Stand.
- **Prüfung / fertig:** Objekte knapp außerhalb, an jeder Kante, unter Baumkronen und im geneigten Fernbereich prüfen. Sichtbare Pixel unverändert; außerhalb liegende Blöcke verursachen keine Zeichenaufrufe. Einstiege: `src/app/atlas-metric-camera.ts`, `src/app/atlas-horizon.ts`; native Referenz `tools/test-desktop-atlas-camera-coverage.mjs`.

### A4.03 — Ressourcenbudgets und Verdrängung schließen

<!-- atlas-dependencies {"requires":["A4.02","R3.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A4.02 und Ressourcenwerte aus A1/A3.
- **Auftrag und Ergebnis:** Sichtbare, vorbereitete und zurückgehaltene Geometrie-/Texturressourcen vollständig zählen. Konkrete getrennte Budgets aus gemessenem sichtbarem Arbeitsbedarf ableiten und dokumentieren; bestehende Terrainoberflächen-Grenzen nicht stillschweigend erhöhen. Unsichtbare Ressourcen verdrängen, sichtbare benötigte Inhalte nicht aus Qualitätsgründen streichen.
- **Prüfung / fertig:** Unter knappem Budget kontrolliert nachladen statt unbegrenzt wachsen; neue Quelle/Dispose gibt Referenzen frei. Ressourcenzähler gegen tatsächliche Anlagen/Freigaben prüfen. Überschreitet bereits der sichtbare Pflichtbestand das Budget, bleibt das Ziel offen und wird nicht durch Weglassen bestanden.

### A4.04 — Beschriftungen in gemeinsamen Texturressourcen halten

<!-- atlas-dependencies {"requires":["A4.03","R3.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A4.03; Diagnose zeigt verbleibende Labelkosten. Andernfalls mit Befund als entfallend dokumentieren.
- **Auftrag und Ergebnis:** Die verwendeten Schrift-/Saumvarianten in begrenzten gemeinsamen Texturseiten halten und Labelgeometrie bündeln. Kein Schriftwechsel, keine neue Platzierungslogik; kameraorientierte Transformation im gehaltenen Pfad durchführen. Aktive Labels vor Verdrängung schützen.
- **Prüfung / fertig:** Schärfe, Maße und Halo bei 100 %/200 %, Pan/Zoom/Neigung sowie Textänderung; neue Zeichen ergänzen nur betroffene Seiten. Einstieg: `src/app/atlas-deck-labels.ts`, `tests/atlas-camera-labels.test.mjs`.

### A4.05 — Wiederholte Symbole und Bilder bündeln

<!-- atlas-dependencies {"requires":["A4.04","R3.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A4.04 abgeschlossen oder begründet entfallen; Diagnose zeigt verbleibende Symbol-/Bildkosten.
- **Auftrag und Ergebnis:** Wiederholte gleiche Assets instanzieren beziehungsweise kompatible Texturen bündeln; für unterschiedliche transparente Reihenfolgen getrennte Gruppen behalten. Bestehende Vegetationsinstanzierung nicht erneut bauen.
- **Prüfung / fertig:** Gleiche Symbole besitzen unabhängige Lage, Farbe und Trefferkennung; Alpha-Löcher korrekt; Assetwechsel und Entfernen geben Ressourcen frei. Referenz: `src/app/atlas-deck-image.ts`, `tests/atlas-assets.test.mjs`. Ohne entsprechenden Hotspot entfällt das Paket mit Begründung.

### A4.06 — Große Koordinaten und Maßstabswechsel stabilisieren

<!-- atlas-dependencies {"requires":["A4.05","R3.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A4.05 abgeschlossen oder entfallen.
- **Auftrag und Ergebnis:** Ursprungwechsel als Transformation behandeln und Präzisionsprobleme an großen positiven/negativen Weltpositionen beheben. Objektgrößen, Linienprominenz, Textanker und bereits vorhandene semantische Übergänge über alle sechs Maßstäbe erhalten.
- **Prüfung / fertig:** Zoom am Weltpunkt, Hin-/Rückweg und Rotation ohne Drift, Flimmern oder Neuaufbau unveränderter kanonischer Geometrie. Tests `tests/atlas-metric-camera.test.mjs`, `tests/atlas-cartographic-scale.test.mjs`; native Probe `tools/test-desktop-atlas-scale-roundtrip.mjs`.

### A4.07 — Kachelabdeckung und gemischte Revisionen absichern

<!-- atlas-dependencies {"requires":["A4.06","R3.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A4.06.
- **Auftrag und Ergebnis:** Block-/Ressourcenänderungen mit bestehender Terrainnachladung verbinden: Elternfläche bis vollständiger Kindabdeckung halten, keine doppelten Flächen, gemeinsame gültige Höhen-/Materialrevision veröffentlichen. Sichtbare Arbeit hat Vorrang vor Vorladung, ohne den Detailmaßstab abzusenken.
- **Prüfung / fertig:** Langsame, vertauschte, abgebrochene und verspätete Antworten bei Kamerawechsel; keine leeren Quadranten oder Auswahl auf veralteter Quelle. Einstiege: `src/app/atlas-surface-tile-stream.ts`, `src/app/atlas-raster-tile-stream.ts`; `tests/atlas-surface-stream.test.mjs`.

### A4.08 — Langstreckennavigation und Speicherfreigabe messen

<!-- atlas-dependencies {"requires":["A4.07","R3.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A4.07.
- **Auftrag und Ergebnis:** Einen festen Weg durch mindestens 100 verschiedene räumliche Blöcke und zurück zweimal nacheinander ausführen; Kamera, Neigung, Quellenstand und Pausen manifestieren. Nach Rückkehr und Abschluss aller Aufträge gehaltene Ressourcen mit dem warmen Ausgangsbestand vergleichen.
- **Prüfung / fertig:** Budgets aus A4.03 werden eingehalten, verlassene Blöcke bleiben nicht referenziert, zweiter Durchlauf zeigt kein fortgesetztes Wachstum der Anwendungsressourcen. Prozess-RSS und GPU-Gesamtspeicher separat beobachten, nicht mit eigenen Pufferzählern gleichsetzen. Inhalte auf der Rückkehr unverändert.

### A4.09 — Vollständige geladene Navigationsmatrix qualifizieren

<!-- atlas-dependencies {"requires":["A4.08","R3.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A4.08.
- **Auftrag und Ergebnis:** A1-Matrix mit 36 Konfigurationen und drei Serien auf dem neuen Pfad ausführen, inklusive Referenzbildern und separater Diagnose auffälliger Fälle. Keine Pinsel-/Ladeoptimierung in diesen Messlauf hineinmischen.
- **Prüfung / fertig:** Jede geladene Serie p95 ≤ 33,3 ms, vollständige Bildqualität und fehlerfreies Prozessende. Fehlerfälle bleiben einzeln sichtbar; bei Zielverfehlung konkreten Engpass zur passenden Korrektur oder zum bedingten Architekturversuch zurückgeben. A4 bleibt dann offen.
