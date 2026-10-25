# Bedingte Architekturwege – Arbeitspakete

Status: Planned; alle Pakete bedingt, kein Versuch aktiviert.
Owner: atlas
Last Reviewed: 2026-10-25 (Zerlegung; keine Umsetzung)
Source of Truth: Paketumfang der bedingten Wege; Ziele und gemeinsame Ausführungsregeln stehen in der [Roadmap](../performance-roadmap.md).

Für jedes Paket gelten Zuständigkeit, Eingaben, Aufwand und Übergabe aus dem
[gemeinsamen Paketvertrag](handbook.md#gemeinsamer-paketvertrag). Eingaben sind
der dokumentierte Aktivierungsbefund, die passenden A-Szenen und der beste bisher
qualifizierte Kandidat. Fachkompetenz: B1 WebGL2/GLSL, B2 OffscreenCanvas und
Workerbesitz, B3 begrenzte Rechenworker und WASM, B4 WebGPU/WGSL, B5
Raster-/Vektorkomposition und Cacheinvalidierung, B6 native Grafiksysteme und
Migrationsplanung. Native Vergleichspakete benötigen zusätzlich die A1-
Messkompetenz. Jeder Weg liefert Ergebnis, Kosten und Grenzen an sein benanntes
reguläres Rückkehrgate; kein Versuch besitzt einen neuen kanonischen Schreibkanal.

## Start, Reihenfolge und Ende eines Versuchs

Ein Versuch benötigt den konkreten Restbefund aus A2.12, A3.12, A4.09, A5.08
oder A6.08. Nicht mehrere Backendwechsel gleichzeitig untersuchen. Innerhalb eines
Wegs gelten die expliziten Paketvorgänger und bei B4 die gewählte Route, nicht
die numerische Sortierung der Kennungen; native Vergleiche seriell.
Eindeutig nicht geeignete Versuche früh beenden, mit Befund dokumentieren und
ihre weiteren Pakete als entfallend markieren. Das übergeordnete Leistungsziel
bleibt offen. Keine unendliche Wiederholung desselben erfolglosen Versuchs.

Ein Gewinner kehrt in die reguläre Folge zurück: Renderbackend über A2.11/A2.12
erneut vergleichen und in A3 produktionsfähig machen; spätere Worker-/Rasteränderung
am betroffenen A3–A5-Gate erneut prüfen; Rechenkern über A6.09/A6.10 abnehmen.
Szenen-/Quellenvertrag, Qualität und Messmethodik bleiben für alle Wege identisch.

## B1 — Spezialisierter WebGL2-Zeichenpfad

**Auslöser:** Nach Bündelung und Wiederverwendung dominiert weiterhin gemessene
Framework-Verwaltung. **Reihenfolge:** B1.01 → B1.02 → B1.03 → B1.04.

### B1.01 — Direkten Pfad für opake Geometrie prototypisieren

<!-- atlas-dependencies {"requires":[],"alternativeRequires":[],"activationRequires":["A2.02"],"returnGates":[]} -->

- **Voraussetzung:** Aktivierender Renderbefund und Vergleichsvertrag aus A2.02.
- **Auftrag und Ergebnis:** Bestehende Szenenpuffer direkt über einen kleinen WebGL2-Zeichenpfad für opake Geometrie darstellen. Stabile Ressourcen, Kamera und Tiefe anschließen; keine neue Szenen-/Assetpipeline.
- **Prüfung / fertig:** Anker, Vertexfarben und Verdeckung stimmen; Zahl der API-Aufrufe und CPU-Zeit im selben isolierten Teilfall erfasst. Ein schneller opaker Teilfall ist noch kein Gewinner.

### B1.02 — Terrain und vorhandene Materialfunktionen anschließen

<!-- atlas-dependencies {"requires":["B1.01"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** B1.01 zeigt einen plausiblen Vorteil.
- **Auftrag und Ergebnis:** Qualifizierte Terrain-/Materialfunktionen aus A2 übernehmen, Shaderbindungen und Texturen direkt verwalten. Bewuchsinstanzen und Horizontregeln erhalten; keine vereinfachte Ersatzschattierung.
- **Prüfung / fertig:** Terrain-, Material- und Bewuchsbilder der A2-Szenen entsprechen der Referenz; Ressourcenzähler und Freigaben vollständig. Falls der Vorteil bereits verschwindet, Versuch mit Beleg beenden.

### B1.03 — Geordnete Inhalte und lokale Änderung ergänzen

<!-- atlas-dependencies {"requires":["B1.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** B1.02.
- **Auftrag und Ergebnis:** Transparenz, Labels/Bilder, repräsentative Trefferprobe und dieselbe Farb-/Höhenänderungsfolge aus A2 anschließen. Gleiche Revisions-/Framewartebedingungen wie die anderen Kandidaten.
- **Prüfung / fertig:** Gesamtes Vergleichsmanifest erfüllt; keine ausgelassene Inhaltsklasse und keine vorzeitig als fertig gemeldete Vorschau. Dispose und erzwungenen Ressourcenverlust prüfen.

### B1.04 — Gemeinsamen Vergleich wiederholen und entscheiden

<!-- atlas-dependencies {"requires":["B1.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":["A2.11","A2.12","A3.12"]} -->

- **Voraussetzung:** B1.03.
- **Auftrag und Ergebnis:** A2.11 für diesen Kandidaten wiederholen; Leistung und zusätzlichen eigenen Wartungsumfang mit den anderen Kandidaten vergleichen.
- **Prüfung / fertig:** Übernahme nur bei gleicher Qualität, erfüllten Zielen und belegter Beseitigung des Framework-Engpasses. Ergebnis zurück an A2.12; keine direkte produktive Ablösung aus dem Prototyp.

## B2 — Renderer in einem Worker

**Auslöser:** Renderarbeit blockiert nach Wiederverwendung weiterhin Oberfläche
und Eingaben. **Reihenfolge:** B2.01 → B2.02 → B2.03 → B2.04.

### B2.01 — Transfer- und Besitzvertrag für eine Szene erproben

<!-- atlas-dependencies {"requires":[],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Aktivierender Befund und gewählter Renderpfad.
- **Auftrag und Ergebnis:** Genau den vorhandenen Szenen-/Änderungs-/Kameravertrag über eine Workergrenze abbilden. Canvas-/Bufferbesitz, Revision, Fehler und Abbruch festlegen; Transfer darf im Hauptthread benötigte Undo-/Exportsnapshots nicht ablösen.
- **Prüfung / fertig:** Eine Szene und eine Änderung übertragen, verzögerte/alte Nachricht zurückweisen und Worker sauber beenden. Die tatsächlich verwendeten Rendererfunktionen müssen im Worker lauffähig sein; fehlende Unterstützung als konkretes Ergebnis melden.

### B2.02 — Zeichenschleife und Ressourcen im Worker betreiben

<!-- atlas-dependencies {"requires":["B2.01"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** B2.01 geeignet.
- **Auftrag und Ergebnis:** Den gewählten Renderer mit Offscreen-Zeichenfläche und tatsächlicher Ressourcenhaltung in einem Worker betreiben. Keine Änderung der Szene oder Bildqualität; Diagnose- und Frameabschlussmeldungen an den Host zurückgeben.
- **Prüfung / fertig:** Vollständige Vergleichsszene identisch, keine zweite parallele Zeichenschleife im Hauptthread, tatsächlicher Workerabschluss nach Dispose. Kamera-/Änderungsnachrichten werden in begrenzter Warteschlange verarbeitet.

### B2.03 — Eingaben, Treffer und Ausgabe synchronisieren

<!-- atlas-dependencies {"requires":["B2.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** B2.02.
- **Auftrag und Ergebnis:** Eingabeanker, Auswahlresultate, Resize, Framewartebedingungen und eingefrorene Ausgabe an Workerrevisionen binden. Zeigerbewegung darf neuere Kamera nicht mit alten Treffern mischen; keine synchrone Warteblockade des UI-Threads.
- **Prüfung / fertig:** Schnelle Kamerafolge mit Pinsel/Selektion, Resize während Rendern und Exportabbruch; korrekter Frame und keine verlorenen Eingaben. Workerfehler sichtbar, Schreibvorgänge nicht wiederholen.

### B2.04 — Bedienreaktion und sichtbares Ergebnis vergleichen

<!-- atlas-dependencies {"requires":["B2.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":["A3.12","A5.09"]} -->

- **Voraussetzung:** B2.03.
- **Auftrag und Ergebnis:** Hauptthreadreaktion, erste sichtbare Pinselreaktion, Navigations-p95 und Gesamtspeicher mit/ohne Worker seriell messen; gleiche Szenen und Verarbeitungslast.
- **Prüfung / fertig:** Oberfläche messbar entlastet, Zeit bis zum sichtbaren Kartenbild nicht verschlechtert, Ressourcengrenzen und fachliche Tests bestanden. Bei Übernahme betroffene A3/A5-Gates erneut bestehen; reine UI-Erreichbarkeit ist kein schnellerer Kartenrenderer.

## B3 — Parallelität und WASM für Materialberechnung

**Auslöser:** A6.08 weist einen relevanten CPU-Kernel nach. **Reihenfolge:**
B3.01 → B3.02; nur bei verbleibendem passenden Kern B3.03 → B3.04.

### B3.01 — Einen zusätzlichen begrenzten Leserechenplatz erproben

<!-- atlas-dependencies {"requires":[],"alternativeRequires":[],"activationRequires":["A6.08"],"returnGates":[]} -->

- **Voraussetzung:** A6.08 und eine benannte unabhängig ableitbare Auftragsklasse.
- **Auftrag und Ergebnis:** Genau einen zusätzlichen Rechenplatz für abgeleitete Produkte testen, mit derselben Quellenrevision, begrenztem Speicher und bestätigtem Abbruch. Kanonischer Writer bleibt eindeutig; keine unabhängigen Schreibworker.
- **Prüfung / fertig:** Zwei konkurrierende Anfragen erhalten richtige Quellenstände; schneller Quellenwechsel beendet beide; Speicher und Warteschlangen bleiben begrenzt. Ein serieller Lauf bleibt Vergleichsgrundlage.

### B3.02 — Parallelität im echten Lade-/Bearbeitungsablauf bewerten

<!-- atlas-dependencies {"requires":["B3.01"],"alternativeRequires":[],"activationRequires":[],"returnGates":["A6.09","A6.10"]} -->

- **Voraussetzung:** B3.01.
- **Auftrag und Ergebnis:** Festgelegten kalten und nachladenden Fall mit gleichzeitigen Pinselgesten seriell und mit zusätzlichem Rechenplatz messen. Nur den belegten Gewinner übernehmen.
- **Prüfung / fertig:** End-to-End-Ladezeit verbessert, Navigation/Pinsel und Ressourcen nicht verschlechtert. Bei negativem Ergebnis zusätzlichen Rechenplatz entfernen; Befund sichern. Keine weitere Erhöhung der Workerzahl ohne neuen Nachweis.

### B3.03 — Genau einen verbleibenden Rechenkern in WASM prototypisieren

<!-- atlas-dependencies {"requires":["B3.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Nach B3.02 verbleibt eine benannte dominante reine Rechenfunktion; Datenzugriff/Queue sind nicht ihr vermeintlicher Anteil.
- **Auftrag und Ergebnis:** Diese Funktion mit identischem Ein-/Ausgabevertrag und begrenzten Arrays in WASM implementieren. Buildwerkzeuge und reproduzierbaren Build dokumentieren; keine Portierung des gesamten Stores, Editors oder Renderers.
- **Prüfung / fertig:** Kanalausgaben, Randfälle, Reihenfolge und Abbruchgrenzen gegen die bestehende Implementierung prüfen. Übergabe-, Kopier- und Startkosten einschließen; keine fachlich relevante Änderung durch Zahlengenauigkeit akzeptieren.

### B3.04 — WASM im realen Produktauftrag vergleichen

<!-- atlas-dependencies {"requires":["B3.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":["A6.09","A6.10"]} -->

- **Voraussetzung:** B3.03 fachlich gleichwertig.
- **Auftrag und Ergebnis:** Kernel in genau den gemessenen Materialjob einbinden und kalte/warme End-to-End-Fälle inklusive Transfers messen. Den getesteten Gewinner als einzigen regulären Kernel wählen; keinen permanenten Doppelpfad ohne Bedarf behalten.
- **Prüfung / fertig:** Reale Ladezeit verbessert und alle semantischen Tests bestanden. Bei fehlendem Gewinn Prototyp aus Produktpfad entfernen. Bei Übernahme zurück zu A6.09, nicht aus dem Kernelbenchmark heraus A6 abschließen.

## B4 — WebGPU

**Auslöser:** GPU-Arbeit oder Befehlsübergabe bleibt belegt begrenzend.
**Renderpfad:** B4.01 → B4.02 → B4.03 → B4.06 → B4.04 → B4.05.
**Reiner Rechenkern:** B4.01 → B4.07 → B4.05. Nur die passende Route aktivieren;
die jeweils andere Route entfällt begründet.
Aktivierung, zusätzliche externe Voraussetzungen und Rückkehrgates stehen pro
Route in `conditionalRoutes` des [Paketgraphs](work-packages.json). Render- und
Compute-Route werden getrennt terminiert; ein gemeinsamer Vergleichsbalken
berechtigt nicht zur Ausführung beider Alternativen.

### B4.01 — Unterstützung und realen Engpass prüfen

<!-- atlas-dependencies {"requires":[],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Aktivierender Befund, konkrete Electron-/GPU-/Treiberstände bekannt.
- **Auftrag und Ergebnis:** WebGPU auf dem Zielsystem ohne dauerhafte System-/Treiberänderung prüfen; benötigte Fähigkeiten, Ressourcenlimits und Fehler-/Verlustverhalten erfassen. CPU-Submission und tatsächliche GPU-Zeit soweit verfügbar getrennt messen; nicht verfügbare GPU-Zeit nicht erfinden.
- **Prüfung / fertig:** Hardwarepfad und Machbarkeit nachgewiesen. Fehlende Unterstützung oder kein geeigneter Engpass beendet den Versuch; kein stiller Softwarefallback im Vergleich.

### B4.02 — Geometrie und Kamera als WebGPU-Prototyp darstellen

<!-- atlas-dependencies {"requires":["B4.01"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** B4.01 geeignet.
- **Auftrag und Ergebnis:** A2-Puffer, metrische Kamera, opake Batches und Ressourcenlebensdauer in WebGPU abbilden. Gleiche Daten, gleiche Sichtbarkeit und Tiefe.
- **Prüfung / fertig:** Referenzanker, Farben, Verdeckung und Modellwiederverwendung stimmen; Befehls-/Ressourcenzähler vorhanden. Noch kein Renderergewinner.

### B4.03 — Terrainmaterialien in WebGPU darstellen

<!-- atlas-dependencies {"requires":["B4.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** B4.02.
- **Auftrag und Ergebnis:** Shaderfunktionen für Terrain, Materialmasken, Relief und Licht aus dem qualifizierten Kandidaten übertragen. Dieselben Kanalprodukte, Randbedingungen und Terrain-Modi verwenden; Vegetation bleibt ausschließlich B4.06.
- **Prüfung / fertig:** Dieselben Bildmerkmale und Maßstabsregeln; keine abgesenkten Samples oder vereinfachte Darstellung. Fachliche Kanalprodukte unverändert.

### B4.04 — Texte, Transparenz und Änderungen ergänzen

<!-- atlas-dependencies {"requires":["B4.06"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** B4.06.
- **Auftrag und Ergebnis:** Labels/Bilder, geordnete Transparenz und gemeinsame Pinseländerungsfolge anschließen. Ausgabeabschluss und Geräteverlust an den gemeinsamen Vergleichsvertrag binden.
- **Prüfung / fertig:** Vollständiges A2-Szenenmanifest, korrekte sichtbare Revision und saubere Freigabe. Kein Vorteil durch eine unvollständige Szene.

### B4.05 — WebGPU gegen den besten bisherigen Kandidaten vergleichen

<!-- atlas-dependencies {"requires":["B4.04"],"alternativeRequires":["B4.07"],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** B4.04 für Renderroute beziehungsweise B4.07 für Compute-Route.
- **Auftrag und Ergebnis:** Identische native Szenarien inklusive Startkosten, Ressourcen, sichtbarer Pinselreaktion und Fehlerbehandlung messen. Zusätzlichen Wartungs-/Auslieferungsaufwand dokumentieren.
- **Prüfung / fertig:** Übernahme nur bei belegtem Vorteil im tatsächlichen Engpass und voller Qualität. Renderwechsel zurück an A2.12/A3, reiner Materialkernel an A6.09. Nicht unterstützte Zielsysteme bleiben eine offene Produktentscheidung und verhindern pauschale Freigabe.

### B4.06 — Instanzvegetation in WebGPU darstellen

<!-- atlas-dependencies {"requires":["B4.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** B4.03; vor B4.04.
- **Auftrag und Ergebnis:** Vorhandene Baum-/Strauch-/Felsinstanzen und dekorative Vegetationsmaterialien in den WebGPU-Pfad übernehmen. Instanzanker, Dichte, Maßstabsübergang und Wasserunterdrückung erhalten.
- **Prüfung / fertig:** Identische Instanzzahlen und sichtbare Säume/Freiflächen über Zoom/Neigung; keine neue Verteilung und keine Detailreduktion. Kamera verändert keine Instanzpuffer.

### B4.07 — Einen Materialkernel mit GPU Compute vergleichen

<!-- atlas-dependencies {"requires":["B4.01"],"alternativeRequires":[],"activationRequires":["A6.08"],"returnGates":[]} -->

- **Voraussetzung:** B4.01 plus A6.08 mit genau benanntem reinem Materialrechenkern; keine gleichzeitige Renderbackend-Portierung.
- **Auftrag und Ergebnis:** Diesen Kernel mit begrenzten Eingabe-/Ausgabepuffern über Compute ausführen; Upload, Dispatch, Readback und Abbruch in den bestehenden Jobvertrag einbinden. Sampling, Maskenreihenfolge und Kanalformate unverändert lassen.
- **Prüfung / fertig:** Fachliche Kanal-Goldens einschließlich Rändern, Löchern und Wasser gegen CPU-Referenz; Gesamtzeit inklusive Transfers/Start messen. Bei fehlender Genauigkeit oder End-to-End-Gewinn endet der Versuch, sonst B4.05 im realen Job ausführen.

## B5 — Statische Inhalte in Rasterkacheln zusammenfassen

**Auslöser:** Ruhende flache Inhalte dominieren weiterhin Zeichenkosten.
**Reihenfolge:** B5.01 → B5.02 → B5.03 → B5.04.

### B5.01 — Geeignete Inhalte und Qualitätsgrenzen festlegen

<!-- atlas-dependencies {"requires":[],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Konkreter Restbefund mit benannter Inhaltsklasse.
- **Auftrag und Ergebnis:** Nur diese Klasse auf Rastereignung prüfen: Schärfe, Auflösung, Transparenz, Höhen-/Tiefenbezug und Auswahl. Geneigte/überlagerte Inhalte, deren Verdeckung durch Rasterung verloren geht, nicht flach zusammenfassen.
- **Prüfung / fertig:** Beispielbilder bei allen betroffenen Maßstäben/Neigungen zeigen fachliche Eignung oder disqualifizieren die Klasse. Kein impliziter Verzicht auf Neigung, Textschärfe oder Bearbeitung.

### B5.02 — Begrenzte ableitbare Rasterkacheln erzeugen

<!-- atlas-dependencies {"requires":["B5.01"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** B5.01 geeignet.
- **Auftrag und Ergebnis:** Geeignete Inhalte quellengültig und auflösungsgebunden rasterisieren; räumliche Grenzen, Transparenz und Ressourcenbudget festlegen. Nur abgeleitete Produkte, keine Änderung kanonischer Vektoren.
- **Prüfung / fertig:** Benachbarte Kacheln und Skalierungswechsel zeigen keine Nähte oder Unschärfe gegenüber der Referenz. Cache und Jobs bleiben begrenzt; Quellenänderung entwertet betroffene Produkte.

### B5.03 — Bearbeitung und Auswahl ohne Doppelbilder erhalten

<!-- atlas-dependencies {"requires":["B5.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** B5.02.
- **Auftrag und Ergebnis:** Geänderte/aktive Inhalte sofort mit ihren kanonischen Geometrien anzeigen; alte Rasteranteile vor doppelter Darstellung schützen. Auswahl bleibt an Originalgeometrie und gültige Revision gebunden. Rasterersatz erst vollständig veröffentlichen.
- **Prüfung / fertig:** Bearbeiten, verschieben, löschen und Undo/Redo während langsamer Rasterneuberechnung; kein Geisterbild, Flackern oder veralteter Treffer. Geneigte Darstellung weiterhin korrekt.

### B5.04 — Gesamtnutzen einschließlich Neuerzeugung vergleichen

<!-- atlas-dependencies {"requires":["B5.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":["A3.12","A4.09","A5.09"]} -->

- **Voraussetzung:** B5.03.
- **Auftrag und Ergebnis:** Navigation, Pinsel, kaltes Erzeugen, wiederholte Bearbeitung, Speicher und Export derselben Szene vergleichen. Gewinn ruhender Bilder darf neue Editier-/Ladeengpässe nicht verdecken.
- **Prüfung / fertig:** Qualität und Leistungsziele erhalten, End-to-End-Vorteil belegt. Übernahme durch betroffene A3/A4/A5-Gates; bei Nachteil Produkte/Cache aus dem regulären Pfad entfernen und Versuch beenden.

## B6 — Entscheidung über native Engine oder Gesamtumbau

**Auslöser:** Die geeigneten vorherigen Versuche verfehlen die Ziele mit belegter
Ursache. **Reihenfolge:** B6.01 → B6.02 → B6.03. Ergebnis ist eine neue begründete
Entscheidungsvorlage, keine vorweg autorisierte mehrmonatige Neuimplementierung.

### B6.01 — Verbleibende Grenze und vollständigen Migrationsumfang bestimmen

<!-- atlas-dependencies {"requires":[],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Dokumentierte Ergebnisse der tatsächlich relevanten vorherigen Versuche.
- **Auftrag und Ergebnis:** Nachweisen, welcher Engpass einen nativen Wechsel adressieren soll. Alle Verbraucher und Fähigkeiten aus A7.01 einschließlich Eingaben, Schriften, Export, Spielerfenster, Speicherung, Plattformlieferung und GPU-Verlust auflisten; keine Beschränkung auf ein schönes Kartenbild.
- **Prüfung / fertig:** Kandidatenbewertung kann zeigen, ob Enginewechsel die Ursache überhaupt beseitigt. Fehlende Daten oder allgemeine Hoffnung auf „nativ schneller“ sind kein positiver Befund.

### B6.02 — Eng begrenzten Machbarkeitsvergleich durchführen

<!-- atlas-dependencies {"requires":["B6.01"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** B6.01 benennt eine konkrete adressierbare Grenze.
- **Auftrag und Ergebnis:** Genau einen fachlich passenden nativen Kandidaten anhand der belegten Ursache wählen und einen isolierten Vergleich für diese Ursache mit denselben Eingabedaten herstellen. Plattform-/Lizenz-/Buildaufwand prüfen; kein vollständiger Editor und keine Änderung der installierten Anwendung.
- **Prüfung / fertig:** Gleiche Qualität im untersuchten Ausschnitt, belegte Zeiten und klar benannte noch nicht verglichene Funktionen. Ein isolierter Vorteil ist noch keine Gesamtproduktentscheidung.

### B6.03 — Neue Umstiegsentscheidung mit Aufwand und Risiken vorlegen

<!-- atlas-dependencies {"requires":["B6.02"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** B6.02.
- **Auftrag und Ergebnis:** Gesamtkosten, verbleibende Unsicherheiten, Alternativen und Abnahmestrategie für den nativen Wechsel ausarbeiten. Erforderliche Implementierung in eine neue ausdrücklich zu entscheidende Roadmap zerlegen, statt sie heimlich an A3 anzuhängen.
- **Prüfung / fertig:** Der Nutzer kann den vollständigen Umbau gegenüber dem besten bestehenden Weg beurteilen. Bis zur neuen Entscheidung bleiben die nicht erfüllten Ziele offen; kein Architekturwechsel allein aufgrund dieses Dokumentpakets.
