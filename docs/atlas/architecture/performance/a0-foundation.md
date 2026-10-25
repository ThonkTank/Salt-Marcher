# A0: Architekturgrundlage absichern – Arbeitspakete

Status: Executing; A0.01–A0.05 lokal implementiert, native Qualifikation und unabhängige Meilensteinprüfung offen.
Owner: atlas
Last Reviewed: 2026-10-25 (Zerlegung nach unabhängiger Architekturprüfung)
Source of Truth: Paketumfang für A0; Begründung in der [Architekturprüfung](architecture-audit.md), gemeinsame Regeln in der [Roadmap](../performance-roadmap.md).

A0 ist der regulären Folge A1–A7 vorgeschaltet. Originale der bisherigen Messung
vor Änderungen mit Hash inventarisieren und unangetastet lassen; spätere Baselines
tragen neue Buildidentitäten. Eigene Regressionen je Fix, keine globale
Rendererbereinigung in diesem Meilenstein. Paketabhängigkeiten werden in der
Timeline abgebildet; unabhängige Besitzer dürfen getrennt bearbeitet werden.

Für jedes Paket gelten Zuständigkeit, Eingaben, Aufwand und Übergabe aus dem
[gemeinsamen Paketvertrag](handbook.md#gemeinsamer-paketvertrag). Eingaben sind
die konkreten Befunde und Codeanschlüsse der Architekturprüfung. Fachkompetenz:
A0.01–A0.03 TypeScript/GPU-Präsentation und Treffergeometrie, A0.04–A0.06
Electron-IPC und Workerlebenszyklus, A0.07/A0.08 Autoren-/Reise-Recovery,
A0.09 SQLite-Transaktionen und Receipts, A0.10/A0.11 native Fehlerproben.
Schnittstellen sind Frameberechtigung, Besitzerabbruch und typisierte
Schreibausgänge; der gemeinsame geprüfte Build geht über R0 an die A1-Basis.

### A0.01 — Auswahl und neue Autorenaktionen an den richtigen Frame binden

<!-- atlas-dependencies {"requires":["P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Architekturprüfung; ursprüngliche Messartefakte erhalten.
- **Auftrag und Ergebnis:** Produktive Treffer und Start neuer Autorenaktionen an den passenden abgeschlossenen Surface-Frame binden. Overlay-Canvas allein erteilt keine Berechtigung. Navigation bleibt verfügbar; bereits laufende eingefrorene Gesten behalten ihren expliziten Vertrag und werden bei Kontextverlust korrekt abgebrochen.
- **Prüfung / fertig:** Renderabschluss zurückhalten, Kamera/Szene ändern, auswählen bzw. Geste beginnen: keine veraltete Aktion. Danach nur der passende Frame freigegeben; alter Callback und GPU-Verlust erlauben keinen Treffer. Tests am Präsentations-/Canvasanschluss, nicht nur an `AtlasDeckSurface`.

### A0.02 — Erststartfehler und Retry abschließen

<!-- atlas-dependencies {"requires":["A0.01","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.01 wegen gemeinsamem Präsentationsbesitzer.
- **Auftrag und Ergebnis:** Fehlgeschlagenes `openSurface` beendet seinen Öffnungsversuch. Retry ohne vorhandene Surface erzeugt einen neuen Initialisierungsversuch mit aktueller Quelle/Kamera; Container, Listener und Waiter bleiben eindeutig. Quellenwechsel während Initialisierung verwirft nur den alten Versuch.
- **Prüfung / fertig:** Erster Surface-Start schlägt fehl, zweiter gelingt: kein hängendes Promise, genau ein Retry, wieder brauchbarer Atlas. Zusätzlicher Fall Deaktivieren während Initialisierung. Keine globale Unterdrückung von Fehlern.

### A0.03 — Alpha-Treffer für normale Bildassets herstellen

<!-- atlas-dependencies {"requires":["P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Architekturprüfung; unabhängig von A0.01/A0.02 implementierbar.
- **Auftrag und Ergebnis:** Trefferdaten aus tatsächlich genutzten Bildassets einmal begrenzt ableiten und über den normalen Bildkommando-Pfad mitführen. Asset-/Alpha-Ressourcen gemeinsam freigeben; keine Lesearbeit pro Dreieck oder Mausbewegung.
- **Prüfung / fertig:** Echtes Bildkommando mit transparentem Loch über auswählbarer Geometrie kompilieren: Loch trifft Hintergrund, opaker Pixel das Bild. Transformation/Neigung prüfen. Alpha nicht im Test manuell in fertige Meshes injizieren.

### A0.04 — Exportabbruch von Editorleseaufträgen isolieren

<!-- atlas-dependencies {"requires":["P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** Architekturprüfung.
- **Auftrag und Ergebnis:** Besitzer und Abbruchgrenzen der Terrain-/Material-/Geometrieanfragen explizit machen. Exportabbruch darf ausschließlich seine Aufträge beenden; Editor-Nachladung und andere gültige Verbraucher laufen weiter. Bestehende Request-Identitäten nutzen, keinen unbeschränkten Workerpool einführen.
- **Prüfung / fertig:** Gleichzeitig laufende Editor-Tile und Exportanfrage, dann Exportabbruch: nur Export abgebrochen, Editor erhält gültiges Produkt und bleibt bedienbar. Quellensperre und Appstopp dürfen weiterhin alle betroffenen Aufträge beenden. Tests über echte Hosthandler und Lesedienst, nicht nur Fake-Cancel.
- **Präzisierung v1.1:** Die Consumerzuordnung darf Tilejobs nicht durch die gemeinsame Terrain-Wartespur verlieren. Feste begrenzte Surface-/Geometry-Spuren erhalten Quelle, Token, Fence, Query und Cancelgeneration bei kooperativer Fortsetzung. Ein echter mehrschrittiger Tilejob mit eingeschobener Kamera-/Geometriearbeit muss nach endlicher Interferenz vollständig wie die ununterbrochene Berechnung enden. Keine Wiederaufnahme nach Cancel, Ersetzung, Quellenwechsel oder echtem Workerfehler; keine zusätzlichen Worker oder unbeschränkten Nachfolger. Exportabbruch mit gleichzeitiger Editor-Höhe, Material, Geometrie und Fortsetzung prüfen. Unabhängige Annahmenprüfung bestätigt diese begrenzte Erweiterung; Implementierungsabnahme bleibt offen.

### A0.05 — Graphbarriere nach Quellen-Await erneut prüfen

<!-- atlas-dependencies {"requires":["A0.04","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.04 wegen gemeinsamer Main-Handler.
- **Auftrag und Ergebnis:** Fehlende erneute Barrierenprüfung im Terrain-Projektionshandler ergänzen; vergleichbare Atlas-Readhandler auf denselben konkreten Await-Spalt prüfen. Kein Auftrag auf inzwischen gesperrtem Graphstand starten.
- **Prüfung / fertig:** Quellenantwort anhalten, Graphwechsel beginnen, Antwort freigeben: `reader.terrain` wird nicht gestartet. Normalfall ohne Barriere bleibt erfolgreich; tatsächlicher Handler wird ausgeführt, kein bloßer Quelltext-Regex.

### A0.06 — Unbekannten Schreibausgang über die Hostgrenze erhalten

<!-- atlas-dependencies {"requires":["A0.05","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.05 wegen gemeinsamer Main-Handler.
- **Auftrag und Ergebnis:** Unbekannten Ausgang strukturiert von definitiver Ablehnung unterscheiden und über Main/Preload/Result bis zum Atlasbesitzer transportieren. Keine Fehlermeldung als Parserprotokoll verwenden. Bestehende sichere Behandlung anderer Result-Verbraucher erhalten; kanonischer Store bleibt einziger Writer.
- **Prüfung / fertig:** Workerantwortverlust vor/nach möglichem Commit sowie definitive Validierungsablehnung durch den echten Resultpfad testen. Unbekannt bleibt unbekannt, bekannte Ablehnung bleibt definitiv, keine automatische Wiederholung. Gemeinsame Type-/Desktopchecks bestehen.

### A0.07 — Atlas-, Raum- und Zeichenaufträge bis zur Klärung behalten

<!-- atlas-dependencies {"requires":["A0.06","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.06.
- **Auftrag und Ergebnis:** Strukturierte unbekannte Ergebnisse in `writeAtlas`, `writeAtlasCommit`, Raum- und Zeichnungswriter wie verlorene Antworten behandeln: exakten Command behalten, Folgeschreiben sperren, dieselbe Command-ID zur Receipt-Klärung verwenden. Wrapper für City/World, History und Graphannahme auf denselben Vertrag prüfen.
- **Prüfung / fertig:** Tatsächlicher Main-Result → Autorenbesitzer → Recoverypfad bewahrt Kennung und sperrt weitere Änderungen. Receipt vorhanden, definitiv nicht gespeichert und weiterhin unbekannt separat prüfen; kein doppelter Commit. Native Status-/Recoveryprobe ergänzen.

### A0.08 — Unbekannten Reiseauftrag bis zur Klärung behalten

<!-- atlas-dependencies {"requires":["A0.06","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.06; eigener Besitzer gegenüber A0.07.
- **Auftrag und Ergebnis:** `acknowledged`/Pending-Zustand im Reisebesitzer an den tatsächlichen Ausgang binden. Ein empfangenes unbekanntes Result ist keine definitive Bestätigung. Reise bleibt gesperrt, bis derselbe Auftrag geklärt ist.
- **Prüfung / fertig:** Antwortverlust nach möglicher Zeit-/Positionsbuchung führt zur Recovery mit identischer Kennung; Klärung erzeugt keinen zweiten Zeitschritt. Definitive Ablehnung bleibt normal korrigierbar. Bestehende Reise-Recoverytests am tatsächlichen Hostresult ergänzen.

### A0.09 — Commitbestätigung von nachfolgender Leseprojektion trennen

<!-- atlas-dependencies {"requires":["A0.06","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.06; eigener Storebesitzer gegenüber den Autorenpaketen.
- **Auftrag und Ergebnis:** Nach erfolgreichem Atlas-, Room- oder Drawing-Commit dürfen fehlgeschlagene Kampagnen-/Inventarleser den Auftrag nicht als definitiv abgelehnt melden. Auch `atlasRoomCommit` und dessen Aufbau des `RoomCommit` nach `applyAtlas` gehören dazu: die nachgelagerte Raum-/Workspaceantwort darf den bereits gespeicherten Ausgang nicht verlieren. Vorhandene Receipt-/Outcome-Verträge benutzen: gespeicherten Ausgang getrennt von fehlender aktueller Ansicht erhalten oder explizit klärbar halten. Nicht den Writer erneut aufrufen und keinen zusätzlichen Historyschritt erzeugen.
- **Prüfung / fertig:** Commit erfolgreich, anschließendes `campaignAtlas`-/Workspace-/Drawing-Lesen oder Nachlese für `atlasRoomCommit`/`RoomCommit` injiziert fehlgeschlagen: Receipt und exakte Command-Kennung bleiben verfügbar, keine falsche definitive Ablehnung, keine doppelte Buchung. Nach Receipt-Klärung stehen Daten und History weiter auf genau einem angewandten Auftrag; fehlende Ansicht wird getrennt neu gelesen. Fehler vor Commit und weiterhin unbekannter Ausgang separat prüfen. Gewöhnliche Spieler-Sync-Fehler sind kein zusätzlicher behaupteter Defekt.

### A0.10 — Erwarteten Appstopp ohne Ladefehler abschließen

<!-- atlas-dependencies {"requires":["A0.02","A0.04","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.02 und A0.04; historische 200%-Fehlmessung erhalten.
- **Auftrag und Ergebnis:** Bekannten Fehler beim Schließen mit laufender Material-/Geometrienachladung reproduzieren und erwarteten Hoststopp gezielt behandeln. Ausstehende Aufgaben beenden; echte Ladefehler weiterhin sichtbar melden.
- **Prüfung / fertig:** Normales Schließen während Nachladung ohne unhandled rejection oder Restprozess; injizierter echter Fehler bleibt Fehler. Originalwerte nicht nachträglich ändern. Neue Basis erhält neuen Buildhash. A1.12/A7.14 prüfen diese Grenze erneut.

### A0.11 — Grundlage mit Produktionsregressionen qualifizieren

<!-- atlas-dependencies {"requires":["A0.01","A0.02","A0.03","A0.04","A0.05","A0.06","A0.07","A0.08","A0.09","A0.10","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.01–A0.10 abgeschlossen.
- **Auftrag und Ergebnis:** Gezielte neue Tests gemeinsam ausführen, native Start/Retry-/Auswahl-/Speicherklärungs-/Exportabbruch-/Schließproben auf demselben Build prüfen. Die Architekturbeurteilung anhand der Fixes aktualisieren.
- **Prüfung / fertig:** Jeder konkrete Befund aus der Architekturprüfung besitzt einen reproduzierbaren Produktionsnachweis; keine Fremdänderung überschrieben. Danach unabhängige Reviews und Annahmenprüfung gemäß Ausführungsregeln. A1 startet erst ohne offenen erforderlichen A0-Befund.
