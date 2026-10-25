# A6: Öffnen und Nachladen – Arbeitspakete

Status: Planned; alle Pakete offen, Optimierungspakete nur bei passendem Befund.
Owner: atlas
Last Reviewed: 2026-10-25 (Zerlegung; keine Umsetzung)
Source of Truth: Paketumfang für A6; Ziele und gemeinsame Ausführungsregeln stehen in der [Roadmap](../performance-roadmap.md).

**Start:** A5 abgeschlossen. **Reihenfolge:** A6.01 → zutreffende Pakete A6.02–A6.07
in dieser Reihenfolge → A6.08 → A6.09 → A6.10. Nicht zutreffende Optimierungen
werden mit Messbefund als entfallend gekennzeichnet. Keine neue Cachearchitektur
oder zusätzliche Worker nur deshalb, weil ein Paket dafür vorhanden ist.

Für jedes Paket gelten Zuständigkeit, Eingaben, Aufwand und Übergabe aus dem
[gemeinsamen Paketvertrag](handbook.md#gemeinsamer-paketvertrag). Fachkompetenz:
Node-Worker, SQLite-Lesesnapshots, Materialkernel und begrenzte Caches;
A6.01/A6.09/A6.10 zusätzlich native Messauswertung. Eingaben sind A5-Ergebnis,
A1-Rohbasis und die jeweilige belegte Kostenursache aus A6.01. Quellenrevision,
Cancellation und atomare Tileprodukte sind feste Verbraucherschnittstellen;
A7 übernimmt den gemeinsamen geprüften Lade-/Bearbeitungsstand.

### A6.01 — Verbleibenden Materialengpass bestimmen

<!-- atlas-dependencies {"requires":["A5.09","A1.08","R5.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A5.09 und Instrumentierung aus A1.08.
- **Auftrag und Ergebnis:** Einen kalten und einen nachladenden Materialfall auf dem jetzigen Build profilieren; exklusive Kosten von Datenzugriff, Höhenfeld, Materialreduktion, Übertragung und Warten ausweisen. Gegen A1 prüfen, ob sich der Engpass durch A3–A5 verschoben hat.
- **Prüfung / fertig:** Genau die zutreffenden A6-Pakete aktivieren, jeweils mit erwarteter Wirkung und passendem Vergleichsfall. Roundtrip-Summen nicht als Worker-CPU-Zeit behandeln. Ursprüngliche Kaltbasis für die Endabnahme bleibt unverändert.

### A6.02 — Überlappende Quelldatenzugriffe innerhalb eines Auftrags wiederverwenden

<!-- atlas-dependencies {"requires":["A6.01","R5.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A6.01 weist relevante doppelte Lese-/Dekodierarbeit nach.
- **Auftrag und Ergebnis:** Für benachbarte Materialblöcke bereits gelesene Quellen innerhalb desselben bestätigten Jobs begrenzt wiederverwenden. Quellenrevision, räumlichen Umfang und Kanalbezug erhalten; nach Jobende freigeben. Keine prozessweit unbegrenzte Recordablage.
- **Prüfung / fertig:** Anzahl und Zeit der Abfragen/Dekodierungen sinken im festgelegten Fall; resultierende Kanalbytes stimmen mit dem bisherigen Algorithmus überein. Abbruch und Quellenwechsel verwerfen die Jobdaten. Einstiege: `src/app/storage/terrain-material.ts`, `src/app/storage/landscape-record-stream.ts`.

### A6.03 — Wiederholte Feld- und Randberechnung vermeiden

<!-- atlas-dependencies {"requires":["A6.01","A6.02","R5.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A6.01 weist relevante mehrfach berechnete Höhen-/Materialfelder nach; A6.02 abgeschlossen oder entfallen.
- **Auftrag und Ergebnis:** Wiederkehrende Samples/Halos in einem begrenzten Band oder gemeinsamen Jobfeld wiederverwenden. Vorhandenes Abtastraster, Reihenfolge der Masken und Randbedingungen beibehalten; keine geringere Samplingqualität.
- **Prüfung / fertig:** Dünne Waldstreifen, Löcher, Inseln, Pigment, Wasser und Blockgrenzen liefern dieselben Ergebnisse. Jobspitzenspeicher und Abbruchlatenz messen. Einstiege: `src/app/storage/terrain-material.ts`, `src/app/atlas-raster-kernel.ts`; Tests `tests/atlas-bounded-material.test.mjs`, `tests/terrain-material-raster.test.mjs`.

### A6.04 — Arbeitsblockgröße und Unterbrechung gemeinsam abstimmen

<!-- atlas-dependencies {"requires":["A6.01","A6.03","R5.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A6.01 zeigt relevanten Block-/Checkpointaufwand; A6.03 abgeschlossen oder entfallen.
- **Auftrag und Ergebnis:** Höchstens drei konkrete Blockgrößen mit unverändertem Sampling vergleichen und eine wählen. Speicher- und Unterbrechungsgrenzen gemeinsam prüfen; größere Blöcke dürfen weder Abbruch blockieren noch sichtbare Qualität ändern.
- **Prüfung / fertig:** Bytegleiche Kanalprodukte, dokumentierte maximale nicht unterbrochene Arbeitsabschnitte und gemessener Speicher. Nur den belegten Gewinner übernehmen; bei fehlendem Vorteil bestehende Größe behalten. Keine zusätzliche dauerhafte Konfigurationsoberfläche.

### A6.05 — Sichtbare Anfragen priorisieren und überholte Arbeit beenden

<!-- atlas-dependencies {"requires":["A6.01","A6.04","R5.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A6.01 zeigt Warteschlangen-/Abbruchkosten; A6.04 abgeschlossen oder entfallen.
- **Auftrag und Ergebnis:** Sichtbare und interaktionsrelevante Anforderungen vor Vorladung abarbeiten; vorhandene Deduplizierung und Quellenzäune erhalten. Ersatzauftrag übernimmt einen begrenzten Rechenplatz erst nach bestätigtem Ende des Vorgängers. Keine pauschale Verzögerung der ersten sichtbaren Anfrage.
- **Prüfung / fertig:** Schnelle Kamerafolge, Entwurf während Nachladung und Quellenwechsel: nur gültige Produkte werden veröffentlicht, sichtbare Arbeit verhungert nicht, tatsächlich laufende Jobzahl bleibt begrenzt. Einstiege: `desktop/atlas-region.ts`, `src/app/atlas-read-request.ts`, `tests/atlas-first-product-worker.test.mjs`.

### A6.06 — Cachetreffer und Invalidierung gezielt korrigieren

<!-- atlas-dependencies {"requires":["A6.01","A6.05","R5.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A6.01 zeigt unnötige Cachemisses/Wiederberechnungen; A6.05 abgeschlossen oder entfallen.
- **Auftrag und Ergebnis:** Nur nachgewiesene Fehler bei Produktidentität, Kanalwiederverwendung oder lokaler Invalidierung korrigieren. Betroffene Eltern und Nachbarn weiterhin invalidieren. Keine bloße Erhöhung des Cachebudgets als Ersatz für die Ursache.
- **Prüfung / fertig:** Kalter Erstaufruf, warmer Wiederaufruf, lokale Bearbeitung, Stil-/Kamerawechsel und beschädigter abgeleiteter Cache liefern richtige Treffer bzw. Neuberechnung. Quellenstand korrekt; Budgets aus A4 eingehalten. Einstiege: `src/app/storage/atlas-material-tiles.ts`, `src/app/storage/terrain-invalidation.ts`; `tests/atlas-derived-file-cache.test.mjs`.

### A6.07 — Doppelte Produktarbeit an der Anfragegrenze beseitigen

<!-- atlas-dependencies {"requires":["A6.01","A6.06","R5.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A6.01 zeigt relevante doppelte Arbeit/Übertragung zwischen Höhen- und Materialprodukten; A6.06 abgeschlossen oder entfallen.
- **Auftrag und Ergebnis:** Nur die konkret identifizierte gemeinsame Ableitung oder überflüssige Kopie innerhalb desselben Quellenstands zusammenführen. Begrenzte Produkte, Cancellation und atomare Höhen-/Materialveröffentlichung erhalten. Keine allgemeine IPC-Neuentwicklung.
- **Prüfung / fertig:** End-to-End-Zeit und kopierte Datenmenge im festgelegten Fall sinken; Antworten unterschiedlicher Revisionen werden nie vermischt. Einstiege: `desktop/atlas-worker-contract.ts`, `desktop/atlas-region-worker.ts`, `src/app/atlas-surface-tile-stream.ts`.

### A6.08 — Bedarf für zusätzliche Rechenverfahren entscheiden

<!-- atlas-dependencies {"requires":["A6.02","A6.03","A6.04","A6.05","A6.06","A6.07","R5.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Aktivierte A6.02–A6.07 abgeschlossen und einzeln verglichen.
- **Auftrag und Ergebnis:** Verbleibende Kosten erneut aufteilen. Bei relevantem CPU-Kernel den begrenzten Parallelitäts-/WASM-Versuch aus den bedingten Paketen aktivieren, bei passendem GPU-Befund den WebGPU-Versuch. Ohne solchen Befund diese Wege ausdrücklich als nicht erforderlich markieren.
- **Prüfung / fertig:** Entscheidung enthält tatsächliche Restkosten und die genaue Kernfunktion bzw. Auftragsklasse. Ein Mikrobenchmark allein erlaubt noch keine Übernahme. Nach einem übernommenen Versuch dessen gemeinsamen Produktvergleich abwarten, bevor A6.09 startet.

### A6.09 — Kaltstart und Nachladung vergleichbar nachmessen

<!-- atlas-dependencies {"requires":["A6.08","R5.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A6.08 und gegebenenfalls aktivierter Versuch abgeschlossen.
- **Auftrag und Ergebnis:** Die Kaltstart-/Streamingfälle aus A1.10 unverändert wiederholen: drei unabhängige kalte Testprofile je Maßstab/Skalierung und drei Nachladewege je Skalierung. Reihenfolge und Umgebungsbedingungen dokumentieren; keine Profilierung in den Zeitreihen.
- **Prüfung / fertig:** Terrain-Detail, erste Oberfläche und Auswahlbereitschaft getrennt ausweisen. Halbierungsziel anhand des Medians der drei Terrain-Detailzeiten je Maßstab/Skalierung gegen die entsprechenden A1-Werte bewerten; alle Einzelwerte und Fehlläufe behalten. Für Streaming beginnt die Zeit mit der ersten Kamerageste in den definierten ungeladenen Weg und endet mit dem vollständigen Detailframe der letzten Zielkamera; Weg und Gestentakt sind identisch zur Basis. Auch dieser Median der drei Wege muss je Skalierung höchstens die Hälfte des Basiswerts betragen. Keine warmen Cacheläufe als kalte Verbesserung zählen.

### A6.10 — Ladegewinn gegen Bedienung und Speicher prüfen

<!-- atlas-dependencies {"requires":["A6.09","R5.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A6.09.
- **Auftrag und Ergebnis:** Während des festgelegten Nachladewegs Pinselreaktion und Eingabeverarbeitung prüfen; danach geladene Dorf-Navigation sowie Ressourcengrenzen kontrollieren. Frühe Oberfläche und Auswahlbereitschaft auf Verschlechterungen gegenüber der Basis prüfen.
- **Prüfung / fertig:** Halbierungsziel in allen zwölf Kaltkonfigurationen und beiden Streamingkonfigurationen erreicht, geladene Navigation weiterhin p95 ≤ 33,3 ms und Pinsel p95 ≤ 100 ms. Keine Verschlechterung der ersten Nutzbarkeit zugunsten der Detailzeit. Bei Zielverfehlung bleibt A6 offen; genau fehlende Kombination und Ursache benennen, keinen Mittelwert über gute und schlechte Maßstäbe als Abnahme verwenden.
