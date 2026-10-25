# A5: Bearbeitung beschleunigen – Arbeitspakete

Status: Planned; alle Pakete offen.
Owner: atlas
Last Reviewed: 2026-10-25 (Zerlegung; keine Umsetzung)
Source of Truth: Paketumfang für A5; Ziele und gemeinsame Ausführungsregeln stehen in der [Roadmap](../performance-roadmap.md).

**Start:** A4 abgeschlossen. **Reihenfolge:** A5.01 bis A5.09.
Die vorhandene lokale Vorschau wird an den gehaltenen Darstellungspfad angepasst.
Kein neuer Schreibkanal; unverändert eine abgeschlossene Geste pro Historyschritt.

Für jedes Paket gelten Zuständigkeit, Eingaben, Aufwand und Übergabe aus dem
[gemeinsamen Paketvertrag](handbook.md#gemeinsamer-paketvertrag). Fachkompetenz:
Autoren-/Entwurfssitzungen, Terrainfelder, GPU-Teiluploads und Receipt-/History-
Semantik; A5.07–A5.09 zusätzlich native Gesten- und Pixelmessung. Eingaben sind
der A4-Darstellungsstand, bestehende Pinselregeln und die A1-Messmethodik.
Schnittstellen zwischen Vorschau, geordnetem Commit und bestätigtem Produkt
bleiben getrennt; A6 erhält den qualifizierten Bearbeitungsstand und seine Budgets.

### A5.01 — Entwurf und bestätigte Szene getrennt führen

<!-- atlas-dependencies {"requires":["A4.09","R4.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A4.09 bestanden.
- **Auftrag und Ergebnis:** Entwurf an Sitzung, Quelle und Gestenkennung binden und getrennt von bestätigten Ressourcen halten. Darstellung erhält begrenzte lokale Änderungen; eine Speicherbestätigung ist keine Voraussetzung für die erste Vorschau.
- **Prüfung / fertig:** Verzögerte Bestätigung verhindert Vorschau nicht, Quellen-/Werkzeugwechsel verwirft nur den passenden offenen Entwurf. Keine Mutation eingefrorener Szenen. Einstiege: `src/app/landscape-brush-session.ts`, `src/app/atlas-surface-draft.ts`, `tests/atlas-surface-draft.test.mjs`.

### A5.02 — Farbvorschau inkrementell darstellen

<!-- atlas-dependencies {"requires":["A5.01","R4.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A5.01.
- **Auftrag und Ergebnis:** Lokales Farbprodukt mit dem gehaltenen Material verbinden, ohne Objektgeometrie oder unveränderte Kacheln neu anzulegen. Vorhandene Textur-Teiluploads verwenden; zusätzliche Dirty-Rect-Infrastruktur nur bei konkretem Restbefund.
- **Prüfung / fertig:** Abwechselnde Farbtupfer und Strich über Kachelgrenze erscheinen vollständig; Ressourceninstrumentierung zeigt begrenzte Änderung. Kein Einfluss auf Pigment-/Wasser-/Maskensemantik. Einstiege: `src/app/landscape-color-surface.ts`, `src/app/atlas-texture-patch.ts`; `tests/terrain-pigment-coverage.test.mjs`.

### A5.03 — Höhenvorschau einschließlich Relief aktualisieren

<!-- atlas-dependencies {"requires":["A5.02","R4.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A5.02.
- **Auftrag und Ergebnis:** Lokales Höhengitter, notwendige Randnachbarn und abgeleitete Normale/Reliefdaten zusammen veröffentlichen. Unveränderte Topologie und entfernte Geometrie behalten; abhängige Objekt-/Trassenhöhen korrekt invalidieren.
- **Prüfung / fertig:** Hügel an Kachelrand erzeugt keine Naht oder veraltete Beleuchtung; Gebäude-/Straßenbezug folgt dem tatsächlich verwendeten Höhenstand. Ressourcen außerhalb des Einflussbereichs unverändert. Einstiege: `src/app/terrain-brush-draft.ts`, `src/app/atlas-terrain-tile-model.ts`; `tests/terrain-brush-draft.test.mjs`.

### A5.04 — Glättungsvorschau auf demselben Pfad führen

<!-- atlas-dependencies {"requires":["A5.03","R4.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A5.03.
- **Auftrag und Ergebnis:** Glättung mit vollständigem benötigtem Nachbarschaftsbereich in die inkrementelle Höhenveröffentlichung einbinden. Abtastung und Glättungswirkung nicht zur Zeitersparnis reduzieren.
- **Prüfung / fertig:** Frischer definierter Hang, überlappende Gesten und Kachelrand; lokales Ergebnis stimmt mit bestätigter Berechnung überein. Wirkungslose Geste bleibt wirkungslos und wird nicht durch einen Overlaywechsel als schnelle Terrainreaktion gemessen. Referenz: `tests/terrain-brush.test.mjs`, `tools/test-desktop-terrain-brush.mjs`.

### A5.05 — Bestätigung ohne Flackern und Neuaufbau übernehmen

<!-- atlas-dependencies {"requires":["A5.04","R4.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A5.04.
- **Auftrag und Ergebnis:** Bestätigte Produkte gegen den passenden Entwurf austauschen; spätere Gesten bleiben während früherer Bestätigungen sichtbar. Auftragsreihenfolge und fachliche Revision entscheiden, nicht Antwortankunft. Physisch unveränderte Ressourcen weiterverwenden.
- **Prüfung / fertig:** Zwei Folgegesten bei verzögerter erster Bestätigung sowie vertauschte/überholte Leseantworten; kein Zurückspringen der Farbe/Höhe, keine verlorene Geste und kein vollständiger Kartenneuaufbau. Einstiege: `src/app/terrain-stroke-queue.ts`, `tests/terrain-commit-display.test.mjs`.

### A5.06 — Undo, Abbruch und ungeklärte Bestätigung erhalten

<!-- atlas-dependencies {"requires":["A5.05","R4.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A5.05.
- **Auftrag und Ergebnis:** Undo/Redo, verworfenen Entwurf und fehlgeschlagene oder ungeklärte Speicherbestätigung am neuen Darstellungspfad prüfen und nötige lokale Anpassungen durchführen. Ungeklärter Writer bleibt gesperrt; keine automatische Wiederholung von Schreibaktionen.
- **Prüfung / fertig:** Eine Geste entspricht einem Historyschritt; Abbruch vor Commit, Fehler danach, Undo/Redo und anschließendes Weiterarbeiten erhalten Daten und Anzeige. Tests `tests/terrain-stroke-queue.test.mjs`, `tests/terrain-live-history.test.mjs`, `tests/desktop-atlas-commit-recovery.test.mjs`.

### A5.07 — Objektbewegung und Auswahl während Entwürfen erhalten

<!-- atlas-dependencies {"requires":["A5.06","R4.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A5.06.
- **Auftrag und Ergebnis:** Repräsentative Gebäude-/Raum-/Symbolbewegung mit gehaltenen Ressourcen verbinden; Vorschau transformiert die betroffenen Teile, bestätigte Lage ersetzt nur deren Zustand. Auswahl, Griffe und Werkzeugwechsel verwenden dieselbe Entwurfsidentität.
- **Prüfung / fertig:** Bewegen, abbrechen, bestätigen, Undo/Redo bei geneigter Ansicht und unterschiedlichem Geschoss; keine Auswahl der alten Lage. Native Einstiege: `tools/test-desktop-atlas-author-overlay.mjs`, `tools/test-desktop-atlas-objects-main.mjs`.

### A5.08 — Pinselreaktion in vollständigen Serien qualifizieren

<!-- atlas-dependencies {"requires":["A5.07","R4.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A5.07.
- **Auftrag und Ergebnis:** A1-Pixelmessung ohne Profilierung für Farbe/Höhe/Glätten bei 100 % und 200 % wiederholen, mindestens 30 Gesten je Kombination. Getrennt eine Diagnosefolge aufnehmen, falls Berechnung und sichtbarer Frame weiterhin auseinanderliegen.
- **Prüfung / fertig:** Jede Kombination p95 ≤ 100 ms bis zur ersten passenden sichtbaren Terrainreaktion; keine fehlenden Gesten oder falschen Treffer durch Cursorbewegung. Vollständige Rohwerte, Konsolenstatus und Prozessende sichern; langsame Werte nicht durch Wiederholung aus der Stichprobe entfernen.

### A5.09 — Zusammenhängenden Bearbeitungsablauf abnehmen

<!-- atlas-dependencies {"requires":["A5.08","R4.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A5.08 bestanden.
- **Auftrag und Ergebnis:** Farbe → Höhe → Glätten → Objekt bewegen → auswählen → Undo/Redo → speichern → frisch wiederöffnen in einer nativen Prüfkampagne durchspielen. Einen zweiten Durchlauf mit verzögerter Bestätigung verwenden.
- **Prüfung / fertig:** Erhaltene Inhalte, korrekte History und direkte Weiterarbeit nachweisen. A4-Navigationskontrolle in der schwierigen Dorfansicht bleibt ≤ 33,3 ms p95. Capability-Katalog mit den tatsächlich geprüften Abläufen und Testquellen aktualisieren. Vollständige Verbraucherabnahme folgt in A7.
