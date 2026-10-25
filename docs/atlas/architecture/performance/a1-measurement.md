# A1: Vergleich absichern – Arbeitspakete

Status: Planned; alle Pakete offen.
Owner: atlas
Last Reviewed: 2026-10-25 (Zerlegung; keine Umsetzung)
Source of Truth: Paketumfang für A1; Ziele und gemeinsame Ausführungsregeln stehen in der [Roadmap](../performance-roadmap.md).

**Start:** A0 samt unabhängigen Reviews abgeschlossen. **Reihenfolge:** A1.01 → A1.02 → A1.03; danach die unten angegebenen Paketvorgänger und Ressourcensperren beachten. A1.04–A1.08 sind keine pauschale serielle Kette. Native Proben und Änderungen ihrer Buildinputs dürfen nicht überlappen. A1.12 liegt vor A1.09/A1.10; A1.11 schließt die gemeinsame Basis ab.
Die bestehende Messkampagne wird erhalten. Neue Läufe schließen nur die methodischen Lücken.

Für jedes Paket gelten Zuständigkeit, Eingaben, Aufwand und Übergabe aus dem
[gemeinsamen Paketvertrag](handbook.md#gemeinsamer-paketvertrag). Fachkompetenz:
Node/Electron-Testautomatisierung und Messstatistik; A1.04/A1.06/A1.07 zusätzlich
GPU-/Frameinstrumentierung, A1.08 Workerprotokolle und monotone Prozessuhren.
Schnittstellen sind das gemeinsame Szenario-/Ergebnisformat, der jeweilige
Messanschluss und die Build-/Fixtureidentität; Rohbelege gehen an A1.11 und A2.

### A1.01 — Ausgangsbelege dauerhaft sichern

<!-- atlas-dependencies {"requires":["R0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Vorhandene lokale Messungen unter `.build/atlas-measure-20261025/` und der in der Roadmap angegebene Ausgangscommit.
- **Auftrag und Ergebnis:** Rohwerte, Szenen-/Buildidentität, Umgebungsdaten und ausgewählte Referenzbilder inventarisieren; ein kompaktes, versioniertes Ausgangspaket mit Prüfsummen unter dem neu anzulegenden `tests/fixtures/atlas/performance-baseline/` sichern. Große Profile über dauerhafte Artefaktreferenzen mit Hash anbinden; ohne solchen Speicher die benötigten Rohprofile mitliefern, nicht nur Zusammenfassungen. Ungültige Höhenproben und der fehlgeschlagene 200%-Abschluss bleiben gekennzeichnet.
- **Prüfung / fertig:** Jedes verwendete Ergebnis lässt sich vom Manifest zur Rohdatei zurückverfolgen; Summen, Stichprobenzahlen und p95 stimmen mit `MESSUNGEN.txt` überein. Fehlende Originale ausdrücklich ausweisen; keine Zahlen rekonstruieren oder bestehende Werte als neue Messung ausgeben.

### A1.02 — Szenarien und Ergebnisformat festlegen

<!-- atlas-dependencies {"requires":["A1.01","R0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A1.01.
- **Auftrag und Ergebnis:** Im vorhandenen `tools/atlas-benchmark/` ein gemeinsames Szenariomanifest und Ergebnisformat ergänzen: sechs Maßstäbe, drei Neigungen, zwei UI-Skalierungen, drei Wiederholungen, feste Kameras/Gesten, 20 Schiebegesten je Serie und mindestens 30 Gesten je Pinselart/Skalierung. Phasen `loaded`, `streaming`, `cold` trennen. Hardware, Viewport, DPR, UI-Skalierung, Cachezustand, Quellenrevision und Buildhash gehören zu jedem Lauf.
- **Prüfung / fertig:** Automatischer Auswerter nutzt p95 nach Nearest Rank pro Serie, erhält Einzelwerte und markiert unvollständige/fehlerhafte Serien; kein Zusammenmitteln der p95-Werte zu einem Pass. Kleine Datensätze prüfen Statistik, Vollständigkeit und getrennte Phasen. Bestehender Kleinbenchmark bleibt als solcher gekennzeichnet.

### A1.03 — Nativen Messprozess reproduzierbar betreiben

<!-- atlas-dependencies {"requires":["A1.02","R0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A1.02.
- **Auftrag und Ergebnis:** Start-/Endlogik aus `tools/atlas-benchmark/native.mjs` und den temporären Helfern vereinheitlichen: separate Kopie der Prüfkampagne, eindeutiges Ausgabeverzeichnis, Checkpoints, begrenzte Timeouts, Fehlerprotokoll und nachgewiesenes Prozessende. Keine Änderungen an Nutzerprofilen oder Systemkonfiguration.
- **Prüfung / fertig:** Je ein kurzer erfolgreicher Lauf sowie ein absichtlich fehlgeschlagener Start erzeugen vollständige Ergebnisse; Fehler werden nicht zu Erfolgen umgedeutet. Kein verwaister Testprozess. Vorher vorhandene fremde Prozesse nicht beenden.

### A1.04 — Geladene Navigation messen

<!-- atlas-dependencies {"requires":["A1.03","R0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A1.03.
- **Auftrag und Ergebnis:** Navigationsszenario implementieren, das Terrain-Detail, kanonische Objektgeometrie und einen zur aktuellen Kamera/Revision passenden fertigen Frame abwartet. Der Bewegungsweg muss im vorab geladenen Arbeitsbereich liegen; Nachladeereignisse werden erfasst und verunreinigen keine `loaded`-Serie. Während der aktiven Geste neue Kartenbilder mit Kamera-/Quellenidentität und Zeitstempel erfassen; wiederholte alte Bilder, ausgelassene Kameraaktualisierungen und Eingaberückstand ausweisen. CPU-Renderabschluss, GPU-Fertigstellung und Compositor-Präsentation getrennt behandeln: ausstehende GPU-Arbeit und Präsentationsrückstand durch geeignete Abschluss-/Präsentationsbelege erfassen und die Zuordnung zur Bildfolge validieren. UI-RAF und bloße Rendercallbacks bleiben Zusatzmetriken. Reichweite und Aufwand jedes Messpunkts dokumentieren; ohne belastbaren Nachweis der GPU-/Präsentationsgrenze gibt es keinen sichtbaren FPS-Pass, sondern eine ausdrücklich begrenzte CPU-Messung und eine offene Qualifikation.
- **Prüfung / fertig:** Zwei Negativkontrollen: Renderer künstlich auf 10 Hz begrenzen, während UI-RAF weiterläuft; zusätzlich GPU-Fertigstellung künstlich verzögern, während CPU-Rendercallbacks weiterhin schnell erfolgen. Beide Fälle müssen den Rückstand erkennen und einen sichtbaren Navigations-Pass verhindern. Ein nicht verfügbarer GPU-/Präsentationsbeleg darf ebenfalls keinen Pass erzeugen. Messhaken und deren Aufwand außerhalb der Basiszeitreihen prüfen. Eine Dorfserie ohne Nachladung sowie eine erzwungene Nachladung nachweisen; letztere wird separat klassifiziert oder als ungültige `loaded`-Serie gewertet. Einstieg: `src/app/atlas-raster-presentation.ts`, `src/app/atlas-deck-surface.ts`; bestehende Bereitschaftssignale allein nicht als Beweis verwenden.

### A1.05 — Kaltes Öffnen und Navigation mit Nachladung messen

<!-- atlas-dependencies {"requires":["A1.04","R0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A1.04.
- **Auftrag und Ergebnis:** Zwei Szenarien ergänzen: frisches Testprofil mit leerem abgeleitetem Cache je Kaltstart sowie fester Weg in ungeladene Nachbarbereiche. Erste sichtbare Oberfläche, vollständiges Terrain-Detail und vollständige Auswahlbereitschaft getrennt stoppen. Cachewarmzustand ausweisen; OS-Cache nicht als geleert behaupten.
- **Prüfung / fertig:** Ein kalter und ein warmer Kontrolllauf sowie ein Nachladeweg liefern unterschiedliche Phasen und konsistente Quellen-/Kameraidentitäten. Die 200%-Messung verwendet für einen Kaltvergleich keinen vorher gefüllten Cache. Einstieg: `tools/test-desktop-atlas-cache-reopen.mjs`, `tools/test-desktop-atlas-early-terrain.mjs`.

### A1.06 — Sichtbare Pinselreaktion messen

<!-- atlas-dependencies {"requires":["A1.03","A1.02","R0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A1.03 und A1.02.
- **Auftrag und Ergebnis:** Den vorhandenen Pixelprobe-Ansatz für abwechselnde Farbtupfer und einen frischen bekannten Hang für Höhe/Glätten übernehmen. Eingabe, berechneter Entwurf und erste passende sichtbare Pixel getrennt erfassen; Cursor-/Overlayänderungen dürfen keinen Terrain-Treffer vortäuschen. Keine Profilierung in der Basiszeitreihe.
- **Prüfung / fertig:** Kurze Probe je Pinselart plus wirkungslose Kontrollgeste; fehlende Pixeländerungen sind ungültig, nicht 0 ms. Messaufwand durch Readback gesondert ausweisen. Einstiege: `tools/terrain-pixel-readback.mjs`, `tools/test-desktop-atlas-brush-ux.mjs`.

### A1.07 — Renderressourcen und Neuanlagen instrumentieren

<!-- atlas-dependencies {"requires":["A1.03","R0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A1.03.
- **Auftrag und Ergebnis:** Nur im Diagnosemodus pro Frame Layerzahl, tatsächliche Zeichenaufrufe, Modell-/Pufferneuanlagen, gehaltene Ressourcen und Freigaben zählen. Zähler an realen Ressourcenereignissen anbringen; JavaScript-Layerkonstruktion ist keine GPU-Modellneuanlage. CPU-Aufrufzeit nicht als GPU-Ausführungszeit ausgeben.
- **Prüfung / fertig:** Kontrollszene mit bekannter Anlage, Wiederverwendung und Freigabe; deaktivierte Instrumentierung verändert den Produktpfad nicht. Einstieg: `src/app/atlas-deck-surface.ts`, `src/app/atlas-terrain-material-layer.ts`. Profilierte Läufe erhalten eine getrennte Kennung.

### A1.08 — Materialkosten entlang einer Anfrage aufteilen

<!-- atlas-dependencies {"requires":["A1.03","R0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A1.03.
- **Auftrag und Ergebnis:** Anfragekennung durch Host, Leseworker und Materialkernel führen. Warteschlange, Datenzugriff, Berechnung, kooperatives Warten und Antwortlaufzeit getrennt zählen; lokale monotone Uhrabschnitte verwenden, keine unkalibrierten Prozesszeitstempel voneinander abziehen. Exklusive Zeiten und verschachtelte Summen kennzeichnen.
- **Prüfung / fertig:** Eine einzelne und mehrere konkurrierende Anfragen zeigen nachvollziehbare Teilzeiten ohne doppelte Summierung; Abbruch wird als solcher beendet. Einstiege: `desktop/atlas-region.ts`, `desktop/atlas-region-worker.ts`, `src/app/storage/terrain-material.ts`. In diesem Paket weder Algorithmus noch Workerzahl ändern.

### A1.09 — Geladene Navigationsbasis aufnehmen

<!-- atlas-dependencies {"requires":["A1.04","A1.07","A1.12","R0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A1.04, A1.07 und A1.12.
- **Auftrag und Ergebnis:** Alle 36 Konfigurationen mit drei Serien nacheinander auf dem vorhandenen Laptop messen. Diagnoseprofile der Dorfansicht getrennt von den Basiszeitreihen aufnehmen; Build-/Fixtureidentität pinnen.
- **Prüfung / fertig:** 108 auswertbare Serien oder explizit benannte fehlgeschlagene Fälle; keine Lücken durch Wiederholungen verdecken. Bereitschaft, Konsolenfehler, Prozessende und Umgebungszustand mitliefern. Ergebnis ist eine Ausgangsbasis, noch keine Leistungsabnahme.

### A1.10 — Pinsel-, Kaltstart- und Nachladebasis aufnehmen

<!-- atlas-dependencies {"requires":["A1.05","A1.06","A1.08","A1.09","R0.03","A1.12"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A1.05, A1.06 und A1.08; A1.09 beendet, damit Messungen nicht konkurrieren.
- **Auftrag und Ergebnis:** Farbe/Höhe/Glätten je Skalierung mit mindestens 30 Gesten sowie drei Kaltstarts je Maßstab und Skalierung messen. Einen festgelegten Nachladeweg je Skalierung dreimal wiederholen. Lange Läufe checkpointen und nach Unterbrechung ausschließlich fehlende Fälle derselben Buildidentität fortsetzen.
- **Prüfung / fertig:** Rohwerte und getrennte Start-/Detail-/Auswahlzeiten vorhanden; Materialaufschlüsselung in eigenen Diagnoseläufen. Ein Fehler wie der bekannte Abbruch beim Schließen bleibt ein fehlerhafter Gesamtlauf, auch wenn zuvor brauchbare Zeitwerte entstanden.

### A1.11 — Vergleichsbasis freigeben

<!-- atlas-dependencies {"requires":["A1.09","A1.10","R0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A1.09 und A1.10.
- **Auftrag und Ergebnis:** Manifest, Rohwerte und Auswertung zusammenführen; den exakten reproduzierbaren Aufruf dokumentieren. Befunde nach geladener Darstellung, Eingabe bis Bild und Nachladung ordnen. Bereits gültige historische Werte behalten ihre ursprüngliche Kennzeichnung.
- **Prüfung / fertig:** Auswertung aus gesicherten Rohdaten erneut erzeugbar; alle Pflichtfälle abgedeckt oder als offene Voraussetzung benannt. A1 ist nur abgeschlossen, wenn A2 eine vollständige und reproduzierbare Vergleichsbasis besitzt. Keine Rendererentscheidung vorwegnehmen.

### A1.12 — Fehlerfreien Abschluss der Messwerkzeuge bestätigen

<!-- atlas-dependencies {"requires":["A0.10","A1.01","A1.03","R0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.10, A1.01 und A1.03; vor A1.09/A1.10 ausführen.
- **Auftrag und Ergebnis:** Den frühen Schließfix mit dem endgültigen A1-Messrunner prüfen. Historische 200%-Fehlmessung unangetastet erhalten; neue Instrumentierung darf beim Schließen keine Aufgaben offen halten oder echte Fehler verschlucken.
- **Prüfung / fertig:** Material- und Geometrienachladung beim normalen Abschluss ohne unhandled rejection oder Restprozess; injizierter echter Fehler bleibt als Fehler erfasst. Neue Basis trägt die Buildidentität nach A0. Bei Regression gezieltes Fixpaket einschieben und erneut prüfen; A7.14 wiederholt die Grenze nach dem Rendererumbau.
