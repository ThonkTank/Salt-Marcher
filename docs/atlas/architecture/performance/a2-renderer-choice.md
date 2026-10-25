# A2: Renderer auswählen – Arbeitspakete

Status: Planned; alle Pakete offen.
Owner: atlas
Last Reviewed: 2026-10-25 (Zerlegung; keine Umsetzung)
Source of Truth: Paketumfang für A2; Ziele und gemeinsame Ausführungsregeln stehen in der [Roadmap](../performance-roadmap.md).

**Start:** A1 samt unabhängigen Reviews abgeschlossen. **Reihenfolge:** A2.01 → A2.02, danach zwei unabhängige Prototypenketten: A2.03 → A2.04 und A2.05 → A2.06 → A2.07 → A2.08 → A2.09 → A2.10. Beide müssen vor A2.11 fertig sein; A2.12 entscheidet auf dessen gemeinsamen Vergleich. Gleichzeitige Arbeit setzt getrennte Schreibbereiche voraus.
Die Prototypen bleiben im Benchmarkpfad. Kein zweiter produktiver Editor, keine
Änderung von Speicher- oder Werkzeugsemantik. Jedes Paket ergänzt nur einen
abgegrenzten Darstellungsaspekt; der Vergleich erfolgt erst nach vollständiger Szene.

Für jedes Paket gelten Zuständigkeit, Eingaben, Aufwand und Übergabe aus dem
[gemeinsamen Paketvertrag](handbook.md#gemeinsamer-paketvertrag). Fachkompetenz:
TypeScript, metrische Kameras und GPU-Geometrie; A2.03/A2.04 deck.gl/luma,
A2.05–A2.10 Three.js und Shaderübertragung, A2.11 native Vergleichsmessung.
Schnittstelle beider Kandidaten ist ausschließlich der Anschluss aus A2.02 mit
denselben Szenen/Assets aus A2.01 und Messregeln aus A1; Ergebnisempfänger ist A3.
Die im Paketgraphen genannten `writeScopes` sind exklusive Schreibzuständigkeiten.
Die Kandidaten schreiben getrennt unter `tools/atlas-benchmark/comparison/deck/`
und `tools/atlas-benchmark/comparison/three/`; gemeinsame Kamera-/Geometrieeingänge
bleiben beim Prototypvergleich read-only. Benötigte Änderungen an diesen Eingängen
werden vor weiterer Parallelität als eigener gemeinsamer Auftrag abgestimmt.
Gepinnte native Prüfbuilds sperren gleichzeitige Arbeit an allen Buildinputs.

### A2.01 — Gemeinsame Vergleichsszenen bereitstellen

<!-- atlas-dependencies {"requires":["A1.11","R1.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A1.11.
- **Auftrag und Ergebnis:** Aus derselben Prüfkampagne feste Welt-, Dorf- und geneigte Szenen mit kanonischer Geometrie, Terrainprodukten, Vegetation, Transparenz, Texten und einer Pinseländerungsfolge exportieren. Quelldaten und Textur-/Schriftassets über Hashes binden; erwartete Inhalte und Kameras als Manifest festhalten.
- **Prüfung / fertig:** Beide späteren Kandidaten erhalten identische Eingaben. Szeneninhalt gegen `tests/fixtures/atlas/mixed-world-manifest.json` und ausgewählte sichtbare Merkmale prüfen; keine Vereinfachung auf dekorative Dreiecke. Einstieg: `tools/atlas-reference-fixture.mjs`, `src/app/atlas-canvas-scene.ts`.

### A2.02 — Gemeinsamen Prototypenanschluss bauen

<!-- atlas-dependencies {"requires":["A2.01","R1.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A2.01.
- **Auftrag und Ergebnis:** Einen kleinen Benchmarkanschluss für Szene setzen, Kamera setzen, eine lokale Änderung anwenden, fertigen Frame abwarten, Bild erfassen und Ressourcen freigeben definieren. A1-Zeit-/Ressourcenprotokoll anbinden; keine generische Pluginarchitektur entwickeln.
- **Prüfung / fertig:** Ein Kontrolladapter beweist Frame-/Revisionsbindung, asynchronen Abschluss, Fehlerweitergabe und Dispose. Beide Kandidaten werden vom selben Gestenablauf angesteuert; kein unterschiedlicher Kameraweg oder Qualitätswert.

### A2.03 — deck.gl-Geometrie im Prototyp bündeln

<!-- atlas-dependencies {"requires":["A2.02","R1.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A2.02.
- **Auftrag und Ergebnis:** Bestehende Zeichenpfade im Prototyp um kompatible vertexgefärbte Geometriebatches ergänzen. Semantische Einträge für Auswahl behalten; nicht global nach Farbe sortieren. Terrain und Vegetation unverändert übernehmen, damit ihr Anteil vergleichbar bleibt.
- **Prüfung / fertig:** Zeichenaufrufe vor/nach Bündelung zählen; Farb-, Transparenz- und Überlappungsbilder der Vergleichsszenen stimmen. Einstiege: `src/app/atlas-deck-drawing.ts`, `src/app/atlas-object-geometry.ts`; Regressionseinstieg `tests/atlas-drawing-geometry.test.mjs`.

### A2.04 — deck.gl-Ressourcen im Prototyp behalten

<!-- atlas-dependencies {"requires":["A2.03","R1.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A2.03.
- **Auftrag und Ergebnis:** Stabile Identitäten, Datenreferenzen und lokale Ursprünge im Prototyp halten; Kamera und ein Farbentwurf ändern keine unveränderten Modelle. Aktualisierungen eines Bildes gemeinsam übergeben.
- **Prüfung / fertig:** A1-Zähler zeigen Wiederverwendung bei Kameragesten und lokaler Änderung; erste sichtbare Vorschau enthält die korrekte Revision. Bestehende Layerinstanzen dürfen neu entstehen, sofern ihre GPU-Ressourcen erhalten bleiben. Keine neuen Warteframes einführen.

### A2.05 — Three.js-Kamera und feste Geometrie darstellen

<!-- atlas-dependencies {"requires":["A2.02","R1.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A2.02. Der unabhängige deck.gl-Kandidat muss erst für A2.11 fertig sein.
- **Auftrag und Ergebnis:** Im zweiten Prototyp metrische Kamera, lokale Ursprünge und gebündelte opake Gebäude-/Raumgeometrie anschließen. Dieselben Projektionen und Höhen verwenden; keine zweite Kartenkoordinatenkonvention erfinden.
- **Prüfung / fertig:** Definierte Anker und Kanten stimmen in Draufsicht sowie 45°/75° mit der Referenz überein. Rotation, Weltmaßstab und große Koordinaten prüfen. Einstiege: `src/app/atlas-metric-camera.ts`, `src/app/atlas-object-geometry.ts`, `tests/atlas-perspective-camera.test.mjs`.

### A2.06 — Three.js-Terrainoberfläche übernehmen

<!-- atlas-dependencies {"requires":["A2.05","R1.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A2.05.
- **Auftrag und Ergebnis:** Vorhandene Höhengeometrie, Grundfarbe, Masken und Kacheltransformationen in den Prototyp übernehmen. Kanten, UVs, Normale und Tiefenverdeckung gegen Gebäude erhalten; gleiche Rasterauflösung wie im ersten Kandidaten.
- **Prüfung / fertig:** Keine Kachelnaht, Höhenabweichung oder falsche Verdeckung in den festen Ansichten; Terrainmodelle bleiben bei Kameraänderungen bestehen. Einstieg: `src/app/atlas-terrain-tile-model.ts`, `tests/atlas-terrain-tiles.test.mjs`.

### A2.07 — Three.js-Materialdarstellung vervollständigen

<!-- atlas-dependencies {"requires":["A2.06","R1.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A2.06.
- **Auftrag und Ergebnis:** Die in den Vergleichsszenen genutzten Gelände-Modi, Reliefzeichnung, Licht, Schnee/Fels, Wasser und Horizontdarstellung auf dieselben Materialprodukte abbilden. Keine billigere Schattierung im Vergleich einsetzen.
- **Prüfung / fertig:** Szenenausschnitte für Küste, Hang, Pigment und Fernbereich sichtbar vergleichen; Masken und Maßstabsregeln bleiben identisch. Einstiege: `src/app/atlas-terrain-material-layer.ts`, `src/app/atlas-horizon.ts`. Noch kein produktiver Austausch.

### A2.08 — Three.js-Bewuchs übernehmen

<!-- atlas-dependencies {"requires":["A2.07","R1.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A2.07.
- **Auftrag und Ergebnis:** Bestehende Instanzen und dekorative Flächentexturen für die Vergleichsszenen übernehmen. Dichte, Maßstabsübergang, Wasserunterdrückung und Kronengröße beibehalten; keine neue Vegetation erzeugen.
- **Prüfung / fertig:** Instanzzahlen und Anker stimmen, Waldsäume und Freiflächen bleiben sichtbar, Zoom wandert nicht durch neue Zufallsbestände. Einstiege: `src/app/atlas-vegetation-layer.ts`, `src/app/atlas-cartographic-style.ts`.

### A2.09 — Three.js-Texte und transparente Zeichnung ergänzen

<!-- atlas-dependencies {"requires":["A2.08","R1.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A2.08.
- **Auftrag und Ergebnis:** Beschriftungen, Bilder, transparente Konturen und Kameraausrichtung in festen Szenen ergänzen. Vorhandene Text-/Bildassets verwenden; Alpha, Saum und Zeichenreihenfolge erhalten.
- **Prüfung / fertig:** Texte bei 100 %/200 %, geneigten Ansichten und überlappenden Flächen vergleichen. Kein Erfolg durch Auslassen einer teuren Inhaltsklasse. Einstiege: `src/app/atlas-deck-labels.ts`, `src/app/atlas-drawing-geometry.ts`.

### A2.10 — Three.js-Änderungsfolge und Trefferprobe anbinden

<!-- atlas-dependencies {"requires":["A2.09","R1.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A2.09.
- **Auftrag und Ergebnis:** Die gemeinsame Farb-/Höhenänderungsfolge inkrementell anwenden und dieselben repräsentativen Auswahlstrahlen wie im ersten Kandidaten auswerten. Revision, sichtbaren Frame und Ressourcenfreigabe über A2.02 melden.
- **Prüfung / fertig:** Sichtbare Vorschau und bekannte Treffer stimmen; Kamera/Entwurf bauen unveränderte Geometrie nicht neu auf. Verdeckte Objekte werden nicht vor sichtbaren ausgewählt. Noch keine vollständige Werkzeugportierung.

### A2.11 — Kandidaten mit identischer Qualität messen

<!-- atlas-dependencies {"requires":["A2.04","A2.10","R1.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A2.04 und A2.10.
- **Auftrag und Ergebnis:** Zuerst vollständige Vergleichsbilder und Inhaltsmanifest prüfen, danach beide Kandidaten seriell auf demselben Gerät messen: drei Navigationsserien je festgelegter Szene/Skalierung und mindestens 30 Pinselgesten je verwendeter Pinselart/Skalierung. Uninstrumentierte Zeiten und getrennte Ressourcenprofile sichern.
- **Prüfung / fertig:** Pro Kandidat vollständiger Bericht mit Bildabweichungen, p95, Ausreißern, Modellneuanlagen und Ressourcen; keine softwaregerenderte Variante mit Hardware-WebGL vermischen. Fehlende Darstellungsaspekte disqualifizieren den Vergleich bis zu ihrer Ergänzung.

### A2.12 — Rendererentscheidung und Übergabe treffen

<!-- atlas-dependencies {"requires":["A2.11","R1.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A2.11.
- **Auftrag und Ergebnis:** Regeln aus A2 der Roadmap anwenden und Entscheidung beim Architektur-Einstieg dokumentieren. Bei zwei geeigneten Kandidaten konkrete verbleibende Codebesitzer, Shaderportierungen, Verbraucher und Wartungsflächen vergleichen; bei Gleichstand den geringeren Integrationsaufwand wählen. Den gewählten Prototyp, seine wiederverwendbaren Module und offene Produktanschlüsse für A3 benennen.
- **Prüfung / fertig:** Keine Entscheidung ausschließlich aus Layerzahl oder einem Einzelbild. Wenn kein Kandidat geeignet ist, konkreten Befund und genau den passenden bedingten Versuch aktivieren; A2 bleibt bis zur erneuten gemeinsamen Vergleichsmessung offen. Ein erfolgreicher Prototyp ist keine vollständige Atlasabnahme.
