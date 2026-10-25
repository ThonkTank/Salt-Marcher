# A3: Dauerhafte Darstellung – Arbeitspakete

Status: Planned; alle Pakete offen.
Owner: atlas
Last Reviewed: 2026-10-25 (Zerlegung; keine Umsetzung)
Source of Truth: Paketumfang für A3; Ziele und gemeinsame Ausführungsregeln stehen in der [Roadmap](../performance-roadmap.md).

**Start:** A2 hat einen geeigneten Renderer ausgewählt. **Reihenfolge:** A3.01 bis A3.12.
Es wird nur dieser Kandidat produktionsfähig gemacht. Bereits belastbare Teile aus
A2 werden übernommen und geprüft, nicht erneut implementiert. Bis A7 bleibt der
neue Pfad für native Prüfungen erreichbar, wird aber nicht vorzeitig als vollständig
qualifizierter Standard ausgegeben. Kein dauerhaftes zweites Backend versprechen.

Für jedes Paket gelten Zuständigkeit, Eingaben, Aufwand und Übergabe aus dem
[gemeinsamen Paketvertrag](handbook.md#gemeinsamer-paketvertrag). Fachkompetenz:
TypeScript, der in A2 ausgewählte Renderer, GPU-Puffer-/Texturbesitz und
inkrementelle Szenenverwaltung; A3.10/A3.12 zusätzlich native Electron-Prüfung.
Eingaben sind der qualifizierte A2-Kandidat, seine Szenen und A1-Messanschlüsse.
Schnittstellen bleiben Szene/Änderung/Kamera, gültiger Frame, Auswahl und Dispose;
A4 übernimmt den integrierten Ressourcenvertrag und seine Nachweise.

### A3.01 — Szenen-, Änderungs- und Kameravertrag anschließen

<!-- atlas-dependencies {"requires":["A2.12","R2.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A2.12 bestanden.
- **Auftrag und Ergebnis:** Den kleinen Prototypenanschluss auf den tatsächlichen Atlasbesitzer abbilden. Szene, lokale Änderung und Kamera getrennt übergeben; Quellenrevision, Kamera-/Viewportidentität, Fehler und Dispose explizit behandeln. Keine fachlichen Commands oder Datenbankformate ändern.
- **Prüfung / fertig:** Vertragstests weisen verspätete Quellen-/Kameraantworten zurück und erlauben einen Frame nur für seine eigene Identität. Einstiege: `src/app/atlas-presentation.ts`, `src/app/atlas-presentation-host.ts`, `src/app/atlas-raster-presentation.ts`.

### A3.02 — Stabile Geometriekennungen und Ursprünge einführen

<!-- atlas-dependencies {"requires":["A3.01","R2.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A3.01.
- **Auftrag und Ergebnis:** Kamerafreie Identitäten aus Objektkennung, Geometrieteil und fachlicher Revision ableiten. Lokalen Geometrieursprung vom aktuellen Kameraausschnitt trennen; Weltkoordinaten bleiben doppelt genau. Keine neue räumliche Partitionierung vor A4.
- **Prüfung / fertig:** Unverändertes Gebäude behält nach Pan/Zoom/Rotation seine Geometrie; reale Form-/Geschossänderung invalidiert die passenden Teile. Einstieg: `src/app/atlas-object-geometry.ts`; Regression `tests/atlas-independent-building.test.mjs`.

### A3.03 — Geometriepuffer mit eindeutiger Lebensdauer halten

<!-- atlas-dependencies {"requires":["A3.02","R2.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A3.02.
- **Auftrag und Ergebnis:** Im gewählten Renderer Geometriepuffer über stabile Kennungen halten; Aktualisieren, Entfernen und gemeinsame Nutzung explizit abbilden. Kameratransformationen dürfen keine Kopie der Positionsarrays erzeugen.
- **Prüfung / fertig:** Instrumentierte Tests zählen eine Anlage pro unveränderter Geometrie, genau nötige Änderungen und vollständige Freigabe nach Entfernen/Dispose. Wiederholte Szene mit denselben Inhalten erzeugt keine zusätzlichen Modelle. Kein unbeschränkter globaler Cache.

### A3.04 — Terrain- und Texturressourcen in den Vertrag überführen

<!-- atlas-dependencies {"requires":["A3.03","R2.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A3.03.
- **Auftrag und Ergebnis:** Vorhandene Terrain-/Materialmodelle und Teiluploads an A3.01 anschließen; bei Rendererwechsel die qualifizierten A2-Materialfunktionen übernehmen. Textur-/Geometrielebensdauer trennen; reine Stil- oder Kamerawerte ändern keine Quelldaten.
- **Prüfung / fertig:** Kamera-/Lichtwechsel behalten Puffer, ein lokaler Materialwechsel aktualisiert betroffene Texturen, keine Änderung bereits bestätigter Undo-/Exportsnapshots. Einstiege: `src/app/atlas-terrain-tile-model.ts`, `src/app/atlas-texture-patch.ts`; Tests `tests/atlas-surface-reuse.test.mjs`, `tests/atlas-texture-patch.test.mjs`.

### A3.05 — Opake Zeichnungen dauerhaft bündeln

<!-- atlas-dependencies {"requires":["A3.04","R2.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A3.04.
- **Auftrag und Ergebnis:** Kompatible opake Flächen einschließlich Vertexfarben in gehaltenen Batches organisieren. Objektkennungen und Bereiche im Batch behalten, sodass eine lokale Änderung den betroffenen Batch begrenzt aktualisiert. Bestehende Vegetationsinstanzen weiterverwenden.
- **Prüfung / fertig:** Gemischte Gebäude-/Raumfarben und Tiefenverdeckung identisch; Renderaufrufe sinken in der festen Dorfansicht. Auswahlmetadaten gehen beim Zusammenlegen nicht verloren. Einstieg: `src/app/atlas-deck-drawing.ts` beziehungsweise sein gewählter Nachfolger.

### A3.06 — Transparente und speziell geordnete Inhalte sicher bündeln

<!-- atlas-dependencies {"requires":["A3.05","R2.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A3.05.
- **Auftrag und Ergebnis:** Transparente Konturen, Bilder, öffentliche Waldflächen und kameraorientierte Zeichnungen nach kompatiblen Zeichenregeln gruppieren. Semantische Reihenfolge und Tiefenschreibregeln bewahren; inkompatible Nachbarn bleiben getrennt.
- **Prüfung / fertig:** Überlappende Alpha-Flächen, Bilder mit Löchern, Konturen und geneigte Beschriftungen gegen Referenz prüfen. Kein globales Sortieren nach Material als Ersatz für korrekte Reihenfolge. Ein unverändertes Ergebnis mit begründeter Nichtbündelung ist zulässig, kein Qualitätsverlust.

### A3.07 — Szenenänderungen auf betroffene Ressourcen begrenzen

<!-- atlas-dependencies {"requires":["A3.06","R2.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A3.06.
- **Auftrag und Ergebnis:** Vollständiges Ersetzen der Zeichnung bei lokalen Änderungen durch Hinzufügen/Aktualisieren/Entfernen anhand A3.02 ersetzen. Karte und temporären Entwurf unabhängig invalidieren; notwendige Terrain-/Objektabhängigkeiten erhalten.
- **Prüfung / fertig:** Änderung an einem Objekt oder Farbfleck lässt entfernte unveränderte Puffer bestehen; Löschung entfernt Treffer und Ressourcen. Reihenfolgewechsel ohne Geometrieänderung erzeugt kein unkontrolliertes Neuaufbauen. Einstieg: `src/app/atlas-raster-presentation.ts` (`paint`, `overlay`, `repaint`).

### A3.08 — Änderungen innerhalb eines Bildtakts gemeinsam veröffentlichen

<!-- atlas-dependencies {"requires":["A3.07","R2.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A3.07.
- **Auftrag und Ergebnis:** Am bestehenden Framebesitzer redundante Veröffentlichungen zusammenführen und identische Kamera-/Szenenwerte früh erkennen. Kamerazustand für Eingaben bleibt sofort aktuell; sichtbare Revision wird erst vom zugehörigen fertig gezeichneten Frame bestätigt. Export/Warten kann den ausstehenden Zustand gezielt abschließen.
- **Prüfung / fertig:** Mehrere Setter erzeugen einen konsistenten Frame; ein alter Renderabschluss bestätigt keine neuere Revision. Kein zusätzlicher RAF-Zyklus als pauschale Verzögerung. Einstiege: `src/app/atlas-canvas.ts`, `src/app/atlas-deck-surface.ts`; `tests/atlas-deck-surface.test.mjs` als Verhaltensreferenz.

### A3.09 — Auswahl auf die gehaltene Darstellung abbilden

<!-- atlas-dependencies {"requires":["A3.08","R2.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A3.08.
- **Auftrag und Ergebnis:** Semantische Treffer trotz Batches über ursprüngliche Objekt-/Geometriezuordnung erhalten. Terrainabstand, Gebäude-/Geschossverdeckung, Alpha-Löcher und bewusst auswählbare Konturen berücksichtigen. Keine neue allgemeine Suchstruktur ohne Befund.
- **Prüfung / fertig:** Bekanntes vorderes/hinteres Objekt, transparentes Bildloch, Raumgeschoss und Kontur korrekt treffen; veraltete oder verlorene Frames erteilen keine Auswahlberechtigung. Einstiege: `src/app/atlas-mesh-ray.ts`, `src/app/atlas-deck-picking.ts`, `src/app/atlas-deck-drawing.ts`.

### A3.10 — Den gewählten Pfad an den nativen Atlas anschließen

<!-- atlas-dependencies {"requires":["A3.09","R2.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A3.09.
- **Auftrag und Ergebnis:** Kamera, Zeichnung, Bewuchs, Terrain, Labels und Eingaben über den bestehenden Präsentationsbesitzer in der nativen App verbinden. Unvollständige Inhalte müssen als Fehler/offen erscheinen, nicht stillschweigend verschwinden. Produktfunktionen außerhalb des Renderanschlusses unverändert lassen.
- **Prüfung / fertig:** In einer nativen Prüfkampagne Welt → Dorf → Raum → zurück navigieren und repräsentative Auswahl durchführen. Kein Rendererzugriff auf Node/SQLite. Einstieg: `src/app/campaign-atlas-ui.ts`, `tools/test-desktop-atlas-transition.mjs`.

### A3.11 — Kontextverlust und Ressourcenabschluss absichern

<!-- atlas-dependencies {"requires":["A3.10","R2.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A3.10.
- **Auftrag und Ergebnis:** Resize, Dispose, Quellenwechsel und GPU-Kontextverlust im neuen Ressourcenmodell behandeln. Verlorene Ressourcen entwerten und aus bestätigten Daten wiederherstellen; laufende Framewartezeiten sauber auflösen oder abbrechen. Schreibaktionen niemals wiederholen.
- **Prüfung / fertig:** Gezielt erzwungener Verlust sowie Quellenwechsel während eines ausstehenden Frames; keine alten Treffer, doppelten Commits oder verbleibenden Ressourcen nach Dispose. Bestehende Lifecyclefälle aus `tests/atlas-deck-surface.test.mjs` an den tatsächlichen Besitzer übertragen.

### A3.12 — Dauerhafte Darstellung nativ nachweisen

<!-- atlas-dependencies {"requires":["A3.11","R2.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A3.11.
- **Auftrag und Ergebnis:** Feste Dorfansicht mit Pan/Zoom/Rotation und Farbtupfer unter A1-Instrumentierung ausführen, danach dieselben Gesten ohne Instrumentierung messen. Ergebnisse mit A2 vergleichen; keine vollständige Weltmatrix vor A4 nötig.
- **Prüfung / fertig:** Keine Modellneuanlagen für unveränderte geladene Inhalte bei Kameragesten; Farbtupfer baut unveränderte Karte nicht neu. Bild-/Trefferregressionen und Type-/Buildchecks bestanden. Abweichungen einem konkreten Paket zuordnen; A3 bleibt bei Nichterfüllung offen.
