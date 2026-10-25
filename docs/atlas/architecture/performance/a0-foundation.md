# A0: Architekturgrundlage absichern – Arbeitspakete

Status: Executing; A0.01–A0.05 lokal implementiert, A0.10 nativ geprüft; gemeinsame Qualifikation und unabhängige Meilensteinprüfung offen.
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
A0.09 SQLite-Transaktionen und Receipts, A0.10/A0.11/A0.14 native Fehlerproben, A0.12 Canvas-/GPU-Lebenszyklus,
A0.13 Receiptidentität und begrenzte persistente Klärungsreferenzen; A0.15–A0.17
Graphpreview-Transaktionen, dauerhafter Lebenszyklus und ausdrückliche Autorenbindung.
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

<!-- atlas-dependencies {"requires":["A0.06","P0.03","A0.13"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.06 und A0.13.
- **Auftrag und Ergebnis:** Strukturierte unbekannte Ergebnisse in `writeAtlas`, `writeAtlasCommit`, Raum- und Zeichnungswriter wie verlorene Antworten behandeln: exakten Command behalten, Folgeschreiben sperren, dieselbe Command-ID zur Receipt-Klärung verwenden. Wrapper für City/World, History und Graphannahme auf denselben Vertrag prüfen. Auch direkt über `executeGraph` laufende Preview-erzeugende und Preview-ändernde Graphaktionen gehören zum selben Unknown-Besitzer: Preview-ID und Commandidentität vor Dispatch sichern, bei unbekannter Antwort Folgeschreiben sperren und nach Neustart ausschließlich den ursprünglichen Previewreceipt lesen.
- **Prüfung / fertig:** Tatsächlicher Main-Result → Autorenbesitzer → Recoverypfad bewahrt Kennung und sperrt weitere Änderungen. Receipt vorhanden, definitiv nicht gespeichert und weiterhin unbekannt separat prüfen; kein doppelter Commit. Vor Dispatch die A0.13-Referenz sichern, bei Aktivierung aus der gesicherten Referenz wieder sperren und mit frischer Aktivierungsberechtigung ausschließlich lesend klären. Die erste preview-erzeugende Graphaktion vor/nach Commit mit verlorenem Result und neuem Renderer ohne nachgereichte ID prüfen. Native Status-/Recoveryprobe folgt in A0.14; fehlgeschlagene Referenzsicherung darf keinen Dispatch erlauben.

### A0.08 — Unbekannten Reiseauftrag bis zur Klärung behalten

<!-- atlas-dependencies {"requires":["A0.06","P0.03","A0.13"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.06 und A0.13; Reisebesitzer in `atlas-journey.ts` und Reise-Recoveryhandler in `campaign-atlas-ui.ts`. Wegen der gemeinsamen UI-Datei mit A0.07 nacheinander bearbeiten.
- **Auftrag und Ergebnis:** `acknowledged`/Pending-Zustand im Reisebesitzer an den tatsächlichen Ausgang binden. Ein empfangenes unbekanntes Result ist keine definitive Bestätigung. Reise bleibt gesperrt, bis derselbe Auftrag geklärt ist.
- **Prüfung / fertig:** Antwortverlust nach möglicher Zeit-/Positionsbuchung führt zur Recovery mit identischer Kennung; Klärung erzeugt keinen zweiten Zeitschritt. Definitive Ablehnung bleibt normal korrigierbar. Bestehende Reise-Recoverytests am tatsächlichen Hostresult ergänzen. Vor Dispatch die A0.13-Referenz sichern und nach neuem Renderer wiederherstellen. Der Recoverybutton benutzt den lesenden A0.13-Statuspfad; fehlender Receipt darf die Reise nicht erstmals ausführen. Fokus-/Kampagnenwechsel und fortbestehendes Unknown prüfen; native Wiederaufnahme in A0.14.

### A0.09 — Commitbestätigung von nachfolgender Leseprojektion trennen

<!-- atlas-dependencies {"requires":["A0.06","P0.03","A0.17","A0.15","A0.16"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.06; für die abschließende Nacharbeit A0.15–A0.17. Der erste begrenzte Storefix liegt in `950b79eb`; die unabhängig reproduzierte Graphpreview-Grenze bleibt bis zum Besitzeranschluss offen.
- **Auftrag und Ergebnis:** Nach erfolgreichem Atlas-, Room- oder Drawing-Commit dürfen fehlgeschlagene Kampagnen-/Inventarleser den Auftrag nicht als definitiv abgelehnt melden. Auch `atlasRoomCommit` und dessen Aufbau des `RoomCommit` nach `applyAtlas` gehören dazu: die nachgelagerte Raum-/Workspaceantwort darf den bereits gespeicherten Ausgang nicht verlieren. Vorhandene Receipt-/Outcome-Verträge benutzen: gespeicherten Ausgang getrennt von fehlender aktueller Ansicht erhalten oder explizit klärbar halten. Nicht den Writer erneut aufrufen und keinen zusätzlichen Historyschritt erzeugen.
- **Prüfung / fertig:** Commit erfolgreich, anschließendes `campaignAtlas`-/Workspace-/Drawing-Lesen oder Nachlese für `atlasRoomCommit`/`RoomCommit` injiziert fehlgeschlagen: Receipt und exakte Command-Kennung bleiben verfügbar, keine falsche definitive Ablehnung, keine doppelte Buchung. Nach Receipt-Klärung stehen Daten und History weiter auf genau einem angewandten Auftrag; fehlende Ansicht wird getrennt neu gelesen. Fehler vor Commit und weiterhin unbekannter Ausgang separat prüfen. Gewöhnliche Spieler-Sync-Fehler sind kein zusätzlicher behaupteter Defekt.

- **Präzisierung v1.4:** Die typisierte Storage-Ausnahme wird am tatsächlichen Store-Worker-Catch in den vorhandenen Unknown-Kanal übersetzt; Main/Preload behalten A0.06. Die Terraincache-Nachlese nach `executeAtlasWrite` zählt nur außerhalb einer noch offenen äußeren Transaktion als Postcommit. Innerhalb der Prepared-Transaktion muss ihr Fehler regulär zurückrollen; Receipt, Revision und History bleiben dann unverändert. Den vorhandenen RoomCommit-Leser aus `edit` lösen, damit `atlasRoomCommit` nach `applyAtlas` ausschließlich liest. Der bereits exponierte Worker-Sonderweg `executeCity` (Atlas-Commit, danach City-Projektion) nutzt denselben begrenzten Schutz und erhält eine eigene Regression. Keine allgemeine Klassifikation aller Storefehler, kein vorsorglicher Umbau anderer Fachbereiche.

### A0.10 — Erwarteten Appstopp ohne Ladefehler abschließen

<!-- atlas-dependencies {"requires":["A0.02","A0.04","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.02 und A0.04; historische 200%-Fehlmessung erhalten.
- **Auftrag und Ergebnis:** Bekannten Fehler beim Schließen mit laufender Material-/Geometrienachladung reproduzieren und erwarteten Hoststopp gezielt behandeln. Ausstehende Aufgaben beenden; echte Ladefehler weiterhin sichtbar melden.
- **Prüfung / fertig:** Normales Schließen während Nachladung ohne unhandled rejection oder Restprozess; injizierter echter Fehler bleibt Fehler. Originalwerte nicht nachträglich ändern. Neue Basis erhält neuen Buildhash. A1.12/A7.14 prüfen diese Grenze erneut.

### A0.11 — Grundlage mit Produktionsregressionen qualifizieren

<!-- atlas-dependencies {"requires":["A0.01","A0.02","A0.03","A0.04","A0.05","A0.06","A0.07","A0.08","A0.09","A0.10","P0.03","A0.12","A0.13","A0.14","A0.15","A0.16","A0.17"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.01–A0.10 und Fixpakete A0.12–A0.17 abgeschlossen.
- **Auftrag und Ergebnis:** Gezielte neue Tests gemeinsam ausführen, native Start/Retry-/Auswahl-/Speicherklärungs-/Exportabbruch-/Schließproben auf demselben Build prüfen. Die Architekturbeurteilung anhand der Fixes aktualisieren.
- **Prüfung / fertig:** Jeder konkrete Befund aus der Architekturprüfung besitzt einen reproduzierbaren Produktionsnachweis; keine Fremdänderung überschrieben. Danach unabhängige Reviews und Annahmenprüfung gemäß Ausführungsregeln. A1 startet erst ohne offenen erforderlichen A0-Befund.
- **Nativanschluss nach Quellenprüfung:** `tools/test-desktop-atlas-foundation.mjs` ergänzt die fehlenden Fälle mit vorhandener `native-session.mjs` und `atlas-canonical-fixture.mjs`: Erstinitialisierung scheitert und sichtbarer Retry gelingt; fehlgeschlagene GPU-Wiederherstellung während eines Zeichenbatches mit aktuellem Terrain; Auswahl-/Autorenfreigabe erst nach passendem Frame; Exportabbruch bei nachweislich bereits laufenden Editorreads. Normale automatische Kontextwiederherstellung in `test-desktop-atlas-raster-workbench.mjs` allein belegt den expliziten Retry nicht. Bildalpha wird mit tatsächlich dekodiertem PNG über normale Bildkommandos und die produktive Trefferpipeline nativ geprüft; aktuelle Workbenchbilder sind nicht auswählbar, daher ist dies ausdrücklich ein Pipelinebeleg, kein neues Bildwerkzeug. Fehlersteuerung bleibt im Harness. Keine native Durchführung vor den Vorgängergates und dem eingefrorenen gemeinsamen Build.

### A0.12 — Canvas und Grafikfläche gemeinsam nach einem GPU-Fehler wiederherstellen

<!-- atlas-dependencies {"requires":["A0.01","A0.02","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.01/A0.02; unabhängiger Zwischenbefund auf `6235ca15`: GPU-Fehler während ausstehendem Canvas-Batch setzt `AtlasCanvas.failed`, der Raster-Retry setzt diesen Besitzer nicht zurück.
- **Auftrag und Ergebnis:** Den vorhandenen Retry über die betroffenen Canvas-/Präsentationsbesitzer vollständig abschließen. Aktuelle Quelle und Kamera nach erfolgreicher Wiederherstellung neu veröffentlichen; Auswahl/Autorenstart erst mit passendem neuem Frame freigeben. Fehleranzeige und Ressourcen konsistent zurücksetzen, ohne alte Szene oder alte Callbacks zu autorisieren. Echte Canvas-/Bildfehler dürfen durch den Kamera-Retry nicht verdeckt werden. Zuständigkeiten bleiben im bestehenden Lebenszyklus.
- **Prüfung / fertig:** Produktionsnaher Verbundtest mit echtem Canvas und Raster: initial erfolgreich zeichnen, GPU-Fehler bei ausstehendem Batch, sichtbaren Kamera-Retry auslösen, neuen passenden Frame abschließen. Danach Fehlerpanel beendet, aktuelle Karte sichtbar und Auswahl/Autorenstart möglich; alte Frame-/Fehlerantworten bleiben unwirksam. Erneuter Fehler und Deaktivieren während Retry bleiben sicher. Keine reine Rasterprobe als Ersatz. Native Wiederholungsprobe in A0.11.
- **Zuweisung / Aufwand:** TypeScript-/GPU-Lebenszyklusbesitzer; ein begrenzter Agentenlauf, Profil `implementation` gemäß Paketgraph. Schreibbereiche Canvas, Raster, Präsentationsvertrag und zugehörige Regressionen. Während A0.10-Nativfenster nur Vorbereitung; Ressourcenregel verhindert konkurrierende Buildänderungen.

### A0.13 — Neustartfeste Atlas- und Reisebelege ohne Schreibwiederholung klären

<!-- atlas-dependencies {"requires":["A0.06","A0.09","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.06/A0.09; unabhängiger Befund zum fehlenden Produktpfad nach terminalem Workerabbruch. Bestehende Atlas-/Travelreceipts und die ausdrücklich adressierten Previewreceipts aus A0.15/A0.16 bleiben maßgeblich.
- **Auftrag und Ergebnis:** Eine kompakte kampagnengebundene Klärungsreferenz vor Dispatch dauerhaft sichern und nach vollständigem Verlust des Rendererzustands wieder lesen können. Exakten laufenden Command, ursprüngliche Receiptidentität und neue Aktivierungsberechtigung trennen. Kein pauschales Speichern großer Terrainpayloads in `localStorage`; keine Mutation verschachtelter Commands beim Tokenwechsel. Persistenzfehler verhindern ungesicherten Dispatch. Begrenzten gemeinsamen Vertrag/Helper für kanonische Atlas-/Reiseaufträge und Preview-erzeugende/-ändernde Graphaufträge bereitstellen; A0.07/A0.08 schließen ihre Besitzer daran an. Bereits die erste Graphaktion muss Preview-/Commandidentität vor Dispatch dauerhaft sichern und nach vollständigem Renderer-/Hostneustart aus dieser Referenz klärbar bleiben.
- **Statuspfad:** Atlas- und Reisebelege ausschließlich lesend über Store/Worker/Main/Preload prüfen: angewandt, nicht angewandt oder noch ungeklärt. Noch aktive Schreib-/Vorbereitungsaufträge bleiben ungeklärt; Abwesenheit während laufender Arbeit ist keine Nichtanwendung. Frischer Token autorisiert die aktuelle Kampagne separat; Fingerprint, Kennung und gegebenenfalls Preview-ID identifizieren den ursprünglichen Auftrag. Eine fehlende oder andere Vorschau darf weder zum kanonischen Atlas umgeleitet noch als passende Nichtanwendung ausgegeben werden. Reiseprüfung darf weder Writer ausführen noch aktuelle Fokus-/Reiseprojektion voraussetzen.
- **Prüfung / fertig:** Echte Host-/Worker-/Preload-Tests für vorhanden/fehlend/laufend/unlesbar, fremde Kampagne, abweichenden Fingerprint und neue Aktivierungsberechtigung. Verschachtelte ursprüngliche Tokens bleiben Teil der unveränderten Identität. Persistenz-/Reloadtests ohne vom Test nachgereichte Kennung; beschädigte Referenz und Speicherfehler sperren sicher. Wiederholte Abfragen verändern weder Writerdispatchzahl noch Uhr, Position, Revision oder History. Keine neue automatische Wiederholung oder generische Ausweitung sämtlicher Buchungsfamilien.
- **Zuweisung / Aufwand:** Ein Agent mit TypeScript/Electron/SQLite-Kompetenz; Profil `implementation`. Gemeinsame Referenz-/Persistenzschnittstelle, vorhandene Receiptleser und genau deren Brücken. Tatsächliche zusätzliche Pfade vor Schreiben im Graphen konkretisieren; keine parallelen Änderungen an A0.09-Storebesitzern.
- **Lesend vorbereitete Anschlüsse:** `campaign-atlas-author.ts` hält Pending derzeit im tokengebundenen Speicher; `atlas-journey.ts` hält den Reisecommand im Besitzer. Die kompakte Referenz muss die maßgebliche Fingerprint-Eingabe teilen: kanonischer Atlas in `storage/campaign-atlas.ts`, Vorschau in `storage/graph-preview-commands.ts`, Reise in `storage/atlas-travel.ts`. Diese Eingaben unterscheiden sich; die Referenz darf sie nicht durch eine einheitlich erfundene Serialisierung ersetzen. Der vorhandene Reisewriter liest die Fokusprojektion vor seinem Receipt und ist deshalb kein Statusleser. `desktop/atlas-write-activity.ts` schützt bereits Atlas-/Graphaufträge; die Reisehandler in Main benötigen denselben Schutz vor voreiliger Nichtanwendung. A0.15/A0.16-Übergaben vor Implementierung erneut prüfen; Vorbereitung ist keine Wiederanlaufqualifikation.

### A0.14 — Gesicherte ungeklärte Aufträge schließen und nach Neustart wiederaufnehmen

<!-- atlas-dependencies {"requires":["A0.07","A0.08","A0.10","A0.12","A0.13","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A0.07/A0.08/A0.10/A0.12/A0.13 lokal umgesetzt. Exklusives natives Buildfenster.
- **Auftrag und Ergebnis:** Den ausdrücklich angeforderten Abschluss nach nachgewiesener Sicherung ungeklärter Atlas-/Reiseidentitäten ermöglichen. Unbekannt bleibt unbekannt; nur sicher wiederaufnehmbare Aufträge erlauben den Übergang. Andere offene oder nicht gesicherte Entwürfe bleiben geschützt und dürfen weder verworfen noch als gespeichert ausgegeben werden. Vorhandene Flush-/Close-Reihenfolge und Main-Besitz des tatsächlichen Prozessendes erhalten.
- **Prüfung / fertig:** Echter Autoren-/Reisebesitzer → Hostfehler vor beziehungsweise nach Commit → explizites Schließen → tatsächlicher Prozessausstieg → frischer Renderer und neue Aktivierung → lesende Klärung allein aus gespeicherter Referenz. Keine Kennung aus Testvariablen an die neue UI zurückreichen. Angenommen, nicht angewandt, weiter ungeklärt, beschädigte Referenz und fremde Kampagne getrennt prüfen. Nach wiederholter Klärung keine zweite Buchung, kein nachgeholter Reiseauftrag, keine zusätzliche Zeit-/Positionsänderung. Bei zusätzlichen ungesicherten Eingaben muss Schließen verweigert bleiben; bei sicherer Wiederaufnahme zeigt die UI den offenen Ausgang ehrlich. Dieselbe persistente Graphvorschau aus A0.16 mit ihren offenen Änderungen und Receipts in die Neustartfälle aufnehmen, ausdrücklich einschließlich Antwortverlust der ersten preview-erzeugenden Graphaktion vor/nach Commit; gesicherte Kennung allein erlaubt keinen Entwurfsverlust. Neue Builds/Prozesse und Native-Pendinggrenzen dokumentieren.
- **Zuweisung / Aufwand:** Ein Agent mit Editor-/Host-Lebenszyklus und nativer QA; Profil `native`. Dies übernimmt die native A0.07/A0.08-Status-/Recoveryprobe ohne paralleles Nativfenster. A0.11 prüft anschließend den gesamten A0-Stand und darf unveränderte gültige Einzelbelege übernehmen, fehlende Verbundfälle sind auszuführen.

### A0.15 — Graphvorschau-Aufträge und Belege unter einem Transaktionsbesitzer führen

<!-- atlas-dependencies {"requires":["A0.06","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Eingaben:** A0.09-Zwischenstand `950b79eb`, reproduzierte Room-/Drawing-Shadowfehler vor und nach erfolgreicher Rücklese sowie `GraphShadow` und vorhandene Drawing-/Roomhistory. Kein bloßer Wrapper um zwei getrennte Commits.
- **Auftrag und Ergebnis:** Eindeutige Preview-ID, lokale Revision und ausdrückliches Auftragsziel. Vorschauänderung, gekoppelte Nachbarräume/Wandanker, lokale Prüfung, gruppierte History und identitätstreuer Receipt gehören in eine Transaktion der vorhandenen begrenzten Shadow-DB. Dieselbe fachliche Kopplung erhalten; keine Vollkopie des Atlas-Schemas. Ein fehlendes oder falsches Ziel wird abgewiesen, niemals implizit auf die aktuelle Vorschau/Main umgeleitet. Vorschau-Ack und Fence unterscheiden lokale von kanonischer Revision.
- **Übernahmegrenze:** Main bleibt einziger Besitzer kanonischer Daten. Erst ausdrückliches `graph-accept` übernimmt Vorschauänderungen mit Hüllen-/Positions-/Reiseprüfung und genau einem kanonischen Historyschritt/Receipt in derselben Maintransaktion. Auch direkter `executeGraph(accept)` muss diesen Besitzer verwenden. Vorschau nicht innerhalb des noch offenen äußeren Commits entsorgen; Ablehnung erhält sie. A0.16 sichert den anschließenden Lebenszyklus gegen Prozessverlust.
- **Prüfung / fertig:** Room, Drawing, gekoppelte Änderungen und Preview-Undo/Redo vor/nach Commit mit tatsächlichem Store/Worker/Main/Preload prüfen. Fehler der unmittelbaren Leser sowie späterer Geometrieprüfung dürfen keinen Splitzustand erzeugen. Kanonische Daten/History bleiben bei Vorschauaktionen unverändert. Verlust der Antwort ist mit identischem Previewreceipt rein lesend klärbar; neue Vorschau und Restore können alte Aufträge nicht umleiten. Commitfehler explizit prüfen, keine bloße Unknown-Umklassifikation.
- **Zuweisung / Aufwand:** Ein Agent; SQLite/Graph-/Historykompetenz, geschätzt 3–6 aktive Stunden plus Reserve. Zusätzliche Datei nur nach Eintrag des konkreten Besitzers; UI-Anschluss folgt A0.17.

### A0.16 — Dieselbe Graphvorschau mit Belegen dauerhaft wiederöffnen und sicher abschließen

<!-- atlas-dependencies {"requires":["A0.15","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Eingaben:** Previewidentität, zusammengesetzter Receipt und Acceptgrenze aus A0.15; bestehender expliziter Schutz offener Vorschauen in `canLeaveGraphPreview`.
- **Auftrag und Ergebnis:** Den begrenzten Shadowbestand mit Identität, Basis, Phase, Revision, History und Receipts profilgebunden dauerhaft halten und nach neuem Storeprozess unverändert wiederöffnen. Ordentliches Schließen schließt Handles; Verwerfen erfolgt nur durch adressiertes Restore oder bestätigte Übernahme. Kein bloßes Commandjournal und keine stille Neuanlage anstelle fehlender/beschädigter Vorschau. Main besitzt native Pfade; Renderer erhält keine Dateirechte.
- **Lebenszyklus:** Kleiner validierter Lifecyclevermerk und kanonischer Acceptreceipt müssen denselben Maincommit teilen. Erst danach Vorschau entsorgen. Auch ausdrückliches Restore benötigt einen identitätstreuen Retirementbeleg, der nach Dateilöschung und verlorener Antwort weiterhin lesend klärbar bleibt. Nach Absturz zwischen Commit und Aufräumen lässt sich bestätigte Übernahme oder bestätigtes Restore ohne Replay erkennen. Lifecyclevermerke enthalten nur geprüfte Identitäten/Status, keine frei verwendbaren Dateipfade. Volle Main-Recoverybackups können diese Vermerke enthalten; sie dürfen in einem anderen Profil keinen fremden Previewbestand öffnen oder löschen und gelten allein nicht als Sicherung der zusätzlichen Vorschau. Kampagnen-/Profilbindung, falsche Preview-ID, beschädigte Datei und abweichende Quellbasis sicher behandeln. Archiv/Kopie enthalten keine lokalen Previewpfade; Kampagnenlöschung räumt nur die zugehörige Vorschau auf. Bestehende Archivformate erhalten.
- **Prüfung / fertig:** Frischer Store/Workerprozess liest dieselbe Preview ohne vom Test nachgereichte Identität; Änderungen/History/Receipts und frühere nicht gespeicherte Ausgangsfälle stimmen. Prozessverlust vor/nach Acceptcommit und vor/nach Aufräumen, Restore/Neuanlage, zwei Kampagnen, beschädigte Persistenz sowie Archiv-/Löschgrenzen prüfen. Keine zweite Übernahme und kein stiller Verlust anderer Vorschauen. Native UI-/Schließqualifikation bleibt A0.14.
- **Zuweisung / Aufwand:** Ein Agent; SQLite-/Hostlebenszyklus, geschätzt 2–5 aktive Stunden plus Reserve. Kleine profilgebundene Zuständigkeit statt allgemeinem Speicherumbau.

### A0.17 — Autorenaktionen und Undo/Redo ausdrücklich an die Graphvorschau binden

<!-- atlas-dependencies {"requires":["A0.15","P0.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Eingaben:** Stabiler Ziel-/Receipt-/Lebenszyklusvertrag A0.15; A0.16 implementiert die Wiederöffnung parallel. bestehende Autorenwrapper und Workspace-/Graphkontext.
- **Auftrag und Ergebnis:** Preview-ID und lokale Quellenberechtigung beim Erstellen einer Raum-/Zeichen-/Graphaktion aus ihrem tatsächlichen Workspace erfassen und unverändert durch Wrapper weitergeben. Alle betroffenen Aufrufer (Renderer, Atlas, Graph, Drawing, Keys, Pfade, Volumen, Trigger und Dungeoninhalt) anschließen. Bereits die erste Graphaktion kennt ihre neue Preview-ID vor Dispatch; auch deren verlorene Antwort bleibt eindeutig klärbar. Undo/Redo bedient bei aktiver Vorschau deren gruppierte History, außerhalb den kanonischen Atlas. Ack darf keine erfundene kanonische Revision publizieren. Kamera, Auswahl und Darstellungsfences synchronisieren; keine Änderung während Await auf eine neue Vorschau umlenken.
- **Prüfung / fertig:** Reale Besitzer-/DOMtests mit Vorschauwechsel zwischen Eingabe und Antwort, falscher ID, Restore/Neuanlage, Undo/Redo zusammengesetzter Aktionen und Acceptablehnung. Geschützte Vorschau bleibt sichtbar; keine stillen Writerwiederholungen. Vollständiger Unknown-/Referenzanschluss bleibt A0.07/A0.13, sichere native Schließprobe A0.14. Entsprechende betroffene Typ-/Buildchecks bestehen.
- **Zuweisung / Aufwand:** Ein Agent; TypeScript/Editorbesitzer, geschätzt 2–4 aktive Stunden plus Reserve. Nach stabilem A0.15-Vertrag parallel zu A0.16 an getrennten Codebesitzern möglich; gemeinsame Testasset-Buildfenster koordinieren. A0.09-Endprüfung wartet auf beide, A0.07-Besitzerintegration folgt danach.
