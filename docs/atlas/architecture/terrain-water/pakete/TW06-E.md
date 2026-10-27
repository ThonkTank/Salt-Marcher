# TW06-E — Früher echter Bild- und Ressourcenentscheid

Status: E-R3-Nachkorrektur A/B/C ab 21:52 UTC umgesetzt: vollständige gebundene Indexabdeckung, bestätigtes Alpha 1 und extern vorgegebenes typisiertes Programmpaar. 44 gezielte Logiktests bestanden; A/B/C am26.10.22:12 UTC unabhängig bestätigt und vom Hauptchat lokal übernommen. Keine neue native/compiler/Produktprobe. K3 ist ebenfalls lokal unabhängig akzeptiert; Produktions-E/Q/P/native bleiben gesperrt. Historische E-/C-/U-Ergebnisse und erster R3-Freeze unverändert.
Owner: tw06_hardware_qualification, gpt-6.1-sol/high; E-R3-Harness-/Testbesitzer. Vorbereitung ab 18:41 UTC zählt. E-R3-Start 21:27 UTC und Rahmenende 22:27 UTC unverändert; K3 besitzt Produktedits/-builds.
Last Reviewed: 2026-10-26
Source of Truth: Früher entscheidender Hardwarelauf vor der vollständigen Matrix.

## Unabhängige Korrektur E-R3: echte Erfolgsauswertung

Nach gezielter Planprüfung/Review-Übernahme ab 21:27 UTC umgesetzt; erster
Handoff 21:47 UTC, drei Befunde A/B/C daraus ab 21:52 UTC eng korrigiert.
Die gezielte unabhängige Nachprüfung bestätigt A/B/C; Root übernahm den
lokalen Harnessfix um22:12 UTC. Der bestehende Implementierer
gpt-6.1-sol/high ist angehalten; P-B läuft unabhängig isoliert. Kein nativer Produktionslauf,
keine Compilerprobe und kein P-Produktbuild dadurch freigegeben.

Ergebnis: Das frühe Produktionsgate akzeptiert nur tatsächliche relevante
Feld-Screendraws mit positivem Index-/Geometrieumfang, vollständigem erforderlichem
Batch, intaktem Kontext/fehlerfreiem GL und belegtem sichtbarem Terrainbild.
Link, Arrayanlage, bloße Framezählung oder Existenz einer Screenshotdatei genügen
nicht. Picking-/andere Szenedraws und alte Frames sind keine Terrainbestätigung.
Die geplante neue P-Hardwarefolge bleibt separat gesperrt.

Eingaben: erste eingefrorene E-Probe und ihre `probe.mjs`-Auswertung unter
`.build/terrain-water-e/tw06-e-shader-20261026-1921/`, E-R3 aus dem offenen
Review sowie vorhandene Terrain-LOD-/Pick-/Virtual-Session-Harnessquellen.
Schreiben nur aktuelle zugehörige Harness-/Ergebnislogik und gezielte bestehende
Prüfstellen beziehungsweise kleinste notwendige negative Ergebnisprüfung,
eigener neuer gebundener Belegordner und dieses E-Paket. Historische Belege
unverändert, keine Field-/Surface-/Workerproduktedits oder Bibliothekspatches.

Synthetische beziehungsweise vorhandene negative Ergebnisfälle müssen negativ
bleiben: null relevante Draws, leerer Indexumfang/Teilbatch, GL-Fehler,
Kontextverlust und fehlender tatsächlicher Terrainbildbeleg. Vollständiger
positiver Datensatz prüft die erlaubte Erfolgsentscheidung, behauptet aber
keine neue native Abnahme. Keine zusätzliche allgemeine Testsuite.

Der Implementierer besitzt Änderung, gezielte Prüfung und Handoff; Root
wiederholt keine Diagnose. Neue Harnessversion, Diff, Eingangs-/Ergebnisbindung
und Prüflogs sichern, dann gezielte unabhängige Nachprüfung im offenen Review.
Keine parallele Überschreibung gemeinsamer Buildassets: diese Korrektur nutzt
isolierte/gezielte Ergebnisprüfungen, ein nötiger gemeinsamer Build wäre vorher
mit dem K3-Besitzer seriell abzustimmen.

Aufwandshypothese30–45 min aktiv, erster Rahmen60 min Kalender ab Auftrag für
gebundenes Ergebnis oder konkreten Rootentscheid. Bekannte enge Auswertung und
vorhandene Negativbelege begründen den Rahmen; keine automatische Verlängerung.
Drei erfolglose hypothesengeleitete Korrekturen stoppen weitere Fixes;
ursprüngliche E-/TW06-Zeit und Problemgeschichte bleiben erhalten.

### E-R3-Ergebnis und Nachprüfung (26.10.2026 21:27–21:47 UTC)

`tools/terrain-water-field-gate.mjs` bewertet vollständige aktuelle Feldbatches
und beobachtet tatsächliche Model-/GL-Dispatches unabhängig vom bisherigen
Erfolgscallback. Erforderlich sind alle nichtleeren indizierten Partitionen,
positive Instanzen, exakter Indexoffset, Screenframebuffer, inaktives Picking,
Feldprogramm, intakter Kontext und GL_ERROR 0. Generation/Revision/Inhalt,
Float32-Alpha aus Shaderinputs, Feld/Geometrie/Tabellen und frischer Snapshot
müssen übereinstimmen. Null-Draws, alte Frames und Teilbatches bleiben negativ.

Die eng abgeleitete aktuelle Probe liegt unter
`.build/terrain-water-e/tw06-e-r3-20261026-2127/probe.mjs` und ruft die Auswertung
tatsächlich auf. Erfolg folgt ausschließlich deren `pass`, nicht fünf Samples,
Arraybelegung oder Framezählung. Für das Bild stoppt sie den Deck-Loop nach
einem frischen kompletten Batch und bindet PNG-Bytes/SHA/Frameidentität.
Ohne direkte bild- und framegebundene Beurteilung sichtbaren Terrains kein Pass.
Die Offline-Neubewertung mit `node tools/terrain-water-field-gate.mjs
gate-evidence.json visual-review.json` startet kein Electron und verändert
keine ursprünglichen Ergebnisdateien. Historische Proben bleiben unangetastet.

30 gezielte Tests in `tests/terrain-water-field-gate.test.mjs` bestehen,
einschließlich vollständigem synthetischem Positivfall, Model-/GL-Verkabelung,
historischem Erfolgsformat und Null-/Teil-/Fehler-/Kontext-/Altbild-/fehlenden
Bildfällen. Die echte erste negative E-Datei bleibt bei Offlinebewertung
negativ. Synthetisches PNG und Positivfall sind ausdrücklich reine Logikbelege,
keine neue native Terrainabnahme. Test am bestehenden TW06-Katalogablauf
verlinkt und mit `--geprueft` für diesen begrenzten Prüfumfang erfasst.

Gebundener Handoff mit Fixdiffs, Quellkopien, TAP-Log und Eingangs-/Ergebnisdaten:
`.build/terrain-water-e/tw06-e-r3-20261026-2127/`, 14 geprüfte Dateien,
Manifest-SHA256
`7f37ef3f13b59b804da5f37c660f1d6d2763ba3bd043b1f160e96d2b67d2dab2`.
Ein Implementierungsversuch, null erfolglose Korrekturen. Keine native,
Compiler- oder Produktprobe, kein Produktbuild, keine Field-/Surface-/Worker-
oder Bibliotheksänderung. K3 besitzt seine unabhängige Produktkorrektur und
Builds. E-R3 ist zur gezielten unabhängigen Nachprüfung bereit; tatsächliche
Beobachtung am künftigen K3/P-Runtime und reale Bildbeurteilung bleiben offen.
Produktions-E/Q/P/native starten dadurch nicht.

### E-R3-Nachkorrektur A/B/C (26.10.2026 21:52–22:07 UTC)

Die Nachprüfung des ersten R3-Handoffs verlangte drei enge Ergänzungen;
dessen Freeze bleibt erhalten und ist keine abgeschlossene Freigabe.
Die neue Auswertung bindet eine gemeinsame volle Indexkapazität an den Frame
und verlangt geordnete, lückenlose, überschneidungsfreie Abdeckung bis genau
dorthin. Eine zugleich gekürzte Erwartungs- und Drawliste genügt nicht.
Dieses bestätigte Endframegate verlangt ausdrücklich Alpha 1; konsistente
Alpha-0-/0,5-Daten mit `complete=true` bleiben negativ.

Der Beobachter verbindet CURRENT_PROGRAM nun mit tatsächlich typisierten
Shaderobjekten, vor Compile erfassten vollständigen Quellen und dem bei Link
vorliegenden Attachment-Satz. Keine synchronen GL-Status-/Sourceabfragen.
Ein externes erwartetes Programmpaar wird vor Launch aus einer ausdrücklich
übergebenen Datei geladen, einschließlich Kandidaten-ID, voller VS-/FS-Quellen,
Typen/SHA256, Herkunftsmanifest und exakten Runtimehashes. Am GL-Dispatch und
anschließend in Node müssen vollständige Quellen und Programmlinks passen;
gleiche Namensmarker legitimieren keine anderen Quellen. Keine automatische
Erwartung aus dem jeweils beobachteten Programm.

Die neue Probe verlangt `--program-expectation=…`. Zur Offlinebewertung lautet
die aktuelle Signatur `node tools/terrain-water-field-gate.mjs gate-evidence.json
visual-review.json program-expectation.json`. Der Runtime-Owner kann mit dem
Handoff-Helfer `pack-program-expectation.mjs` zwei schon vollständig und
unabhängig assemblierte Kandidatenquellen, den gebauten Runtimeordner und
deren Herkunftsmanifest binden. Der Helfer baut/assembliert keine Shader und
startet kein GL/Electron. Das konkrete historische K4-Beispiel ist ausschließlich
an dessen eingefrorene Quellen/Runtime gebunden; ein geänderter Runtimehash wird
abgelehnt. Für neue K3/P-Quellen ist noch kein vollständiges Inputpaar oder
ausführbarer P-spezifischer Offline-Assemblierungsweg geliefert/implementiert.
Dieser Owner-Anschluss bleibt vor einem späteren Gate offen; dafür wurde keine
zusätzliche native Vorprobe gestartet.

44 gezielte Tests bestehen, einschließlich der konkreten A/B/C-Gegenbeispiele
und vollständigem synthetischem Positivfall. Neue separate Belege/Fixdiffs:
`.build/terrain-water-e/tw06-e-r3-abc-20261026-2152/`, 22 geprüfte Dateien,
Manifest-SHA256
`8dac1ae236b9a29633c864ded371eeec25329da040a59f778e74013dc63fc90e`.
Erster R3-Start 21:27 und Rahmenende 22:27 bleiben unverändert; zweite
Implementierungsiteration nach einer Nachprüfung mit Rückgabe, kein Reset.
Keine neue native/Compiler-/Produktprobe oder Produktbuild; gezielte unabhängige
Nachprüfung inzwischen lokal akzeptiert. Akzeptierte Model-/GL-/Offset-/Instanz-/Framebuffer-/
Picking-/Bildverkabelung beibehalten. Weitere Arbeit angehalten.

## Auftrag

Die korrigierte Quelle, gemeinsame Geometrie, atomare Besitzer und Ränder
zusammen auf UHD620 prüfen. [Ziele/Messvertrag](../../../requirements/terrain-relief.md#ziele-und-abnahme-dieser-etappe)
und [TW06-Vertrag](TW06.md) binden Daten, Bilder und Ressourcen. Genaues
Runtime-/Sourcebinding und tatsächlichen Renderer vor Lauf festhalten.
Private native Sitzung ohne Hostentsperren; keine Änderung globaler Einstellungen.

Vor Allokation wirklichen Gesamtbedarf einschließlich Browser-/Picker-/Resize-
und Alt-/Neu-/Draftspitzen binden. Produktionsshader/Arrays und aufwendigste
Randbedingungen prüfen. Danach ein unverlangsamter Welt–Raum–Welt-Lauf mit
vollständigen Übergangsbildern, tatsächlichem 20-m-Endpunkt und ganzer
Wendepause; keine Einzelschritt-/Nachladegates. G4 visuell am Bild prüfen,
nicht aus erfolgreichem Input oder Raywert ableiten. F1-Formen aus M2 vor/nach
Commit, Zoom und Neigung einschließen. Fehlende sichtbare Details sind Fehler.

K2 liefert zusätzlich einen großen gültigen Partitionsfall mit vielen Draws.
Dessen echte Drawzahl und Kosten für Metadatenuploads/Uniforms je Draw im
Produktionspfad berücksichtigen; ein bestandener Geometrie-/Speichergrenztest
belegt keine ausreichende Bildrate. Synthetische Grenzlast und tatsächlich
vom Stream erreichte Last getrennt ausweisen.

K3 sichert gezeichnete Drafts durch vorab bilanzierte Kopien von Höhe und vier
Materialkanälen. Deren tatsächlichen Kopierumfang und Einfluss auf die erste
sichtbare Pinselreaktion messen; der bestandene Recoverytest ersetzt keinen
Latenzbeleg. Große unveränderte Flächen dürfen dabei nicht als billiger Ersatz
für einen wirklichen Pinselzug gemessen werden.

Beide Terrain-Pickeinstiege, Cursor/Navigation/drawingSurface und sofortige
Geste bei Alpha 0/0,5/1 an geneigten Mischrändern gegen tatsächlich gezeichneten
Snapshot binden. Unberührte Draftflächen, Commit/Undo und Meer erhalten.
Analytische CPU-/Meshbelege, injizierte Events, Chromium und echte OS-Eingabe
getrennt ausweisen; keine erneute falsche OS-Behauptung aus trusted=true.

## Grenzen, Aufwand und Übergabe

Vorbereiteter Einstieg: `tools/terrain-water-virtual-session.mjs` kapselt
private KWin-/DBus-Sitzung und Cleanup; `tools/native-session.mjs` isoliert
Appprofil/Quellbindung. `tools/test-desktop-terrain-water-lod.mjs` mit
`--smoke --no-conditioning` liefert einen kalten kontinuierlichen 100-%-/45°-
Pilot. Vor Lauf `tools/terrain-water-lod-pick.mjs` auf tatsächliches
`field.draftBase`, Snapshot-Geometrie/Tabellen und fünf Draftkanäle umstellen;
keine festen 64er-Slots. Quellenbindung umfasst neue Feld-/Ray-/Grid-/Picker-
Quellen und Buildinfo. Der EIS-Helfer unterstützt bisher nur Tastatur;
OS-Maus/Wheel benötigt einen begrenzten Ausbau im privaten Compositor.
`page.mouse` und Main-`sendInputEvent` bleiben Chromium-Eingaben.

Die echte historische Ohne-Worker-Basis ist der fehlgeschlagene Lauf
`.build/terrain-water-lod/1792988738711-90150/`, mit sieben Quellständen aus
`1792986340510-84839/source-snapshot/src/app/`. Aufbewahrte Bundles liegen in
`.build/terrain-water-handoff/tw06-1792978015615/worker-before-baseline-1792990000/`.
Der Lauf brach nach 90 s vor dem 20-m-Ziel ab und enthält keine verwertbaren
RSS-Ressourcensamples. `--baseline` allein ändert nur das Ergebnislabel.
Als unabhängige Vorarbeit ist eine begrenzte isolierte Rekonstruktion unter `.build`
aus Gitbasis `a2a3c4f`, tatsächlichem `source.diff`, Quellsnapshot und den
eingefrorenen untracked Kamera-/Formquellen zugelassen. Niemals die aktuellen
Produktquellen durch `paired-baseline.mjs` austauschen. Importvollständigkeit
wurde lesend geprüft; damals war nur der isolierte Build freigegeben und
Messung an die spätere K4-Übernahme gebunden. Der aktuelle Header beschreibt
den inzwischen erreichten Freigabe-/Abbruchstand. Historische Bundlehashes
vergleichen, Abweichungen konkret erklären und die neue Laufzeit ehrlich
binden. Wiederholter Timeout braucht einen konkreten Diagnoseentscheid;
kein blindes Retry und kein RSS-Pass ohne vergleichbaren Messlauf.

Schreiben: existierende isolierte LOD-/Pick-/Virtual-Session-Proben und
gezielte Diagnoseinstrumentierung im bereits freigegebenen Terrainbereich,
eigener Ergebnisabschnitt/Belegordner. Ein begrenzter reproduzierbarer Fehler
kann nach Hauptchatzuordnung im betroffenen K-Bereich korrigiert werden;
Grundlagenzweifel sofort reviewed, keine offene Fixserie. Keine anderen
Kampagnen/Automationen, keine komplette Matrix vor positivem frühen Gate.

Vorläufig 1–2 aktive Stunden plus 0,5–1 h exklusive Maschinenzeit. Nach erster
vollständiger Fahrt Ergebnis/Rest bewerten; vierstündige TW06-Kontrolle bleibt.
Erfolg bedeutet nur diesen gebundenen frühen Bild-/Ressourcenentscheid, keine
vollständige Q-/G5-Abnahme. Negative Bilder oder ungezählte Ressourcen konkret
belegen; vollständige Matrix wartet. Normales Prozessende und Bereinigung
prüfen, keine fehlenden Messdaten zu Nullwerten machen.

## Isolierter historischer Baselineaufbau (26.10.2026)

Gesondert freigegebener Aufbau ab 18:59 UTC unter
`.build/terrain-water-e/tw06-e-baseline-20261026-185933/`;
`baseline-source/` ist ausschließlich eine temporäre historische Vergleichsquelle.
Gitbasis `a2a3c4f92a66fd28f5d348c5eaab3a04fcaa8c99`, tatsächlicher alter
Vergleichsversuch `1792988738711-90150`, dessen Diff/Quellsnapshot und die
benötigten älteren untracked Quellen sind erhalten. `source-manifest.json`
bindet 2.101 rekonstruierte Dateien einschließlich Paket-/Lockdatei; `inputs/`
bewahrt Originalpaket, Quellen und historische Bundles.

Erster Vollbuild mit Node 22.22.0 endet mit Exit 1: Der damals unbenutzte
Darstellungsworker importiert `completeAtlasTerrainModels` und
`withAtlasTerrainAllocationBudget`, die im eingefrorenen synchronen
Terrainmodell fehlen. Der ursprüngliche paired-Helfer baute nur Renderer und
Deck neu und behielt das vorhandene Workerasset. `build.log` und
`build-result.json` bewahren diesen ersten fehlgeschlagenen Vollbuild und
seine 75 bis dahin erzeugten Laufzeitdateien.

Nach ausdrücklicher Hauptchatzuordnung ist der ursprüngliche Zwei-Bundle-Weg
einmal isoliert nachgestellt: `build-two-bundles.log` meldet Exit 0;
gewöhnliche Settings-/Font-/HTML-/CSS-Mittel aus der historischen Quelle
sind anschließend vollständig ergänzt. `runtime-manifest.json` bindet alle
89 Laufzeitdateien einschließlich Main/Preload/Assets, Paket-/Lockhashes,
Electron und SQLite-Nativmodul. Alle 2.101 rekonstruierten Quelldateien
blieben hashgleich. Einstieg ist
`baseline-source/.build/desktop/main.cjs` ausschließlich unter diesem
Baselineverzeichnis; der gemeinsame `.build/desktop` wurde nicht beschrieben.

Die neuen Renderer-/Deckbundlehashes unterscheiden sich ausschließlich durch
den isolationsbedingten Abhängigkeitspfad `../../../../node_modules/` statt
`node_modules/`. Reine Vergleichsnormalisierung ergibt exakt die historischen
Hashes `5f516127add507ebcd3adfceec73d9baa9579cbc608dfe5ebd19b1aafd9298c7`
und `2632aa677ceb1a667b8a01911d8a2941c41facf7ef9a662df7c06d1fe51177a4`.
Die tatsächlich erzeugten Bundles bleiben unverändert und haben eigene
gebundene Hashes; `bundle-comparison.json` belegt die vollständige Differenz.
Das unbenutzte Workerasset ist unverändert aus dem gegen K3 gebundenen
Runtime-Artefakt mit SHA256
`74e8304e38bfc96c82d118bcd8e7b13d307454443524b325d12fd4f610f5b9b7`
übernommen; `unused-worker-origin.json` nennt Herkunft und die Abweichung
zum historischen unbenutzten Asset. Keine Baseline-Produktlogik wurde ergänzt.

`build-completion.json` meldet vollständigen isolierten Buildbestand mit
offener nativer Prüfung. Die synchrone `AtlasRasterPresentation.show()`-
Modellbildung ist erhalten; Renderer/Deck enthalten keinen Verweis auf den
Terrainmodell-Worker. Der spätere Vergleich muss dessen tatsächliche
Nichtbenutzung gesondert nachweisen. Während dieses damaligen Baselineaufbaus
wurden keine Produktquelle oder native Sitzung geändert beziehungsweise
ausgeführt. Die anschließende E-Freigabe und ihr Ergebnis stehen im aktuellen
Status und folgenden Abschnitt. Es gibt noch keinen Baseline-Ausführungs-/RSS-Pass.
Die temporäre Quellkopie nach dem späteren E-Vergleich bereinigen, gebundene
Originale/Ergebnisbelege erhalten. RSS und E bleiben offen.

## Früher Geräteentscheid (26.10.2026)

Einzige native Probe 19:23:27.896–19:24:02.874 UTC, unveränderte übernommene
K4-Laufzeit; keine Produktkorrektur und kein Retry. Belegordner
`.build/terrain-water-e/tw06-e-shader-20261026-1921/`, Manifest-SHA256
`8b126e5bbef3a31eca378353ca0955e7f2529d63ac64f2f77a580075f319792b`.
`handoff.json`, `shader-manifest.json`, eingefrorene Quellen/Runtime,
`draw-instrumentation-reach.json`, Bild und Sitzungsbelege sind gebunden.

Schon vier Startquellen mit vier geplanten Draws scheitern am vollständigen
Produktionsprogramm `atlas-terrain-field:1`. Der beobachtete Block aus
`linkProgram` und synchronen Status-/Quellabfragen dauert **25.405,4 ms**;
Compile-, Link- und GPU-Zeit sind nicht einzeln getrennt. Danach
`CONTEXT_LOST_WEBGL`, fehlgeschlagener Linkstatus und leere Shaderlogs.
Die vollständigen tatsächlich an den Linkversuch übergebenen Vertex-/
Fragmentquellen sind gesichert. Statusabfragen nach Kontextverlust liefern
false/0; das beweist keinen GLSL-Syntaxfehler. Das direkt beurteilte
`failure.png` zeigt eine leere Terrainfläche, Shaderfehler und verlorene
Zeichenfläche. Kein gültiger Produktionsdraw oder Bildpass.

Die beiden vor Appinitialisierung überwachten Aufrufe `drawElements` und
`drawElementsInstanced` zählen **null**. Der Produktionsfeldpfad besitzt einen
Indexbuffer und `isInstanced:true`; der eingefrorene Luma-Pfad würde deshalb
`drawElementsInstanced` verwenden, kehrt bei nicht erfolgreichem Pipeline-Link
aber vorher mit false zurück. Nicht überwacht sind Arrays-/Extensiondraws.
Trotzdem veröffentlichte AfterRender content 1 / Alpha 1 als Feldsnapshot;
Callback-/Statusbestätigung ist hier nachweislich kein GL- oder Bildnachweis.

Alle fünf realen 128-Layer-Arrays und die aktuellen 128×25-RGBA32F-/
64×256-R8UI-Tabellen wurden angelegt. Die erste Phasenrechnung aus tatsächlichen
Vorprüfungsdeskriptoren ergibt 297.420.526 B einschließlich konservativem
Browsermodell; keine Resize-/Alt-Neu-/Draftspitze oder Gesamt-GPU-Messung.
Kontextattribute waren vor Verlust nicht separat gesichert und sind danach
null. Der GPU-Prozess 218598 meldet maximal **5.175.472 KiB Peak Working Set
(4,9357 GiB Prozess-RAM)**, anschließend erscheint GPU-PID 218745.
Rendererprozess-RAM, GPU-Prozess-RAM und Grafikressourcen bleiben getrennt;
die historische RSS-Basis wurde nicht ausgeführt. Kerneljournal im Zeitfenster
ohne Einträge; kein gesicherter Crash-/Resetgrund. Privater KWin bindet
UHD620/Mesa 26.2.3/EGL und 1920×1080. Der Vor-Verlust-WebGL-Rendererstring
wurde nicht separat gesichert; nach Verlust ist er null.

App regulär mit Exit 0 geschlossen, eigene Profile und private Runtime
entfernt, alle erfassten eigenen PIDs abwesend. Der Prüfauftrag und private
Sitzungswrapper enden wegen des fachlichen Fehlschlags mit Exit 1; dies ist
kein erfolgreicher Sitzungsnachweis. Hostsperre vorher/nachher true.
Dies war der Übergabestatus des eingefrorenen ersten Handoffs: weitere native
Proben, Harnessausbau und Q angehalten, unabhängige Prüfung vorgesehen.
Danach war seit 19:43 UTC ausschließlich C00→C10→C01 nach
[begrenzter Nachplanung](../plan.md#begrenzte-nachplanung-nach-negativem-e-gate)
freigegeben; diese Diagnose endete am negativen C10 wie unten belegt.
Produktions-E/Q und Produktfixes bleiben gesperrt.

## Isolierte Compilerdiagnose (26.10.2026 19:49 UTC)

Belege: `.build/terrain-water-e/tw06-e-compiler-20261026-1943/`.
Manifest: 45 Dateien, SHA256
`fadf1a2a9885c6ec3ba6307a1fbb6288233c593164f9241400f7e45f975995c0`;
Quellen-/Runtimekopien und Manifesthashes geprüft.
Die vollständigen Shaderhälften sind bytegleich zum eingefrorenen ersten
Handoff (VS `fa9eba57…bfd56`, FS `02d09b57…e7ba8`). Leichte Hälften
behalten Bibliotheksprologe, Defines, Deklarationen und Bindings; der leichte
Fragmentshader verarbeitet alle vier Feldvaryings mit tatsächlichen
Beiträgen. Der leichte Vertexshader liefert Weltkoordinaten aus `terrainLocal`
und Slots aus `terrainSlots`. Kontrollen und Herkunft sind vor Compile in
`precompile-bindings.json` gebunden, Präfixgleichheit und Quellen in
`source-validation.json` geprüft. Keine Produktquelle oder Laufzeit geändert.

Der Produktions-Luma-Kontext stammt aus einer leeren `AtlasDeckSurface` mit
normalem AA/DPR: ANGLE / Mesa Intel UHD Graphics 620 (WHL GT2), WebGL2,
KHR_parallel_shader_compile, Antialiasing und preserveDrawingBuffer true,
DPR 1. Attribute, Extensions und Limits wurden vor jedem ersten Compile
gesichert. Kein Terrainmodell, keine Terrainarrays, Terrainuploads oder
Drawlast. C00 bestätigt zwei Compileaufrufe und null Arrayallokationen,
Uploads und Draws. ShaderSource-/Attachdaten liegen vor Compile in JS;
Completionwarten erfolgt vor Compile-/Linkstatus und Logs.

C00 (leicht/leicht) ist positiv: Vertex-/Fragmentsubmit 0,1/0 ms,
Linksubmit 0,7 ms, KHR-Warten 70,8 ms / sieben Polls, Statusabfragen 1,0 ms,
Gesamt 92,0 ms; externer Beobachtungsabschnitt 110,7 ms. Beide Compile- und
Linkstatus true, Kontext intakt, GL-Fehler 0, GPU-PID 223618 unverändert.
Der erhaltene Intel-Bibliotheksprolog meldet zwei Divide-by-zero-Warnungen
bei Constant Folding; kein Compilefehler. Attribute terrainLocal und
terrainSlots sind aktiv. GPU-RSS-Basis 145.481.728 B, maximal 155.680.768 B.

C10 (bytegleicher Voll-VS / leichter FS) submitierte beide Compileaufrufe und
Link in jeweils gemessenen 0 ms. Während KHR-Completionwarten stieg der
GPU-Prozess-RSS von 151.846.912 B auf 1.239.773.184 B. Die externe Wache
erkannte nach 2.302,7 ms die Grenze 1.225.588.736 B (= Basis + 1 GiB;
früher als 2 GiB absolut oder acht Sekunden). 43 Stichproben, maximaler
Abstand 56 ms; letzte GPU-PID weiterhin 223618. Der erste Grenzsample liegt
14.184.448 B über der Schwelle. Die Wache stoppte die ganze Reihe;
C01/C11 wurden nicht gestartet. Nach Grenzabbruch wurden keine blockierenden
Status-/Logabfragen nachgeschoben. Nach dem Grenzsignal wird kein weiterer
RAM-Maximalwert oder hart eingehaltenes Speichermaximum behauptet.
Kein stabiler Compilefalse-/Syntaxbeleg,
kein abgeschlossener Link und keine endgültige Kontextstatusbehauptung.

Der vollständige VS ist damit unter diesen Bedingungen ein hinreichender
Trigger für den RAM-Anstieg auch mit leichtem FS und ohne Terrainressourcen.
Treiber-/Compilerursache und genaue Unterfunktion bleiben offen; die volle
Fragmenthälfte ist ungeprüft. E-R1/R2-Drawbestätigung und E-R3-Auswertung
bleiben getrennt offen. Die alten 25,405 s sind weiterhin ein kombinierter
Block aus Link und synchronen Status-/Quellenabfragen des alten Observers,
keine isolierte Compile- oder GPU-Zeit. Keine Produktperformance-/Bildfreigabe.

`result.json` bewahrt die vor vollständigem Teardown gesampelten Cleanupwerte.
`cleanup-confirmed.json` bestätigt anschließend alle eigenen PIDs abwesend,
privaten Runtimeordner und Profil entfernt. Das Profil wurde nach verspätetem
Schreiben des auslaufenden Prozesses erneut ausschließlich am eigenen Pfad
entfernt. App-Normalexit wurde beim Grenzabbruch nicht erfasst und wird nicht
behauptet; privater Befehls-/Compositorwrapper endete 0, Hostsperre blieb
vorher/nachher true. Keine erneute Ausführung, keine Produktkorrektur.

Der Auftrag ab 20:01 UTC umfasste ausschließlich einen isolierten Kandidaten mit
den zwei freigegebenen Uniform-Funktionskörpern, U10→nur bei Pass U11 nach
[begrenzter Nachplanung](../plan.md#begrenzte-nachplanung-nach-negativem-e-gate).
Er ist wie nachfolgend belegt negativ beendet. Keine Produktintegration,
kein Produktions-E-/Q-Wiederanlauf; ursprüngliche E-Zeit bleibt bestehen.

## Isolierter Uniform-Kandidat (26.10.2026 20:01–20:05 UTC)

Belege: `.build/terrain-water-e/tw06-e-uniform-20261026-2001/`;
Manifest 44 Dateien, SHA256
`dccc1b23504a526f743354b66e57e0d8f2a59cb866c862093a2868a43c566860`.
Alle Hashes und 13 Runtimekopien geprüft; alte eingefrorene Handoffs unverändert.
`candidate.diff` und `candidate-validation.json` belegen maschinell genau die
zwei erlaubten Funktionskörperänderungen. `fieldAxis` übernimmt den originalen
Uniformzweig byteinhaltlich einschließlich getrennter Endpunkte, näherem Ende,
Divisionsreihenfolge und Clamp; `fieldAxisStep` liefert direkt den Metadaten-
Schritt. Übriger VS sowie voller und leichter FS sind unverändert.
Kandidaten-VS SHA256
`89772078df07b901de1986b771a4332eb39091798b1a65c7dd81005cac5d56d7`.

U10 (spezialisierter voller VS / gebundener leichter FS) ist negativ.
Vertex-/Fragmentsubmit 0,1/0 ms, Linksubmit 0,8 ms; während KHR-Completionwarten
erreichte GPU-PID 225657 nach 2.358,9 ms den ersten RSS-Grenzsample:
1.234.878.464 B bei Basis 145.588.224 B und Schwelle 1.219.330.048 B
(Basis + 1 GiB, früher als 2 GiB absolut/acht Sekunden). 44 externe Samples,
höchstens 57 ms Abstand; PID unverändert. Der erkannte Sample liegt
15.548.416 B über der Schwelle. Nach Abbruch kein weiterer RAM-Maximalwert
oder hart eingehaltenes Maximum behauptet. Completion und LINK_STATUS wurden
nicht erreicht/abgefragt; kein Syntax-/Compilefalse-Beleg. U11 nicht gestartet,
keine Wiederholung und keine zusätzliche Shaderoptimierung.

Der akzeptierte externe Wachen- und Browser-Submit/Completion/Statuscode ist
bytegleich übernommen. Kontextattribute, UHD620-Renderer, Extensions, Limits
und DPR stimmen mit der vorherigen Diagnose überein; vor Compile gesichert.
Vor Submit null Arrayallokationen, Uploads und Draws; danach ausschließlich
frische Shader-/Programmobjekte. Mögliche Compiler-/Diskcachewärme ist nicht
kontrolliert; kein Kaltstartbeleg. Die Spezialisierung genügt unter diesen
Bedingungen gegen den Trigger nicht. Volle Fragmenthälfte/Wechselwirkung und
genaue Ursache bleiben offen; keine lokale Fortsetzung vor Root-/Reviewentscheid.

Cleanup wie separat belegt: eigene App-/GPU-/Compositor-/Befehls-PIDs abwesend,
eigenes Profil nach verspätetem Schreiben erneut entfernt, private Runtime
entfernt; Hostsperre true→true. App-Normalexit beim Grenzabbruch nicht erfasst,
privater Befehls-/Compositorwrapper Exit 0. Keine Produktquelle/-laufzeit
geändert, kein Produktbuild, Bild-/Performance-/Produktpass. Historie bleibt
eine Produktprobe, null Produktkorrekturen/Retry, zwei frühere Kontrollen;
neu ein isolierter Quellkandidat mit einer ausgeführten Compilerprüfung.
E-R1/R2/R3 und K3 bleiben unangetastet. Weiterarbeit angehalten.

Auftrag ab 20:16 UTC: genau einmal C01 nach
[einzelner Fragmentkontrolle](../plan.md#einzelne-fragmentkontrolle-c01-vor-festlegung-des-umbauumfangs).
Wie nachfolgend belegt positiv beendet. Kein Retry, kein weiterer Kandidat
oder Produktumbau; nach Ergebnis angehalten.

## Einzelne Fragmentkontrolle C01 (26.10.2026 20:16–20:19 UTC)

Belege: `.build/terrain-water-e/tw06-e-fragment-20261026-2016/`;
Manifest 40 Dateien, SHA256
`fee90f8c5afab64f4a4c06a0cebb099ec5a0aaf2f5120e474e4938c05c661c2e`.
Alle Hashes und 13 Runtimekopien geprüft. Tatsächlich eingereichte Quellen
stimmen mit den gebundenen Eingaben überein: leichter VS `41810be0…248af`,
voller FS `02d09b57…e7ba8`. Keine Shaderquelle verändert. Externe Wache und
Browser-Submit/KHR-Completion/Statuscode sind bytegleich zur akzeptierten
C-Diagnose; nur zusätzliche Passbedingungen für beide Compile-Status und
GL_ERROR sowie die nachfolgende Samplerinventur ergänzt.

Genau ein C01 ist positiv: beide COMPILE_STATUS und LINK_STATUS true,
Kontext intakt, GL_ERROR 0, GPU-PID 227977 in allen Samples unverändert.
Vertex-/Fragmentsubmit 0,1/0 ms, Linksubmit 0,7 ms, KHR-Warten 494,9 ms bei
49 Polls, Statusabfragen 1,1 ms, Gesamt 517,1 ms; externe Beobachtung 536,9 ms.
GPU-Prozess-RSS-Basis 145.604.608 B, Samplemaximum 166.318.080 B bei Schwelle
1.219.346.432 B. Elf Samples, maximal 57 ms Abstand; kein Grenzsignal.
Dies ist Prozess-RAM, kein VRAM oder hartes Peakmaximum.

Nach erfolgreichem Link fünf aktive Sampler, jeweils Anzahl eins:
`atlasFieldMeta` als SAMPLER_2D; `atlasFieldBase`, `atlasFieldMasks`,
`atlasFieldCover`, `atlasFieldRelief` als SAMPLER_2D_ARRAY.
`atlasFieldEdgeOwners` ist regulär nicht aktiv; Quelle unverändert gelassen.
Die 384 FS-Abfragen bleiben eine Quellcodeobergrenze, keine gemessene Drawlast.
Vor-Compile-Umgebung stimmt in Kontextattributen, ANGLE/Mesa-UHD620-Renderer,
Extensions, Limits und DPR mit der gebundenen C-Diagnose überein.
Audit: zwei Compileaufrufe, null Terrainarrayallokationen, Uploads, Draws
und Kontextverluste. Frische Shader-/Programmobjekte; Compiler-/Diskcachewärme
unkontrolliert, kein Kaltstartpass.

Materialhälfte kann damit zunächst erhalten bleiben. Zusammenspiel mit einem
neuen tatsächlichen VS, Drawkosten und Bildqualität brauchen ein späteres
repräsentatives Gate. Kein Produktions-/Bild-/Performancepass, keine weitere
Probe oder Produktänderung. App regulär Exit 0/null, private Befehls-/Compositor-
wrapper ebenfalls 0/null; alle eigenen PIDs, Profil und private Runtime weg,
Hostsperre true→true. E-R1/R2/R3, K3 und Produktions-E/Q bleiben offen.
Historie bleibt erhalten; neu genau eine Fragmentkontrolle, null Retry.
Weiterarbeit wartet auf Root-/Reviewentscheid.
