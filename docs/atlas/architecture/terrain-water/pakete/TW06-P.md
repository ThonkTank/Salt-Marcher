# TW06-P — Vorbereitete Höhen und Gradienten bis zum echten Pinselbild

Status: A–D samt gezielten Fixnachprüfungen und gemeinsamen seriellen Builds lokal unabhängig akzeptiert. E/F-Anschluss und früher integrierter P/E-Nachweis offen; nächste Folgeentscheidung im Plan. K3 und E-R3 lokal unabhängig akzeptiert.
Owner: tw06_boundary_implementation, gpt-6.1-sol/high; K3-Korrektur und native Probe besitzen ihre bestehenden Implementierer.
Last Reviewed: 2026-10-27
Source of Truth: Daten-/Job-/Lebensdauervertrag, Umsetzung und früher Entscheid des begrenzten Worker/VS/Draft-Durchstichs.

## Ergebnis, Eingaben und Grenzen

Genau ein zusammenhängender Durchstich bereitet Höhen und rohe physische
Gradienten im vorhandenen Darstellungsworker vor und zeichnet sie mit einem
einfachen Vertexshader. Er umfasst kanonische Quellen, Übergänge und den echten
ersten sowie weitere kumulative Pinsel-Drafts. Die vorhandene Fragmenthälfte
bleibt zunächst bestehen. Kein neuer Renderer, zusätzlicher Worker, Material-
Vorberechnung, Änderung der Formregeln, Kamera oder Rechte. Der vorhandene Formkern wird für unterbrechbare Berechnung geöffnet; die Speichergrenze erhält nur begrenzte Höhenreads und sichere Checkpointanbindung.

Die verbindlichen [Produktziele und Messbedingungen](../../../requirements/terrain-relief.md#ziele-und-abnahme-dieser-etappe)
bleiben vollständig. Der technische Ansatz ist eine begründete Hypothese,
keine bestandene Hardware- oder Produktabnahme. Die bewusst einfachere
Schattierung ist keine behauptete mathematische Gleichheit zum alten K4-Shader.

Eingaben: [K1](TW06-K1.md), [K2](TW06-K2.md), [K3-Nachkorrektur](TW06-K3.md#gezielte-k3-nachkorrektur-aus-e-echter-screenframe),
[K4](TW06-K4.md) und gebundene [E/C/U/C01-Belege](TW06-E.md).
Review `01a179b3-ced4-7dd2-bd61-16dd07fd0bc5` liefert die unabhängige
Architekturentscheidung. C01 hat nur den unveränderten vollen FS mit leichtem VS
qualifiziert; das tatsächliche neue Paar muss früh mit Produktionsressourcen
linken und zeichnen. Keine Wiederholung alter Compilerkontrollen.

Relevante Besitzer: `atlas-terrain-field-presentation.ts`,
`atlas-terrain-tile-model.ts`, `atlas-terrain-model-worker.ts`,
`atlas-terrain-model-client.ts`, `atlas-raster-presentation.ts`,
`atlas-deck-surface.ts`, `atlas-mesh-ray.ts`, `atlas-surface-draft.ts` sowie
ihre bestehenden Feld-/Surface-/Worker-/Ray-/LOD-Tests. Bereits freigegebene
Terrainbereiche aus [TW06](TW06.md#auftrag-eingaben-und-grenzen) gelten.
Keine Bibliothekspatches oder Änderungen fremder Hunks. Ein Implementierer
besitzt Diagnose/Umsetzung/Tests; gemeinsamer Feld-/Surfacecode wird seriell
mit K3 geändert. Der Hauptchat allein pflegt gemeinsamen Plan und TW06.

## Produktabschnitte nach übernommenem P-B

P-B ist als Entscheidungsgrundlage akzeptiert, kein implementierter Autorenbesitzer,
Leistungs- oder universeller Etatpass. Seine unveränderten Belege stehen in
[P-B](TW06-P-B.md). Keine weitere isolierte Untersuchung oder vierte12-B-Variante.
Der folgende Ablauf ist die konkrete Zerlegung des bestehenden P; dessen Start
26.10.20:26 bleibt. Die aktuelle gemeinsame Fortsetzung und ihre Begründung stehen im [Plan](../plan.md#nächster-integrierter-produktnachweis).

### A — Atomarer Autorenstand und begrenzter Checkpoint

**Lokal unabhängig akzeptiertes Ergebnis**, gezielte Nachprüfung der Besitzer-/Readkorrekturen abgeschlossen; A-bezogene P-B-Befunde geschlossen. Start26.10.22:49, Abschluss23:30:30 UTC,41min30. Handoff `.build/terrain-water-p/tw06-p-product-a-20261026/HANDOFF.md`; Manifest SHA256 `5bb4f5736171f6754da1e1ab0a042f7245d404a4791354be063653d5845b77ae`. Root prüfte566Dateien/59.089.781B und353Livequellen ohne Drift sowie tatsächlichen Besitzer-/SQL-/Queue-/Testanschluss.58/58 Tests, beide Typchecks und Desktopbuild grün. Produktiver Autorenkern samt Asynccheckpoint, aktive33/Escape97/Unknown und Höhenprojektion lokal belegt; keine Raster-/GPU-/Latenzabnahme. Geschlossener Anschlussfehler: direkter readonly Snapshot umgeht allgemeinen Sync ohne dessen Cursorfortschritt; Folgeread-Regression positiv. Keine offenen lokalen Versuche. A-Dateien bleiben für B stabil.32Lattices in A haben gleicheKoordinaten, kein räumlicherMaxlast-/W774-Leistungsbeleg. Editserienlebensdauer ist keine Neustartpersistenz. A nutzt Objekt-DTO; alte gepackteSeedzahl ist keine aktuelle exakteWiregröße.
Owner `tw06_boundary_implementation`, tatsächlich gpt-6.1-sol/high; Kompetenz:
TypeScript-Besitzer-/Queuezustände, Node-Worker, SQLite und bestehender Formkern.
Aufwandshypothese60–90min, vertretbarer erster Rahmen **90min Kalender ab Auftrag**,
Zwischenstand45min. Der begrenzte Nutzen ist ein produktiver, unabhängig vom
Grafikformat prüfbarer Autorenkern. Ablauf endet mit gebundenem Teilstand und
Entscheid; kein automatischer Nachschlag bei unvollständiger Integration.

Ergebnis: Ein dauerhafter Besitzer installiert Ground, aktive Bandbasis,
unveränderlichen akzeptierten Suffix und dieselbe aktive Geste atomar. Er nutzt
kanonische Checkpoints aus der vorhandenen seriellen Schreibqueue unabhängig
von Screen/Settle/Bildübernahme. Präfixdaten erst nach vollständig gültigem
Read und Replay freigeben. Besitzer, Serie, Quelle und Revision **nach jedem await**
erneut prüfen; alte Ergebnisse ersetzen keinen neuen Autorenstand. Async-Replay
ist invalidierbar und anschließbar an Abschnitt C, kein zweiter Besitzer.

Schreibbereich: `src/app/terrain-stroke-queue.ts`, `terrain-brush-draft.ts`,
`atlas-surface-draft.ts`, enges neues Autorenbesitzermodul falls nötig;
`desktop/atlas-region.ts`, `desktop/atlas-region-worker.ts`, zugehöriger
`src/app/atlas-region-contracts.ts` und bestehende fachliche Tests. Nur notwendiger
typisierter Anschluss in vorhandener Main-/Preload-/Bridgegrenze; keine neue
Rendererberechtigung. Konkret übernommene zusätzliche Pfade: `desktop/atlas-worker-contract.ts`,
eng `desktop/main.ts`/`desktop/preload.ts`, readonly
`src/app/storage/terrain-author-window.ts`, `src/app/terrain-author-state.ts`
und `src/app/terrain-author-checkpoint.ts`. Vorhandene Main-Hunks erhalten;
kein zweiter Besitzer. Weitere zusätzliche Pfade vor Änderung melden. Raster- und
Surfaceintegration gehören D/E; A muss eine echte verwendbare Produktschnittstelle
statt einer weiteren isolierten Probe liefern. Kanonischer Writer/Receipt und
Formregeln bleiben unverändert. Root besitzt dieses Dokument und den Plan;
Implementierer führt Belege unter `.build/terrain-water-p/` und meldet Status.

SQL projiziert für Seiten und Ground ausschließlich benötigte Höhenfelder und
Revisionen. Keine vollständigen Namen/Geometrie-/Metadatenstrings in JS laden.
Numerische Querygrenzen, höchstens32 gebundene Lattices, Seiten-/Payloadgrößen
**vor** Allokation prüfen. Das vorhandene rechteckige256-Seiten-Boxgate vor dem
Read anwenden; nicht aus changedPages ableiten. Benutzerdaten nicht kürzen.

Prüfung am echten neuen Besitzer: feste96-Write-/Checkpointfolge ohne Bildübernahme;
32 geschlossene Gesten plus laufende33 mit **gleicher Identität** durch einen
Checkpoint hindurch, Fortsetzen und genau einmal Schließen; echte Escape97
stellt den vorherigen Autorenstand wieder her. Owner-/Serien-/Quellenwechsel
während verzögerter Reads und Replay, Close/Escape während await, Unknown48 mit
bereits akzeptierter49 und ohne automatisches Replay/Freigeben. Smooth/Level
mit nichtleerem Ground gezielt prüfen: P-Bs No-op-Paare genügen dafür nicht.
SQL-Projektion gegen vorhandene kanonische Ergebnisse, ungültige Queries und
überzählige Lattices ohne große Allokation. Bestehende passende Tests erweitern,
Typchecks für berührte Eintritte; Builds nur betroffene Pfade. Neue Testlinks
im Capability-Katalog nach Inhalt pflegen. Synchroner Zwischenkern ist ausdrücklich
**kein Reaktionszeitpass** und darf C nicht als ununterbrechbarer Gesamtjob übernehmen.

### Übernommener enger A/B-Fix aus unabhängiger B-Nachprüfung

R1–R4 sind nach gezielter unabhängiger Nachprüfung geschlossen. Start27.10.00:20,
Handoff00:29:59 (9min59s), Übernahme00:42. Keine negativen Fixhypothesen.
Handoff `.build/terrain-water-p/tw06-p-ab-fix-20261027/HANDOFF.md`; Manifest
SHA256 `92e08c891c2fe8949187fdb6e05336f22510437e2ae327e7598278d4d914f212`.
Root und Reviewer prüften356Artefakte/13.452.520B und325Livequellen ohne Drift.
33 betroffene Tests, zwei gezielte echte Store-/Workerfolgen und Typcheck grün;
keine zusätzliche pauschale A-Vollsuite und kein nativer Pass.

- R1: Abortsignalgebundener Kapazitätswaiter wird bei Escape entfernt; nur die
  konkrete Captureobjektidentität zählt. Zwölf wiederholte volle32Journal-
  Close/Escapefolgen beenden alte Closings vor Freigabe; Originalaktionen bleiben.
- R2: CPU/GLSL wählen beiAlpha1 unmittelbar Draft oder ohneDraft Next. Gegenfall
  49.999.999→0,01 mitOrigin0/0,01 und beiden Gradienten erhält die genaue Paaridentität.
- R3: Resultvalidator bindet Capture-ID, editSeries und draftRevision exakt.
  C muss den beim Dispatch festgehaltenen Kontext übergeben.
- R4: Workeroriginal und ausgehende Kopie zählen getrennt;152.174.848B Backingstores
  plus518.480B numerische Deskriptorinhalte zusätzlich. Transfer detached nur
  Ausgangskopien, Originale bleiben vollständig. C/D übernehmen diese Copy-Policy.

Sieben eigene Fixdateien; übrige A-Dateien und alte Handoffs unverändert. Keine
weitere Fix-/Probenrunde nötig. Offen bleiben Unterbrechbarkeit, realer Anschluss,
Heap-/GPU-Spitzen, Compiler/Readback/Bilder und integrierte Reaktionszeit.

### Weitere vollständige Produktzerlegung

**B gebunden abgeschlossen**:26.10.23:34–27.10.00:13:38 UTC,39min38.
Handoff `.build/terrain-water-p/tw06-p-product-b-20261026/HANDOFF.md`; Manifest
SHA256 `5df560013492fe1f4e9a5dfe1912619aee81ea5053df75659b116711ce3b462c`.
Root prüfte70Dateien/1.264.786B und41Livequellen ohne Drift, gespeicherte12/12Tests,
Typcheck und konkreten Pack-/GLSL-/Inventur-/Testanschluss.13A-Dateien unverändert.
Gezielte unabhängige Prüfung ist abgeschlossen: R1–R4 durch den oben übernommenen Fix geschlossen; B-Baustein als C/D-Grundlage akzeptiert. Keine Native-/GPU-/Latenzfreigabe.
Begründung: A liefert jetzt echte immutable Produkte und den async Anschluss;
B macht daraus die konkrete gemeinsame CPU-/Grafikschnittstelle und prüft die
benötigte Zahlenpräzision vor paralleler C/D-Arbeit. Unabhängige A-Nachprüfung ist abgeschlossen; B ändert diese Dateien nicht.
Konkreter B-Schreibbereich: neue `src/app/atlas-terrain-prepared-contract.ts`,
`atlas-terrain-prepared-field.ts`, `atlas-terrain-prepared-budget.ts` und
`tests/atlas-terrain-prepared.test.mjs`; keine Field-/Surface-/Clientänderung. Kein weiterer
Untersuchungsauftrag und keine Freigabe späterer Abschnitte daraus.


| Abschnitt | Ergebnis / exklusive Zuständigkeit | Eingaben und Schnittstelle | Prüfung / Aufwand und erster Rahmen |
| --- | --- | --- | --- |
| B Vertrag und konkrete Zahlen | P-Owner: produktive typisierte Worker-Nachrichten,56/24-Layout und unabhängige Auswertungs-/Gradientenrechnung für116e6; tatsächliche Allokationszählung | A-Besitzer, bestehende K2-Topologie/K4-Stencils; eindeutige Basis-, Quellen-, Capture-, Job-, Operations-/Draftrevision und numerisches Bufferinventar. Screenantwort mit tatsächlicher K3-Generation/Frame/Field/Content/Float32alpha. Gemeinsame DTO-Datei danach nur P-Owner | Pack-/Auswertungsfehler an tatsächlichem Code und unabhängigen Höhen-/Gradientenerwartungen,32+1-Hülle und gesamte Backingstores; Schätzung45–60min, Rahmen60min. Repräsentation/Etats vor größeren Allokationen Root übernehmen |
| C Unterbrechbarer Worker und CPU-Felder | P-Owner: existing Modelworker/-client/-tilemodel, gemeinsam continuabler Formkern ohne geänderte Regeln; Basis-/Stencil-/Rayvorbereitung, kumulative Felder | A+B; genau ein Checkpoint-Fortsetzungsplatz im bestehenden Worker; bounded steps mit Message-/Yieldpunkten innerhalb Seiten-/Knoten-/Dose-/Grounddelta-Schleifen, aktives Latest vor nächster Fortsetzung; kein zweiter Worker/Queue | Aktive Geste während großer Fortsetzung, invalidierte/alte Jobs, gleiche kanonische Ergebnisse und vollständige Bufferfreigabe. Aufwand2–3h, Rahmen3h, Kontrolle90min. Kein vollständiger Suffix als ununterbrechbarer Job |
| D Darstellung und beide Picker | K3-Owner, tatsächlich gpt-6-sol/high: ausschließlich `atlas-terrain-field-presentation.ts`, `atlas-deck-surface.ts`, `atlas-mesh-ray.ts`, eng `atlas-deck-picking.ts` und deren Tests;56/24-Upload/VS, unveränderter FS, Screen-/Slot-/Escapeübergabe, gepackte Strahlabfrage | B eingefroren; parallel C bei getrennten Dateien. P-Owner liefert CPU-Produkte, D exportiert tatsächlichen bestätigten Screen und ausdrücklich invalidierbare Contentwartepfade; kein Rasterbypass | Bestehende K3-Fälle plus gepacktes Feld, beide Picker unabhängig gegen Dreiecke, volle Banken/CPU-Escape/Restorepeak;2–3h aktiv plus Checks, erster Rahmen3h, Kontrolle90min |
| E Echter Raster-/Pinselanschluss | P-Owner: `atlas-raster-presentation.ts` und Autoren-/Workeradapter, eng zugehörige Tests; konkrete Pointerdown-/Latest-/Commit-/Escape-/Undo-/Quellenwechselwege | A–D lokal übernommen; kein neuer Autorenbesitzer, Field/Surfaceänderungen seriell durch D-Owner. Lifecyclevertrag unten verbindlich | Echte A-pending→B→lateA→Bupdate→Escapefolge, Zwischenalpha, Unknown, Dispose; Kanonische Höhen/Materialien und keine verlorene Geste; aktuelle E1–E3-Zerlegung unten:2,5–3,5h aktiv, erster vertikaler Beleg45–60min; gemeinsame Grenzen im Plan |
| F Gebundener lokaler Handoff | P-Owner: tatsächliche Ressourceninventur, Vorabgates, ausführbare unabhängige Offline-Assemblierung des aktuellen vollständigen VS/FS und E-R3-Erwartungsinput; Quellen-/Runtimebindung | Vollständiges F nach C–E und akzeptierten K3/E-R3; begrenzter laufbezogener Anschluss nach S1/S2 ausschließlich gemäß06:28-Umordnung. Gemeinsame Builds seriell, kein nativer Beschaffungslauf | Relevante Tests/Typprüfungen/Builds; Wholebuffer-/Copy-/Restorepeak, aktuelles Programmpaar und13Runtimeartefakte an E.45–90min aktiv, Rahmen90min; danach gezieltes offenes Review vor Hardware |

C besitzt den Aufbau und Transfer des Rayindex; D besitzt dessen ausschließliche
Nutzung am bestätigten Screen. Der continuable Formkern umfasst konkret
`terrain-brush.ts`, `terrain-height.ts`, `terrain-brush-form.ts` sowie eng
`terrain-spatial-model.ts` für `terrainGridSteps`; dieselben Schritte bleiben
synchron drainbar, ohne Änderung kanonischer Regeln. Auch der reale vorgelagerte
bis257²-Samplingblock muss innerhalb seiner Knoten unterbrechen können; reine
Yields nach seinem Abschluss reichen nicht. Ein enges
C-eigenes Schrittmodul ist zulässig. C darf den vorhandenen höhenabhängigen
Küsten-/Reliefmaterialhelper aus `atlas-surface-draft.ts` gemeinsam extrahieren;
alte und neue Aufrufer nutzen dieselben Regeln, keine Raster-/Gestenbesitzeränderung.
Das Prepared-Protokoll erhält explizites `cancel/cancelled` sowie `settled` mit
exakter Dispatch-/Capture-/Epochbindung. `settled/cancelled` melden tatsächliche
`workerBufferIds`; Surface-Retained-IDs allein beschreiben die zusätzlich im
Worker gehaltenen Rohkanäle/Autorenoriginale nicht. Der Client wartet den gebundenen
Inventarabschluss vor dem nächsten Dispatch; alte Antworten ersetzen keine neueren
Inventare. Latest bleibt auch dabei ungekopiert und aktualisierbar im Client; Abbruch
betrifft die Berechnung, niemals angenommene Journal-/Schreibaktionen. Eine späte
Abbruchantwort darf keinen neueren Auftrag freigeben oder abbrechen. Für den vorhandenen K2-count/fill-Kern in
`atlas-terrain-field-presentation.ts` wurde C das serielle Fenster00:51–00:52
gewährt und danach die gesamte Datei an D zurückgegeben. Der vorhandene K2-Kern
hat jetzt einen Generator mit Sync-Drainwrapper. Drei direkte Vorher/Nachherfälle
(auch1mKind in2^28Parent und negative Koordinaten) erzeugten1488Yields und bitgleiche
Geometrie; begrenzter Zwischenbeleg, kein Latenzpass. Diff/Prüfscript/Log unter
`.build/terrain-water-p/tw06-p-product-c-20261027/field-window*`; Nachherhash
`0a8724c9a6dbf99edfc884b273c05b02283d9f4bf16d0876756915ebe741870d`.
D besitzt die Datei wieder exklusiv; kein paralleler Edit anderer Abschnitte.
Keine Kopie/neue Topologie. Diese Anschlussarbeit verlängert keinen Zeitrahmen. B fixiert sonst Layout
und Dateieigentum; gemeinsame DTOs/Builds nicht parallel ändern, Rückfragen an Root.
Nicht erledigte Kriterien werden offen übergeben statt über Abschnittsnamen zu
verstecken. Jeder Rahmen endet spätestens am nächsten übergeordneten Kontrollpunkt.

**Aktueller C/D-Prüfstand27.10.03:09: lokal unabhängig akzeptiert.**
C startete00:45; die enge Korrektur lief02:08–03:04, Quellenfreeze02:58:38.
D samt R1–R3-Fix war bereits quellenakzeptiert und hat die gemeinsamen Builds
seriell abgeschlossen. Der bestehende Reviewchat hat C-Familien/Rebase, Vorabgate/
Retaincontrol, C-R1, old-only und C-R2 gezielt geschlossen; keine neuen Blocker im
geprüften Bereich. E/F, vollständige GPU-Programme, native Bedienung/Bild und
Pinsel-/Speicher-/Reaktionsnachweis bleiben ausdrücklich offen.

| Beleg | Bindung und geprüfter Umfang |
| --- | --- |
| C-Finalfix `.build/terrain-water-p/tw06-p-c-families-20261027-0208/` | manifest.json52f165bf1d2e05428731c0e2a7c4ef4207fc2029ab2b468e1b2e426de2a9de64; freeze.json7db11aeac03690adb54d25ce31691149a07b93711cad2485d070b440e5e30990; fix.patch5f2b3d262622cde2a64a451586222ba54e44fa2e3f63eca6407914aad758b2cb gegen7d1b8a09. Root959Einträge/13.562.056B und895Live-/Snapshotquellen ohne Drift geprüft.38/38(21C+17B), beide Typchecks grün. |
| C-Nodebundle | runtime-node.cjs2c46ed5d2999f12ef31dfcd3f00604be7eedd87c1b69caad81771e88169f6d4f,624.527B; identisch aus eingefrorenen Quellen assembliert. Kein vollständiges GPU-Programmpaar. |
| D-Quellfix `tw06-p-product-d-20261027/` | review-fix-manifest.json7ca042c3151d182c1579d3c0796951a26162e856721deb60fe0e69b06ffd32c9;48Surface+37Field/Rayfälle. D-R1 echte Pickerbytes, R2 tatsächliches Escapealpha/Frozen-Ziel, R3 bestätigter oldSlot=-1-Enddraw und gezählte Descriptoren. |
| D-Build `tw06-p-product-d-build-20261027/` | build-binding.json79642776d77deba0db1ec6afd336a9bd012e87e86ac609f41381ede4b8403912; build→build:desktop seriell Node22 erfolgreich. Root21Bindings einschließlich13Runtimekopien/Livefiles16.915.611B,main.js/build-info und Logs geprüft. Kein F-/Native-/ExactSHA-Releasepass. |

HANDOFF.md und owner-counts.json des C-Finalfixes besitzen die detaillierten
Änderungen, Versuche, Formeln und E/F-Anschlussverträge. Alle Quell-/Test- und
Bindungsdateien bleiben eingefroren. Frühere Teilbelege wurden nicht ersetzt:
C-Teilmanifest7d1b8a09, D-Originalcfd230f2 und dessen korrekte finale K3-Abgrenzung
b68516da/1fbf9f3a bleiben erhalten. Die überschriebene erste D-Fixfassung29b/f562
ist weiterhin kein wiederherstellter Beleg. Beim Materialhelper fehlt der direkte
C-Vorherstand; der historische A-Formelvergleich ersetzt diese Provenienzlücke nicht.

**Korrekturergebnis und Grenzen.** Der negative4→8m-Fall differenzierte Draft an
fremden Unionknoten; er ist durch eigene affine Alt-/Neuquellenfamilien korrigiert.
Roh- und gepackte Endfelder stimmen über14.336alteDreiecke; gestufte T/Ecken und
zwei1m-Nachbarn besitzen unabhängige Erwartungen.57.598nichtverschachtelte K2-
Dreiecke (41.214mitSchnittknoten) verfeinern beide Familien; fünfGenerationfolgen
zeigen keine historische Kette. Kein universeller Bitgleichheits-/GPUbeweis.
Vorabgate zählt bestätigte plus reservierte Basen vor Kopie/Allokation. C-R1
entfernt die eigene ungezeichnete Basis beim runningCancel; drei Wiederholungen
führen Anzahl/Bytes/IDs exakt zum Ausgangsbesitz. Clientstaging verwirft spätes
apply auch zwischen Cancel und Ack. C-R2 bindet die gewählte Landfarbe bis zum
bestehenden Helper; rote Küste und entfernte Texel stimmen mit synchroner Regel.

Numerische Hülle: nur direkt bestätigter absoluter Alpha1+endFrame-Draft mit
exakter Serie/Revision/Quelle wird neue Altseite. Old≤116e6/New≤50e6/Draft≤116e6,
displayed≤282e6, g≤36.096e9; Float64/hi-lo bleiben Quelle, niemals Legacy-R32F.
Bei|Z|≤282e6 Pack≤2,003731µm, Pack+bedingterGraph≤279,214874µm; Gradientenpack
≤0,000128239 bzw.Graph≤0,019324944. Letzte relative Float32-Rundung ist separat,
keine Detailtoleranz. Old-only hat bitidentische New-/Draftaliase: Differenzen null,
konstantOld≤116e6. Die unabhängigeNew50-Schranke wird darauf nicht blind angewandt.
Dieser Nullkorrekturbeweis gilt für den geprüften Producer; der Validator prüft
Old-/Draftpaargleichheit nicht zusätzlich für beliebige fremde Pakete.
D bestätigt endFrame erst nach tatsächlichem Alpha1-Draw mit oldSlot=-1; old-only
wird nur dort retired/aus dem Ray ausgelassen. Kein tatsächlicher Newdraw bedeutet
keinen erfundenen Screenreceipt. CPU-Rollback behält echte Tabellen/Gradienten.

Ownerrechnung: drei aktuelle Familiencaches mit100B/nativemKnoten (≤135.200 je
Familie), bis zwei separat gefrorene16B/Knoten-Gradientarrays,20B/Newknoten-Atomik-
scratch und1B/Newknoten-DFS. Ein drittes Workeroriginal gepackter Drafts ergänzt
B um7.214.208B. Konservatives Gesamtmodell2.160.158.660B Backingstores und
2.370.800.100B bekannte numerische/UTF16-Inhalte;3GiB nur Beobachtungsrahmen.
137Censusmomente sind kein maximalerHeap-/RSS-Pass. Tatsächliche Maps/GC/SQLite,
integrierte E-Restore-/Uploadhalter und Performance bleiben F/nativ. COPY/MOVE und
bewiesene Aliase sind getrennt gezählt; historische B-Manifeste unverändert.

**Verbindlicher Anschluss an E.** Derselbe dauerhafte A-Owner muss nach akzeptiertem
Fenster-/LODwechsel seine Lattices atomar invalidierend wechseln und angenommene
Queue/Suffix/aktive33 erhalten. Jede Geste bindet immutable Water/Sea/View und
gewählte Landfarbe aus dem tatsächlichen zulässigen Kontext. Max32Journal+1aktive
Kontexte hängen an Captureobjekt/Ordinal/Serie; keine neueMainabfrage/erfundeneSea0.
Coveragefehler explizit, eigeneHeight-Acks dürfen Waterbindung erhalten; externe
Änderungen invalidieren. LokalerGround ist die akzeptierte Näherung, keine volle
49Band-/beliebigeScreen-Visibilitygleichheit (insbesondere Route/Zwischenalpha).

Nach endgültiger Screen-/Escape-Freigabe ruft E refreshInventory auf. Der idle-only
retain→retained-Kontrollabschluss nutzt denselben Einplatzkanal, eindeutige monotone
controlId plus Dispatch/Epoch/Operation/Capture; Ack meldet tatsächlichen Besitzabbau.
Während des gesamten Kontrollintervalls bleiben alle rechtmäßig restorable Leases
im Retainset; eine endgültig freigegebene Basis wird nicht wieder aufgenommen.
Weiterer Abbau erzeugt coalescten Folgeretain vor Prepare. Latest bleibt ungekopiert,
Replay bleibt vorrangig auch bei zwei Pins. Cancel/Dispose warten nicht auf blockiertes
Prepare. Bevor ungezeichnetes Staging gecancelt wird, Surfaceinstallation fencen/
abbrechen. Bei schon bestätigtem Draw zuerst apply→settle/settled abschließen und
Cancelintent danach; bloßes Surfaceinventar schützt nicht vor Worker-awaitingCancel.
C-LatePromisebeleg ersetzt E-Test des tatsächlichen Draw-/Cancelrennens nicht.

### E Bedienung und Speicherung

Status: E seit27.10.03:31 in Umsetzung; vertikaler E1-Beleg04:09 lokal übernommen,
E2/E3 aktiv und vollständige E-Nachprüfung offen. A–D lokal übernommen; gemeinsamer
Beginn/Entscheidrahmen und Balkenplan ausschließlich im [Plan](../plan.md#nächster-integrierter-produktnachweis).
Owner: bestehender P-Implementierer gpt-6.1-sol/high, ein zusammenhängender Lauf.
Übernommener E1-Anschlussbefund: E1 erreicht tatsächlichen Prepared-Draftdraw und genau
einen CampaignUI-/SQLite-Receipt. Unmittelbares B wird abgewiesen, weil Surface
die immutable behaltene Basisquelle (Revision0) gegen die durch eigenen Receipt
erhöhte A-/Draftquelle (Revision1) prüft. Negativsnapshot:
`.build/terrain-water-p/tw06-p-product-e-20261027/source-negative-20261027-0353/manifest.json`,
SHA256 `6e81b5b94840589510360527a2e782d91b3c408d983d7b32896a96ccbfa9002d`.
Root verifizierte913Artefakte/140.314.671B und900Livequellen ohne Drift; ursprünglicher
und genau ein ergänzender identischer Repro mit tatsächlichen Bindungsbytes sind
getrennt erhalten. Log belegt gleiche Basis1, Draftjob4/F0 und job8/F1 nach
einem echten Writerreceipt; Sourcefamilie bleibtF0. Lesende D-Diagnose bestätigt
den Fehlvergleich. Enger Review-Vertragsentscheid03:58 und D-Fixnachreview04:04 übernommen.
Der konkrete D-Fehlvergleich ist lokal geschlossen; E1-Produktrepro ist04:06 positiv; Root übernimmt den vertikalen lokalen
Zwischenbeleg04:09 und gibt E2/E3 innerhalb des bestehenden Auftrags frei.
Keine Relabels, keine stillschweigend entfernte externe Quellenprüfung. E3 muss
zusätzlich fremde gleiche-Token/Fence-/Revisionswechsel und alte Antworten belegen.
Vertrag der Korrektur: Bei neuer Geometrie Newsource exakt aktuellem Target
zuordnen, danach Basisursprung aus voller Basis, geklontem Target, Epoch und
Editserie einmal festhalten. Bei geometry:null gleiche volle Basis/Epoch/Serie
und immutable NewSources gegen diesen unveränderlichen Ursprung prüfen.
Aktueller Draft behält exakte Dispatch-/Capturebindung; Operation darf wechseln.
Token bleibt gleich, Revision darf nicht sinken; bei gleicher Revision muss
Fence gleich sein. Höhere Revision ist kein eigener Receiptbeweis. Der Ursprung
bleibt auch über Folgedrafts/Escape erhalten. D prüft diese Positiv-/Negativfälle;
E1 beendet danach den gleichen echten Folgezug samt unabhängigem Höhenhash.
Eigene Receiptkette und externe Quelleninvalidierung bleiben A/C/E-Verantwortung.
Fixbeleg: `.build/terrain-water-p/tw06-p-e-source-binding-20261027/manifest.json`,
SHA256 `25fbf63ab8208596e5db98d7ca86bf2a1f1a250b70eff2e39c282689b34153db`;
Delta `643b4686a866fa6d308d9bc8e7a5ac4102b777ce6036a8efdfd56026fb1aee45`.
Root verifizierte7Artefakte/339.279B und beideLivehashes.52/52 Surfacefälle
und Typcheck grün; gezieltes unabhängiges Nachreview ohne neuen Blocker.
Der D-Fix allein liefert keinen Produkt-/Build-/Nativepass. Der danach
positive E1-Produktklassenbeleg liegt unter
`.build/terrain-water-p/tw06-p-product-e-20261027/e1-positive-20261027-0406/manifest.json`,
SHA256 `42988f8e853244a14ea9c29a440d7ba4380e1d01d11d8fd28f51c844e0347040`.
Root prüfte908Artefakte/16.887.305B und900Livequellen ohne Drift. Derselbe Ablauf
zeichnet A und B mit einem A-Owner/Worker, schreibt genau einmal; alte A-Antwort
ersetzt B nicht. SQLite-Höhenhash stimmt unabhängig gegen die kanonische Formregel.
Etablierte FakeDeck-/Devicefixture; kein realer Shader-/GPU-/OS-/Main-/Preload-/
Latenzpass. E2/E3 und vollständige E-Nachprüfung bleiben offen.
**E3-Recovery: enger Nachplan vom 27.10.04:52 UTC.** Lieferhindernis bleibt
offen: Receipt48 ist gefunden, angenommener ungeschriebener Zug49 bleibt bisher
ohne nutzbaren Fortsetzungsweg. Diagnose und Vertragsreview sind abgeschlossen;
Root übernimmt um04:55 die unabhängigen engen Machbarkeits- und Ablagechecks
ohne Blocker sowie die bestätigte Vertragsübernahme des Reviewers. Korrektur beim
bisherigen E-Owner freigegeben; Kontrollpunkt05:25 ist durch Root05:20 vorgezogen.
Erster lokaler Produktbeleg05:02: `recovery-first.log` unter
`.build/terrain-water-p/tw06-p-product-e-20261027/` besteht1/1. Root las Log und
Prüfablauf: UI-Klärung teilt Doppelklick-Promise,48/49 insgesamt zwei echte
SQLitewrites, gleicher A/C, neuer Pinselbeginn möglich. Unabhängiger kanonischer
Höhenhash `e59ddb2bd1b6489a61c62bbc1f5740f94f2516070722b9660b6911e180519d68`
stimmt. Weitere lokale Belege05:09: Checkpointretry und Fremdstand-Cancel/
Verwerfen2/2, stale/Dispose/49→Unknown4/4, ehrlicher Reloadretry1/1; Root las die
Logs `recovery-checkpoint-conflict-first.log`, `recovery-lifecycle-first.log` und
`recovery-reload.log` im selben Verzeichnis. Gesamtfreeze/Nachreview bleiben offen.
**Übernommener Ergänzungsentscheid not-applied48,05:16:** Der vorhandene UI-Weg hält
48+49 ohne Fortsetzung. Gebundene Diagnose:
`.build/terrain-water-p/tw06-p-product-e-20261027/not-applied-blocker-20261027-0511/manifest.json`,
SHA256 `ebaa05f7d30a7b40406843974cf7bd261f9907f5eb0af2076eb524522648b253`;
Root prüfte15Dateien/7.597.968B und9Livequellen ohne Drift. Kein entsprechender
Produktfix oder positiver not-applied-Beleg. Beide unabhängigen engen Planchecks
sowie die Reviewerbestätigung der Vertragsübernahme sind abgeschlossen. Root
gibt den folgenden Anschluss05:16 beim selben E-Owner frei; der Lieferblocker
bleibt bis Fixnachprüfung offen:

- Derselbe E-Owner ergänzt ausschließlich vorhandene author/UI/Queue/A-Anschlüsse
  und bestehenden Produktklassentest. Ergebnis: ausdrückliches Verwerfen aller
  nachweislich ungespeicherten48+49 mit anschließend nutzbarer aktueller Karte.
  Kein Retry/Write/neue IDs, kein neues Main-/Preload-/Storage-/DTO-/UI-Gerüst.
- Original command48/Receiptreferenz/Schreibsperre sowie Owner/Queue/Serie/
  Head/Fehlergeneration und exakte Captureliste bleiben während Klärung und Dialog
  gebunden. Der typisierte lokale Zeuge bindet token/campaignId/commandId/
  fingerprint/action und darf nicht als wiederverwendbares Boolean gelten.
  Tatsächliches read-only reconcile am Originalcommand muss not-applied
  melden; Main-in-flight oder unklare Antwort genügt nicht. Kein späterer Capture
  darf attempted sein. N und Text beziehen sich auf ALLE nachweislich nicht
  gespeicherten Züge, ohne fälschlich angewandten Head zu behaupten.
- Abbrechen erhält alles. Nach ausdrücklich bestätigtem Dialog erneut read-only
  reconcile und alle ursprünglichen Identitäten prüfen. Wechsel zu applied oder
  unknown, stale Owner/Quelle/Generation, zwischenzeitlicher Versuch oder Dispose
  bricht ohne Mutation ab. Vor Mutation queue.count==0, keine konkurrierende
  Recovery und dieselbe eingefrorene Quelle/Liste/A-/UI-Bindung prüfen. Doppelklick
  teilt die laufende Aktion. Nach JEDEM await erneut prüfen. clearAtlasWriteReference
  ist kein not-applied-Zeuge: nach dem letzten asynchronen Vorbereitungsschritt
  (insbesondere write.clear) frisch not-applied bestätigen, danach Bindung prüfen
  und ohne weiteres await lokal verwerfen; nur eine konkret belegte gleichwertige
  No-attempt-Barriere darf dies ersetzen. Command-/Receiptbeleg bleibt in-memory
  bis zum lokalen Abschluss; Pending-Schreibslot bleibt reserviert, Queue gefroren.
  Erst danach Pending freigeben. Vorhandener gebundener Reloadweg
  und ehrliche Reloadfehlermeldung werden wiederverwendet. Keine automatische
  Umdeutung zu einem anderen Verwerfmodus.
- Prüfkriterium im selben tatsächlichen UI/Raster/A/C/SQLite-Ablauf:48 nachweislich
  nicht angewandt,49 angenommen; Cancel erhält beide; bestätigtes Verwerfen lädt
  nutzbar, null Writes. Zwischen Dialog und Bestätigung geänderter Outcome
  applied/unknown sowie stale Bindung auch während Clear wirken nicht; bestehender applied48-Pfad
  bleibt gültig. Originalbelege und Quellfreeze/Delta zur gezielten Nachprüfung.
- Schätzung10–20min einschließlich dieser Prüfungen beim bestehenden Owner nach
  Plan-/Vertragsübernahme. Gemeinsames E-Nachreview15–25min umfasst beide Zweige;
  kein zusätzlicher Reviewzyklus oder Zeitrahmen. E-Start03:31, Recovery04:55,
  damalige Kontrolle05:25; aktuelle Ziele/Entscheidgrenzen stehen im Fixture-Nachplan. Andere
  E-Abschlussarbeit darf unabhängig fortsetzen; not-applied-Code ist05:16 freigegeben.

Lokaler Ergebnisstand05:19: `not-applied-first.log` im E-Verzeichnis besteht5/5
(vier neue Fälle plus angewandter Normalfall). Root las den Log und Testeinstieg.
Cancel erhält48+49, ausdrücklicher gebundener Discard lädt tatsächliches neues
PreparedTerrain und erlaubt eine Geste bei null Writeraufrufen/SQLite-Receipts.
Frischer Zeuge nach Clear; changed applied/unknown/stale während Clear erhält
Captures und In-memory-Beleg. Darstellungsanschluss `displayTiles` im bestehenden
Fenster-/Zwischenalphafall1/1 (`e2-draw-bound-rawgroup.log`) lokal positiv; Raster
übernimmt die tatsächlich gezeichnete Session-Rohgruppe. Gesamtstand/Nachreview
noch offen, kein nativer Pass. Owner schließt Checks/Inventur/Freeze bisZiel05:35
ab; Root bestätigt05:20 Fortsetzung innerhalb der unveränderten Grenzen.

### E-Folgegesten-Testgrundlage

Status07:26 UTC: S1/S2-Delta und29 gezielte Tests unabhängig positiv; der
vollständige48→49→50→Draw400→51Cancel-Ablauf ist im einzigen freigegebenen Lauf
lokal positiv und unabhängig vollständig übernommen. Normale UI-/Pick-/Escape-/
Undochecks und Typchecks stehen noch aus. S3–S6 bleiben unberührt/offen.

Gebundener positiver Lauf `completion-run-20261027-0724/manifest.json`, SHA256
`20dada01a0b24c5755c1490d5462afcaba860cbfd335ecd6c9091c064a5d4a21` im bestehenden
E-Artefaktverzeichnis: Root bestätigt13Artefakte/8.014.545B ohne Drift. Genau ein
Aufruf07:24:24–07:24:28,Exit0,TAP4.128s/Fall2.334s. Drei Writes/Receipts und
unabhängiger Hash `3d3767e68abb7cdfd8b2333198227597107ea5feb879b953fdb9fcaf3ead2dcb`;
reale R3-Publication/Return, gebundener vollständiger Screen/PackedPick400 vor51
und nachCancel,Alpha1/Endframe/Settle/Retain,gleicher gesunder A/einWorker/ready.
EndscreenDraft15 gegenüber A.content17 ist trotz vollständigem Funktionspass
ungleich; die alte rohe Gleichheit ist kein Abschlussgesetz. Kein nativer
GPU-/Bild-/Latenznachweis.909Vorher/Nachherquellen unverändert, autorisierte
parallele F-Tooländerungen separat gebunden.

Ursache der vorherigen380-Grenze war die Testwartebedingung vor ausstehender
R3-Lieferung, die erst Cleanup verworfen hat. Unabhängig geprüftes reines Testdelta
`completion-delta-20261027-0717/manifest.json`, SHA256
`056d2c9e85c9a640d3951736378c8f411820d385d480c5664b2293ba642a9f5c`,5Artefakte/176.290B:
finaleR3-Publication/Return gleicherSerial/Quelle und semantisch vollständiger
48–50Capture getrennt an tatsächliche Dispatch/Result/Install/Screen/Draw/Settle-
Kette binden. Kein Install-nach-Publish-Zwang, kein beweglichesA.content-Orakel;
400/51/Endframe/Retain und gesamtes20s-Fenster unverändert. Nur bestehenderTest,
Helper/791Produktquellen bytegleich. Kein zweiter Lauf oder Fix danach.

S1/S2-Teilfreeze `s1-s2-20261027-0651/manifest.json`, SHA256
`4e6c5eff5d7f51e5215aaba2be8a186b8adc2f19b65fbc287a3a2e66fffaba76`,
932Artefakte/23.358.195B und Patch
`65a85bac43071adabef15822ebdbfd5c1b1f22575591a2f1ce148340970af75f`
bleiben unverändert erhalten, einschließlich des damals negativenV2-Laufs.
Drei frühere Produktkorrekturen, zwei Diagnosen, eine Charakterisierung, erster
S1/S2-Vollfall und jetziger positiver Abschlusslauf bleiben getrennte Belege;
kein Reset von E/P/10:00. Noch keine E-Gesamt- oder Hardwareübernahme.

**Verbleibender enger Testanschluss, Rootstart07:28:** Vier vorhandene Fälle in
`tests/terrain-commit-display.test.mjs` (ImmediateB nachReceipt, B-Update/Escape,
beide Packedpicker/Cursor und UI-Undo/Redo) nutzen noch die begrenzte alteFixture.
Derselbe E-Owner stellt nur diese vier auf den bereits geprüften lifecycle:true-
Anschluss um. Undo/Redo verliert seinen privaten InstallCurrent-/Rasterrelabel-
Ersatz und läuft über normalen Regionsrefresh/stream.load; tatsächliche Source-/
Draw-/Endframe-/Settle-/Retain-/Storehöhen-/Packedpick-/Workergrenzen prüfen.
Kein Produkt-/Helperedit oder allgemeines Testframework, keine roheA.content-
Gleichheit, unveränderte Wartefenster. Erst Delta binden und eng lesend prüfen;
danach separat genau die vier Fälle sowie npm run check/check:desktop. Der
positive48–51-Fall wird nicht wiederholt. Owner schätzt20–35min inklusive Checks/
Bindung, Review separat; weitere Scopeänderung sofort melden. Noch keine
Ausführungsfreigabe für diese Checks aus dem Deltaauftrag.
Vierfall-Delta inzwischen eingefroren: `normal-ui-delta-20261027-0728/manifest.json`,
SHA256 `bb1a0be48066589e675ab1dbe21834ea3dc6b4d2002215f7f93f530f226ef61f`; Root
bestätigt5Artefakte/195.162B. Genau vier Fallkörper geändert, übriger Test und
Produkt/Helper unverändert. Unabhängiger Lesereview positiv übernommen;
Rootstart07:35 für genau diese vier Fälle, bei vier positiven Ergebnissen danach
beide Typchecks. Einziger Vierfall-Aufruf07:36:52–07:37:18 negativ: Escape und Undo/Redo
positiv, ImmediateB-Fall wartet vor erstem aktivemA-Screen bis20s; Pickerfall
erreicht gebundenen Draft/Settle, aber Center-Ray null. Owner STOP ohne
Typchecks/Edits/Retry; vollständiger negativer Freeze und rein lesende
Ursacheneinordnung sind gebunden: `normal-ui-run-20261027-0735/manifest.json`,
SHA256 `0105fe3935b67703177a72756304adaf4edbc689f09037a45f7f26a6c358fb6e`,
Root14Artefakte/7.921.949B ohne Drift.909Quellen unverändert. Unabhängiger Review
prüft den Freeze; keine Gesamtübernahme. E1 zeigt content0/keinen Draftinstall
bei1642RAF-Callbacks und1644Replayjobs. Quellreview bestätigt den möglichen
Starvationpfad tickLive→previewHeight→A.update-Version→rebuild.current ungültig→
C-Replaycancel, bevor E.refresh einen Draft erhält. Ein verlangsamter RAF oder
Pointerpause ist keine Behebung der Fortschrittspflicht. Root beauftragt07:44
nur die enge Korrekturplanung beim selben E-Owner, keine Edits/Läufe.
Picker besitzt bestätigten Draft/Endframe/Ready, aber tatsächliches Raysegment
ist nicht geloggt. Quellrechnung legt Kamera unter dem angehobenen300m-Gelände
nahe; Null könnte geometrisch korrekt sein. Fachvertrag „kein Durchtauchen“
bleibt unabhängig davon offen, Kamera-Draftpfad wird nur lesend eingegrenzt.
Keine Rayverlängerung/Kamera-Ausweichposition als verdeckte Produktbehebung. Undo/Redo
beobachtet tatsächliche neue Clients; serieller Ownerwechsel zulässig. Escape
belegt D-Restoredraw plus Retain, keinen erfundenen C-Settle. Kontrollierte
Late-A-Pausen bleiben ausdrücklich Klassenregression, keine Native-/Latenzabnahme.

Der folgende Testgrundlagenauftrag ist abgeschlossen und beschreibt den
weiterhin gültigen V2-Vertrag; neue Änderungen brauchen den aktuellen Entscheid.
Derselbe E-Owner (gpt-6.1-sol/high) korrigiert ausschließlich
`tests/terrain-commit-display.test.mjs` und
`tests/helpers/atlas-prepared-surface.mjs`. Im Helper nur opt-in ausführender,
abbrechbarer RAF mit geordnetem Abbau; keine neue allgemeine Testbibliothek.
Owner schätzt30–40min bis zum gebundenen lesbaren Delta, nach separater Freigabe
5–8min für einen Lauf samt Bindung. Root pflegt gemeinsame Docs;
unabhängige Machbarkeit/Ablageprüfung und bestätigte Vertragsübernahme vor Edit.

**Befund und nächster entscheidender Beleg.** Nach drei Korrekturversuchen fehlt
weiterhin der vollständige48→49→50→Draw→51→Cancel-Nachweis. Versuch1 korrigierte
unzureichend die Schreibsperre; Versuch2 schützt50s Dispatch/Pending, aber ein alter
Read scheitert während eigener49-Acklücke. Versuch3 ergänzt eine begrenzte lokale
options.write-Ackbarriere: A übernimmt Quelle/Version vor normalem Queuecheckpoint;
der alte gebundene Read wird danach über bestehende Gültigkeitsprüfung verworfen.
Damit sind drei Writes, Journal0, A.failed=false und errors=[] belegt, noch kein
aktuell nutzbarer Screen. Vor dem Quellreview06:17 war kein weiterer Produktfix
begründet; dessen neue Befunde begründen den unten geplanten zusammenhängenden
Korrekturansatz. Die Produktfreigabe steht weiterhin aus.

Die unabhängige Prüfung belegt gleichzeitig mehrere abgeschnittene Testanschlüsse:
Raster.load noop, regions.refresh nur Zähler, host.writing immerfalse, RAF ohne
Callback und fehlende Surface-Fehlerweitergabe. Die Rohgleichheit
Screen.draftRevision===A.content ist kein allgemeines Architekturgesetz. Eine
gültige kanonische Darstellung darf selbst changeLattices/A.content fortschreiben.
Die prefix0-Diagnose zeigt vollständige R3-Geometrie **an Surface übergeben**, nicht
erfolgreich installiert/gezeichnet. Cidle/ScreenNULL/errors[] beweist wegen dieser
Testbedingungen keinen konkreten Produktdefekt. Mögliches reales Drawrennen bleibt
offen. Die Testgrundlage muss zusammenhängend stimmen, bevor erneut gemessen wird.

**Vollständiger enger Korrekturvertrag, ausschließlich Testanschlüsse:**

1. Echtes Raster.load einschließlich Entry-/Publication-/Generationguards behalten.
   Den vorhandenen SQL-prefix0-Tileadapter nur an die Datenliefergrenze stream.load
   setzen: kleines bestehendes Fixtureobjekt mit load/cancel/gebundener Callback-
   ausgabe. Quelle gegen übergebenen Loadauftrag UND Store prüfen, niemals Raster-
   quelle aus Store umschreiben. Keine neuen produktiven Exports/Reader/APIs und
   keine vollständige Workbench-/Stream-/GPUfixture. Single-Tile/Material/GPU bleiben
   modellierte Grenzen; produktive A-/Recovery-Receiptprüfungen unverändert.
2. host.writing wie UI550 an ui.busy || regions.reading binden. Regionfixture bildet
   reading setzen → raster.pauseReads → normales Render/Sync mit noch ALTER
   regions.data → Projektion aktualisieren → reading löschen
   → normalen Render-/Sync-/Loadanstoß für genau diesen gebundenen eigenen Stand ab
   (Regions182–193/243–246, UI1396). R2-Load während laufendem50 unterbleibt; finaler
   R3-Load muss nach Regionsrefresh wieder regulär möglich sein. Kein direktes
   Session.refresh/show oder privates publish zum Erzwingen des Ergebnisses.
3. Ausführender, abbrechbarer RAF mit fortschreitender performance.now-Zeitbasis;
   bestehender Renderinterval zeichnet daraus entstandene Props. Kein künstliches
   Alpha/Morphstart/Screen/EndFrame, kein Watchdogabschalten/Timeoutverlängern.
   Create.onError/onContextLost an tatsächliche vorhandene Rasterfail-/Kontextpfade
   anschließen; frühe Initialfehler ebenfalls erfassen. Auf jedem Abbruch gehaltene
   Writer lösen, Operationen drainen, Intervalle/RAF abbrechen, Surface/Store/Globals
   geordnet schließen. Kein erfolgreich wirkender Test trotz internem Surfacefail.
4. Reale Screen→Applywaiter→screen-confirmed→settled→Endframe→EscapeRelease/Retain-
   Kette unverändert. Beobachtung bindet Installationseintritt UND Rückkehr,
   passenden Draw/AfterRender-Screen und Settleabschluss. FakeDeck-DrawSuccess bleibt
   GPU-Ersatz, keine Native-/Shader-/Performanceabnahme.
5. Vor51 fachlich assertieren: drei Writes/Receipts und unabhängiger kanonischer
   Referenzvergleich; vollständiges aktuell tatsächlich gezeichnetes Packed-Feld
   mit Pick400, echter Alpha1/oldslotfreier Endframe, gleicher gesunder A/ein lebender
   Worker, ready, C flight/latest/control leer, kein offenes Escape/Restore/Retain.
   Gültige Basis plus exakt gebundener kumulativer Draft ist zulässig; keine rohe
   A.content-Gleichheit als allgemeines Gesetz. Nach51begin/cancel erneut Pick400,
   gültiger Screen/ready, kein Active/Journal/Pending, derselbe A/C einschließlich
   abgeschlossener Retainarbeit, weiter drei Writes/Receipts. Cancelpromise allein
   beendet nachlaufende C-Arbeit nicht.

**Abfolge und Stopregel:** Enge Planchecks/Rootübernahme → ausschließlich Test-/
Helperdelta vorbereiten und binden, Produktbytes gegen e77 unverändert nachweisen →
lesender unabhängiger Abgleich aller fünf Vertragspunkte → erst dann Rootfreigabe
für genau einen begrenzten48→51-Lauf mit unverändert20s-Wartefenster. Bei Fehler/
Timeout terminalen Dump von Surfacefailure/context/alpha/frozen/pending/deadline,
RAF-Zählern, A/C/Screen und Loadguards sichern, danach STOP; keine Retryserie.
Bei positivem Ergebnis gebundene Nachprüfung vor weiterer E-Übernahme. Dieser
Testgrundlagenanschluss ersetzt keine breitere E-Nachprüfung oder Produktabnahme.
Originale Belege bleiben unverändert; eigener Delta/Bundle/Log/Quellvergleich.

Der Diagnoserahmen05:43–05:58 ist mit zwei ausdrücklich einzeln genehmigten und
gebundenen Läufen beendet, keine automatische Fortsetzung. Der Testgrundlagenanschluss bleibt innerhalb bestehendem E/P und gemeinsamer
10:00-Grenze. Tatsächlicher Testeditstart nach Planchecks06:13, Deltaziel06:43–06:53,
lesender Fixtureabgleich5–10min, danach nur separat freigegebener Lauf5–8min.
Unabhängiger vollständiger E-Quellreview darf parallel ausschließlich den stabilen
e77-Produktstand lesen; keine Testläufe/Edits und keine Gesamtfreigabe daraus.
Das vermeidet die spätere doppelte serielle Quellenprüfung. Nach positivem Lauf
gezielte letzte Checks/Handoff5–10min und Ergebnisnachprüfung10–15min reservieren.

Die früheren Ziele06:31 und07:15 sind überholt. Testdelta und V2-Prüfung sind
abgeschlossen; die aktuelle07:08-Kontrolle und Folgetermine stehen ausschließlich
im [Plan](../plan.md#nächster-integrierter-produktnachweis). E-Start03:31,
Recovery04:55 und die gebundene Versuchsgeschichte bleiben unverändert.
Vollständige F-/Native-Lieferübernahme wartet auf E; für das frühe Gate gilt
nur die begrenzte06:28-Reihenfolge unten. Die gemeinsame10:00-Grenze bleibt.

**Unabhängiger Quellreviewentscheid, 06:17 UTC:** Korrektur nötig. Reviewchat
`01a179b3-ced4-7dd2-bd61-16dd07fd0bc5` hat den vollständigen E-Quellanteil beendet;
1025 Freeze-Artefakte gebunden und abschließend791 Produktdateien bytegleich.
Keine weiteren konkreten Blocker, keine Tests/Builds/Produktänderungen. Die folgenden
sechs Befunde verhindern E-Übernahme. Isolierte Testdeltaarbeit und die unten
begrenzte frühe Hardwareumordnung bleiben separat:

| Befund | Gefrorene Quellen / Trigger | Erforderliches Ergebnis und gezielter Beleg |
| --- | --- | --- |
| E-S1, P1 | Raster230–233; Regions192–206; UI1396: anfängliches Render mit alter regions.data invalidiert vor dem Revisionsguard | Niedrigere Projektion desselben Tokens hat keine Invalidierungswirkung. Echte fremde autoritative Quelle bleibt gefenct. Normaler Refresh nach49/50 erhält A/C; höherer Fremdstand und gleicher Stand mit anderem Fence bleiben negativ. |
| E-S2, P1 | A169–175; Session90–93; Queue76–87: Read startet vor dem per tail.then geplanten eigenen Write; beim Readfehler ist der eigene SQL-Commit schon erfolgt, Ack noch offen | Tatsächlich passender überlappender eigener Write bis zum Fehlerzeitpunkt berücksichtigen, nach Ack/Quellenfortschritt gebunden neu bewerten. Beide Startordnungen prüfen; fehlender/fremder Ack und unverändert echter Readfehler bleiben Fehler. |
| E-S5, P1 | Brush87–95/115–131; A107/111; UI1392: Unknown48 während49 pointer-aktiv; RAF/Pointer-up wirft vor lokaler Live-Bereinigung | Pointer/RAF lokal vollständig beenden, Autoreninhalt48/49 behalten, Recoverybedienung erreichbar. Kein stilles Cancel, Verlust oder Fallback. A hält letzten angenommenen49-Inhalt und dessen Closeabsicht; nach erfolgreicher Adoption denselben49 einmal abschließen, ohne Pointer/RAF wiederzubeleben, dann Folgegeste. |
| E-S6, P1 | A122–133; Journal.freeze30; Session92/98: Close33 wartet bei32 Captures, Unknown entfernt den Waiter, closing bleibt | A hält die erklärte Closeabsicht über Freeze/Recovery. Bestehenden Journal-Suffix zuerst einplanen,33 danach einmal mit gleicher ID bei Platz aufnehmen. Explizites Escape/Verwerfen erreicht die gehaltene Absicht. Beleg32+33→Unknown→Recovery→33 einmal→Folgegeste; zusätzlicher gebundener Escape auch nach Brush.live/Session.activeId=null. |
| E-S3, P2 | UI664–665; gefrorener Folgetest342–343: Recovery meldet gespeichert bei noch pending50 | Geklärten Speicherstand und noch offene Folgeeingabe korrekt unterscheiden; pending/aktive Eingabe darf keine vollständige Speicherbestätigung erhalten. |
| E-S4, P2 | Raster345–349/407; UI268: numerischer Dedupreturn vor Styleupdate | Reine Konturänderung erreicht bei identischer Kamera/Geometrie Surface unmittelbar, ohne numerisches Reprepare. |

Die Kürzel bezeichnen `src/app/atlas-raster-presentation.ts`, `atlas-regions.ts`,
`campaign-atlas-ui.ts`, `terrain-author-state.ts`, `atlas-terrain-prepared-session.ts`,
`terrain-stroke-queue.ts`, `landscape-brush-session.ts` im e77/source-snapshot.
Die Trigger sind Quellbefunde; ihre Laufzeitnachweise fehlen noch.

### E — Zusammenhängende Übergangskorrektur nach Quellreview

**Planentwurf; keine Produktfreigabe.** Der unabhängige Architekturentscheid empfiehlt
eine lokale Korrektur in den bestehenden Besitzern. Kein neuer Owner, Queue,
Store, IPC, allgemeiner Stateautomat oder A-Observer ist begründet. Quellenautorität
entscheidet Raster einmal vor Seiteneffekten; A besitzt eigene Schreibbestätigung
und gehaltene Closeabsicht; Brush besitzt vollständigen Pointer-/RAF-Abschluss.
Session/Queue dürfen daraus keine gegenläufige Zustandsautorität ableiten.
A besitzt die fortzusetzende Close-Completion und bindet sie an die ursprüngliche
ID; nach Adoption erst bestehenden Suffix einplanen, danach gehaltene Closeabsicht
aufnehmen und Abschluss abwarten. Der normale Escape-/Verwerfeinstieg muss diese
Absicht auch ohne Brush.live oder Session.activeId erreichen, nicht nur aufbewahren.
UI-Status folgt dem Restzustand, Styleausgabe ist vom numerischen Dedup getrennt.

**Ergebnis und Eingaben:** Alle E-S1…S6 schließen und mit der korrigierten
Testgrundlage den bestehenden48→49→50→Draw→51→Cancel-Ablauf vollständig zeigen.
E77-Produktfreeze, die beiden Diagnosefreezes, geprüfter Zweidateien-Testdelta und
der gebündelte Reviewentscheid sind Eingaben. Kein Wiederanlauf von A–D als
Gesamtprojekt; deren berührte Übergänge werden gezielt geprüft. Historie bleibt
bei drei bisherigen Produktkorrekturen und zwei Diagnoseausführungen.

**Zuständigkeit und Umfang:** Bestehender E-Owner `tw06_boundary_implementation`
(gpt-6.1-sol/high) besitzt Diagnose, kohärente Umsetzung, Tests und Laufüberwachung;
Root besitzt diesen Auftrag und Plan. Nach Abschluss/Bindung des Testdelta seriell
ändern: die sieben oben genannten Produktdateien, nur betroffene Übergänge; Regions
ist primär Referenz und benötigt ohne konkreten Grund keinen Edit. Vorhandene Tests
`tests/terrain-commit-display.test.mjs`, `tests/terrain-stroke-queue.test.mjs`,
`tests/landscape-brush.test.mjs` und bereits vorhandene Autoren-/Rastertests verwenden;
für den sonst unerreichbaren gehaltenen49/33-Escape ist auch
`src/app/atlas-landscape-ui.ts` eng als bestehender Eingabeeinstieg vorgesehen;
weitere konkrete Schnittstellenpfade vor Edit benennen. Keine Surface-/Worker-/Shader-/Formkern-/
Main-/Preload-/Storeänderung, kein fremder Hunk. Kein Ausbau einer allgemeinen Testbibliothek.

**Reihenfolge und Prüfkriterium:** Plan unabhängig auf Machbarkeit und Ablage prüfen,
Reviewübernahme bestätigen; Testdelta separat lesend prüfen. Root entscheidet danach
über genau eine gebundene e77-Regression mit unverändertem20s-Wait; erwarteter roter
S1/S2-Befund wäre keine Test- oder Produktfreigabe. Keine Wiederholung ohne neuen
Entscheid. Erst expliziter Rootstart erlaubt die zusammenhängende Produktkorrektur.
Vor Edit konkrete Übergangshypothese formulieren. Danach tatsächlicher Enddraw/Pick400,
gleicher gesunder A/C, drei Writes/Receipts,51Cancel/Retain fertig sowie alle sechs
oben benannten Regressionskriterien. Keine geschwächte Assertion, keine pauschal
verschluckten Fehler, keine Retry-/Timeoutverlängerung. Betroffene Typchecks und
bestehende relevante Tests einmal auf finalem Stand; Artifact-/Runtimebindung und
Capability-Testlinks aktualisieren. Quellenreview prüft anschließend nur Delta,
berührte Übergänge und gebundene Ergebnisse. Kein Gesamtpass aus Testzahl.

**Geänderte Reihenfolge, Rootentscheid06:28; Machbarkeit und Reviewübernahme bestätigt06:30:**
Der vollständige serielle Weg nach Testdelta benötigt220–388min und endet bei
Deltaziel06:43–06:53 frühestens10:23, oberer Rand13:21. Diese Rechnung enthält
unvalidierte Hardwaredauer, ist keine Zusage. Statt vor dem entscheidenden
Hardwarebeleg90–150min in alle sechs Fehler zu investieren, wird das bereits
geplante frühe Gate nach den direkten Normalpfadfehlern S1/S2 vorgezogen. Das
klärt die noch ungeprüfte GPU-/Latenztragfähigkeit des Ansatzes früher. Es ist
keine zusätzliche Vorprobe, keine E-/F-Gesamtübernahme und keine Zielverkürzung.

| Stufe / Besitzer | Ergebnis und erlaubter Umfang nach ausdrücklichem Start | Aufwand / Abhängigkeit |
| --- | --- | --- |
| Bestehende Testgrundlage / E-Owner | Zweidateiendelta fertigstellen, unabhängig lesend prüfen; separat genau eine gebundene e77-Regression mit20s-Wait möglich. Rot bleibt Rot, keine Wiederholung. | Vorbereitet06:13–06:34, Rootbindung06:35 positiv; jetzt5–10min unabhängige Prüfung und ggf5–8min Lauf/Bindung. |
| S1/S2 / derselbe E-Owner | Nur `terrain-author-state.ts` und `atlas-raster-presentation.ts`; vorhandene Tests `terrain-stroke-queue.test.mjs`, `atlas-presentation-source.test.mjs` und eng `terrain-commit-display.test.mjs` für Normalpfad. V2-Artefakt bleibt erhalten. Beide Read/Write-Ordnungen, echte Readfehler/fehlender Ack, alte eigene vs fremde Quelle, vollständiger48–51Enddraw/Pick/Retain. Für Hardware zusätzlich tatsächlichen normalen UI-/Pick-/Escape-/Undo-Pfad auf demselben Freeze belegen. Keine S3–S6-Edits. | OwnerStart06:51; S1/S2-Delta,29Tests und korrigierter vollständiger48–51-Lauf inzwischen unabhängig positiv übernommen. Vier vorhandene normaleUI/Pick/Escape/Undo-Tests werden seit07:28 eng angeschlossen, danach Typchecks/Bindung;20–35min Schätzung plus Review. Keine S3–S6-Edits. |
| Vorbereitung F/Gate / early_gate_feasibility, gpt-6-sol/high | Unabhängige Offlineassemblierung des vollständigen aktuellen VS/FS, bestehender E-R3-/LOD-Harnessanschluss und konkrete Halterbilanz vorbereiten. Freigegebener enger Schreibbereich: neue `tools/terrain-water-p-program-expectation.mjs`, `tools/test-desktop-terrain-water-p-gate.mjs` und `.build/terrain-water-p/tw06-p-f-gate-prep-20261027/PREP-HANDOFF.md`; bestehende Helfer wiederverwenden, nicht duplizieren. Kein Produktedit, Build oder nativer Lauf während S1/S2. |Vorbereitung06:32–06:51 abgeschlossen, unausgeführt. Capture-/Assemblerquellen vorhanden, Startpflichten noch teilweise unimplementiert (siehe Handoff unten).07:08-Kontrolle erfolgt; Restumfang wird nur eng nachgeplant, keine weiteren Edits/Läufe freigegeben. |
| F-Anschluss für diesen Lauf / derselbe F/Gate-Owner | Nach vollständiger aktueller Startbedingung im folgenden F-Auftrag (S1/S2/S7/S8, FieldGate und korrigierter Adapter) tatsächliche vollständige Shader offline assemblieren; serieller Build→Desktopbuild;13 aktuelle Runtimeartefakte. Begrenzter früher Ressourcenvertrag gemäß folgendem F-Auftrag: konservative Vorabrechnung, vorhandene Inventur und echter externer Speicherschutz; keine vollständige transiente Halterbehauptung. E-R3-Erwartung bindet echte Quellen/Programme/Runtimes, nicht nur gepacktes vorhandenes GLSL. | Bisherige F-Annahme45–90min +15–25min Review, Ersparnis aus Vorbereitung erst anhand des Ergebnisses anrechnen. Alle finalen Werte warten auf Produktfreeze. Keine globale Maximal-/Recovery-Ressourcenfreigabe. |
| Bestehendes frühes Hardwaregate / F/Gate-Owner | Unveränderter repräsentativer Welt→20m→Welt-Ablauf, echte Zwischenalpha-/Folgegesten, reguläres Commit/Escape/Undo, sichtbarer Effekt und erste Draftreaktion inklusive Initialisierung.30 vollständige vergleichbare Versuche, p95≤100ms, geladene Navigation gegen33,3ms; Messvertrag und tatsächliche UHD620-/Bild-/PackedScreenbindung gelten. | Frühere30–60min+15–20min Review sind unvalidierte Planannahmen, kein abgeschlossener Laufzeitbeleg. Start nur nach gebundener Startreife und expliziter Rootfreigabe. |
| Restliches E und abschließendes F / E-Owner, danach F-Owner | S3–S6 gemäß vollständigem Vertrag oben beheben; tatsächliche berührte Hardwareübergänge danach gezielt nachprüfen. Finales E/F und spätere Liefergates bleiben Pflicht. | Ursprünglicher Gesamt-E-Ownerbedarf90–150min inkl Checks plus15–25min Review lässt sich nicht proportional auf Rest S3–S6 herunterrechnen; nach S1/S2 konkretisieren. |

### E — Fortschritt bei fortlaufender Eingabe und Kameragrenze

**Aktuell 11:07 UTC: E-H1-Produktstand nach erstem negativen Klassenfall eingefroren.
Ein Vor-Up-Draw statt zwei. Kein weiterer Produktfix oder 300-ms-Retry; nur noch
ausstehende Mindestprüfungen und unabhängige Diffnachprüfung laufen. Auftrag und
Belege unten, Termine im [Plan](../plan.md#nächster-integrierter-produktnachweis).**

Die folgenden S7-/S8-Verträge beschreiben den bereits geprüften Stand, keine neue
Umsetzungsfreigabe. Aktuelle native Belege und Entscheidung stehen weiter unten. Der unabhängig gebundene0105-Freeze
bestätigt zwei weitere konkrete Grenzen. S7: laufende gültige Eingabe kann jeden
A-Replay vor Installation invalidieren; beobachtet20s ohne Draft bei1644Jobs.
S8: wachsender Draft kann vor einer Kamerafreihaltung über Auge/Nahbereich wachsen;
„kein Durchtauchen“ bleibt Produktpflicht. Der negative Pickerwert allein ist
kein numerischer Pickerfehlernachweis, der tatsächliche Ray wurde nicht geloggt.
Escape/UndoRedo sind im selben Freeze separat unabhängig positiv übernommen.

**S7-Ergebnis/Owner/Quellen:** Derselbe `tw06_boundary_implementation`
(gpt-6.1-sol/high) korrigiert echten wiederholten sichtbaren Fortschritt WÄHREND
fortlaufender Eingabe, anschließend exakte letzte Dosis/Write/Receipt/Undo.
Eingaben: S1/S2-Stand4e6c, akzeptierterCompletion20dada, Vierfallfreeze0105 samt
unabhängigem Ursachenentscheid. Kein langsamerer RAF, Stillhalten, Verwerfen
angenommener Eingabe, Syncfallback oder zweiter Owner/Worker/Queue.

**Kleinster kohärenter S7-Vertrag:**

- `terrain-author-state.ts`: Aktualität von Capture-Gültigkeit trennen. Ein
  unveränderlicher Replay darf bei weiteren reinen Updates derselben aktivenID
  fertigwerden. Quelle/Token/Fence/Revision,Owner/Serie,Operation/Fenstergeneration,
  kanonischerPrefix/exakter immutableSuffix und aktiveIdentität/Closingzustand
  bleiben harte Grenzen. Begin/Close/Escape/Window/Ack/Unknown/Retire invalidieren
  weiterhin. `refresh` gibt nach einer gültigen Installation deren tatsächliche
  Captureversion zurück, statt auf dauerhafte Eingaberuhe zu warten; neuere
  Desired-Eingaben bleiben erhalten. Kein Umetikettieren zur neuesten Version.
- `atlas-terrain-prepared-session.ts`: Einen Previewzyklus von immutableReplay
  über Installation und genau einen Draftsubmit bis zum tatsächlich gebundenen
  Fieldabschluss besitzen. Neue Updates werden weiter in A.desired angenommen,
  nur neuestes Folgebegehren halten. Danach jüngstes Begehren bearbeiten; letzte
  Close-Enddosis exakt nachführen. Alte Callbacktokens dürfen nach BeginB/Escape/
  Source/Dispose keinen neuen Zyklus öffnen. Bestehende ApplyCancelrennen bleiben.
  Der Zyklus endet am gebundenen tatsächlichen Fielddraw plus Client-settled,
  nicht erst am180ms-Alpha1-Endframe; während aktiver Geste bleibt Morph gefroren.
  Nach asynchroner Capture-Rückgabe exakt diesen immutableSnapshot samtVersion
  verwenden, nicht später erneut A.snapshot als vermeintlich denselben lesen.
- `atlas-terrain-model-client.ts`: Nur eng gebundener lokaler Fieldabschluss aus
  bestehenden settled/cancelled/discarded-Pfaden, kein neuer Wiretyp/Scheduler.
  Cancel ist kein erfolgreicher Settle. Epoch/Job/Operation/Capture exakt binden,
  damit ein legitimer Checkpoint-Supersede kein Previewpermit hängen lässt.
  EinFlight/einLatest/Replaypriorität und Retainvertrag bleiben. Auch nie
  dispatchte, ersetzte oder durch discardFieldLatest entfernte Fieldaufträge
  brauchen einen lokalen terminalen Abschluss; Replay-discarded darf dagegen
  keinen Fieldzyklus beenden.

Schreibbereich ausschließlich diese drei Produktdateien und vorhandene
`tests/terrain-stroke-queue.test.mjs`, `tests/atlas-terrain-prepared-worker.test.mjs`,
`tests/terrain-commit-display.test.mjs`. Root allein gemeinsame Docs; Kamera-/
Surface-/Raster-/Shader-/Main-/Storageänderungen aus S7 nicht freigegeben.
Weitere Pfade vor Edit begründen. Der abgegrenzte Kameraentwurf ist kein Auftrag
zu Nebenänderungen in diesen Tests.

**Entscheidender Beleg und Grenzen:** Gehaltene Replayantwort erst nach mehreren
angenommenen Updates freigeben; Eingabe läuft weiter, tatsächlicher Screen muss
vor Pointerup entstehen, anschließend wiederholt Fortschritt und exakte neueste
Enddosis. Der8ms-A/B-Ablauf bleibt unverlangsamt. Aktiver Fortschritt darf keine globale
`!client.flight`-Ruhe verlangen, weil bereits ein korrekt nachfolgender Auftrag
laufen darf. Exakten Fieldabschluss und tatsächlichen Screen belegen; volle Ruhe
erst nach Pointerup/Cancel mit exakter Enddosis. Negative Owner/Window/Source/
Close/Escape/Recovery-/Latecallbackfälle, vorhandene S1/S2-Grenzen und ApplyCancel
gezielt erhalten. Betroffene vorhandene Tests/Typchecks und gebundener Fixdiff;
kein breiter neuer Testsuitebau. Höchstens ein Previewtoken/Folgebit und ein
borrowed immutableSnapshot, keine numerische Zusatzpipeline. Ein länger gehaltener
Snapshot kann echte Wholebuffers zusätzlich halten: diese für F vollständig
konservativ einordnen, nicht unbelegt als Alias abziehen.

**S8-Plan unabhängig übernommen; Rootstart08:41:**

Ergebnis: gehaltenes Raise darf über die ursprüngliche Augenhöhe wachsen; Auge
und Nearfläche bleiben über dem Gelände. Reale weitere Mausbewegung funktioniert,
stationäres Halten behält Weltpunkt/Zeitdosis, ein Commit bleibt ein Undo-Schritt.
Eingabe ist der gebundene S7-Freeze79be. Dessen Nachreview fand ein enges
C-Terminalproblem vor Flightanlage; der S7-Owner korrigiert ausschließlich Client
und Worker-Test. Der Review sieht darin kein Hindernis für getrennte S8-Arbeit.
Root startet S8 deshalb unabhängig, mit expliziter paralleler Quellenbindung und
exklusivem S8-Schreibrecht am Integrationstest. Der bisherige Kamera-/Pickerbefund
wird mit der normalen Raise-Fixture geprüft, ohne Ausweichpose oder Minidosis.
Owner ist ein Implementierer mit Surface-/Kamerakompetenz, vorgesehener
`camera_sculpt_plan` (gpt-6.1-sol/high). Root allein schreibt gemeinsame Docs.

Schreibbereich: `atlas-deck-surface.ts`, `atlas-mesh-ray.ts`,
`atlas-metric-camera.ts`, `atlas-raster-presentation.ts`,
`atlas-camera-navigation.ts`; gezielt vorhandene Surface-/Prepared-Ray-/Navigation-
Tests und nach S7-Freigabe `tests/terrain-commit-display.test.mjs`.
Keine Änderung an A/Session/Client, Brushkern, Writer, Quelle oder Prepared-Wire.

- Surface bestimmt Morphalpha einmal vor dem kommenden Frame als Float32.
  Freihaltung, Uniform, Pick und Screenproof verwenden genau diesen Wert.
- Tatsächliches Auge und vier Near-Eckpunkte bestimmen XY-Box Q und niedrigste
  physische Höhe zmin. Vorhandenen Prepared-XY-BVH gegen Q traversieren;
  überlappende Dreiecke gegen Q clippen. Aus tatsächlicher Vertex-/Alpha-/Origin-
  Evaluation und linearer Dreieckshöhe das Maximum H auf der Schnittfläche bilden.
  Reiner Höhenlift `max(0,H+margin-zmin)`, keine Änderung von XY/Zoom/Orbit,
  kein automatisches Zurücksinken. Finale Origin-/Rundungsauswertung muss vor
  Veröffentlichung die sichere Postcondition erfüllen. Begrenzte Iteration;
  nicht endliche/ungesicherte Rechnung stoppt über normalen Fehlerpfad, letzter
  bestätigter Screen bleibt. Geometrielücke ist keine Höhe null.
- Ein enger lokaler aktiver Inputtoken entsteht nur bei normaler
  `preparedInputUsable`-Freigabe. Surface liefert synchron Treffer samt dem
  zuletzt wirklich bestätigten passenden Frame/Feld/Alpha/Rayindex. Bei ausstehenden
  neuen Props bleibt das alte sichtbare Paar maßgeblich, erst nach Draw das neue.
  Quelle/Basis/Epoch/Editserie/Surfacegeneration begrenzen Gültigkeit;
  Ende/Invalidierung/Kontextverlust/Dispose beenden sie. Neue Gesten und allgemeine
  GPU-Picks behalten ihre Gates. Keine zusätzliche Bildhistorie oder Feldkopie.
- Raster nutzt bei laufender Geste dieses Paar statt eines unabhängig gefrorenen
  Kamerarays. Effektive Sicherheitskamerahöhe synchron zurückmelden, ohne rekursiven
  Publish/Load/Prepare. Session.frozen, ursprüngliche StrokeVisibility und alle
  angenommenen Samples bleiben unverändert. Kameralift erzeugt keinen Pointer-
  oder Authorsample; stationäre RAF-Dosis bleibt am angenommenen Weltpunkt.

Konkretisierte Grenzen nach Review: Schutz gegen sämtliche tatsächlich aktiven
Drawdreiecke des kommenden Frames einschließlich Übergang/Endframe; unsichtbar
gehaltene Vorgänger zählen nicht. Teilweise fehlende Schnittgeometrie ist keine
Kollision, ausdrücklich kein Ersatzwert null. Kanonische Vollabdeckung von Q
ist keine Startpflicht dieses Framevertrags; kein neuer Lade-/Coveragepfad.
Fehlende erwartete Fielddaten bleiben über bestehende Validität Fehler. Jedes
neue Feld, jeder Draft/Morph/Restore wird vor seinem ersten Draw geprüft.

Einheitlicher lokaler Renderraum mit tatsächlichen Float32-Uniforms und derselben
Vertexarithmetik einschließlich HeightPair/Exaggeration; Renderlift genau einmal
in physische focusHeightM umrechnen. Mindestabstand physisch
`max(.05,width*1e-6)` ist separat von konservativen Rundungsgrenzen. Der eng lokale
Helfer bildet obere Terrain-/untere Neargrenzen und aufgeweitete XY-Box aus seinen
tatsächlichen Operationen; numerisch unentscheidbares Clipping nutzt konservativ
die ganze Dreieckshöhenhülle. Keine allgemeine Intervallbibliothek. Finaler
Origin/Frame erneut, höchstens vier Auswertungen im Publish, danach terminaler
bestehender Fehlerpfad. Alpha/Field bleiben währenddessen unverändert.

Token bindet aktive Geste, Session/Author, Surfacegeneration, Basis/Epoch/Serie.
Eigener früherer Ack während B invalidiert ihn nicht durch Startfencevergleich;
vorhandene A/E-Klassifikation bleibt Autorität, legitimer älterer kumulativer
Screen bleibt nutzbar. Ende bei Up/Cancel/Escape/neuer Geste, Fremdsource/Owner,
Contextloss/Dispose und nicht sicherheitsbedingtem XY/Zoom/Orbit/Viewportwechsel.
Reine Drafts/Safetylifts erhalten ihn; synchron aktuellen Draw lesen, keine neue
Retention. Alte Callbacks können neue Geste nicht verändern. Zusätzlicher enger
Beleg: Q teilweise außerhalb Field, später neu eintreffendes hohes Dreieck vor
Draw gesichert, eigener Ack während B. BVH-Besuche/Dreiecke/Zeit pro Publish
im lokalen Beleg ausweisen; kleine Scratchlisten allein belegen keine CPU-Grenze.

Entscheidender Beleg: unveränderte normale Raise-Geste über alte Augenhöhe,
sichere kommende Draws, anschließende echte Mausbewegung, beide Picker/Cursor am
bestätigten Feld, vollständige Dosis/Write und genau ein Undo. Gezielte vorhandene
Tests: schmaler Grat zwischen Near-Ecken, Neigung 0/45/75°, Höhenüberhöhung,
ferner positiver/negativer Origin, Zwischenalpha, pending alter/neuer Inputscreen,
Quellen-/Kontextinvalidierung, Escape/Folgegeste/UndoRedo. Betroffene Typchecks;
Build/Native bleiben beim späteren F-Auftrag, kein doppelter Buildlauf.

Ressourcen: vorhandener BVH, zwei kleine wiederverwendete Polygonlisten mit
höchstens sieben Punkten und Traversalstack; keine neuen Feldbuffer/GPUbanken/
Worker/Retainowner. Referenzen bleiben am vorhandenen bestätigten Drawbesitzer.
Rechenzeit und kleine Halter für F erfassen. Aufwand ab tatsächlichem Start:
30–45min bis geometrischem und integriertem Raise-Beleg, weitere35–55min für
betroffene Grenzen/Checks/Freeze,15–25min Nachreview. Erster entscheidender S8-Beleg nach Start08:41 spätestens09:26.
Der parallel korrigierte C-Terminalpfad wird vor gemeinsamer Abnahme nachgeprüft;
10:00 bleibt gemeinsame Entscheidung und keine Fertigzusage. Neue Widerlegung,
fehlende Abdeckung oder Scopewachstum sofort Root, keine verdeckte Fixserie.

**S8-Finalfreeze09:09, enge Nachprüfung läuft:**
`.build/terrain-water-p/tw06-p-s8-20261027/manifest.json`, SHA256
`a4a6e9868868db556c1ed9aa9750402208d8a8bac37df2b07ea8f5bb55c91404`,
51 Artefakte/11.469.230B und Livequellkopien durch Root geprüft. Fixpatch
`8118223dcab2a94fa69783539c6b9191e36f105464d7a6f376f7ede74c9f6ee0`.
Fünf Produkt-/vier bestehende Testdateien;71Grenzfälle, fünfIntegrationsfälle,
beide Typprüfungen positiv. Finaler Heldbeleg: Gelände452,959m gegenüber altem
Auge288m, Near455,395m, weitere reale Pointerprojektion, alle51Endsamples exakt
im einzigen Writerauftrag und unabhängiger kanonischerHash. OwnAckinB, normale
Picker/Cursor, Escape/Folge, Fremdquelle und UndoRedo positiv.
Erster negativer Versuch hatte nur konvergierende Rundungsschranke; positive
Reserve aus tatsächlicher Hülle korrigiert, Vierergrenze/Fixture/Kamera unverändert.
Eine widersprüchliche neue Escape-Token-Testannahme wurde an den bestehenden
Vertrag angepasst. Beide negativen Logs erhalten. Keine versteckte Retryserie.
Zusätzliche Skalare/Matrizen/Intervalle/Scratchlisten, keine Feldbuffer/GPUbank;
Ressourcenzähler im Handoff. LetztesPublish51Visits/32Dreiecke/2,32ms,
beobachtetesMaximum11,45ms lokal unter Nebenlast, keine Leistungsgarantie.
S7-Parent79be und parallelesTerminaldelta93bfa4 ausdrücklich gebunden.

Root autorisiert09:10 den alleinigen F/Gate-Owner für seriellen normalen und
Desktopbuild dieses unveränderten Stands, parallel zum lesenden S8-Nachreview.
Quellen vor/nach und13Runtimehashes binden; keine weiterenTests oder Produktedits.
Dies ist keine Nativefreigabe. Bei Sourceänderung/Buildfehler stoppen; ein
notwendiger Reviewfix verlangt neue Buildbindung. Keine Wiederholung ohne Anlass.
Der Build ist abgeschlossen: `serial-build-20261027-0910/MANIFEST.json` unter
`.build/terrain-water-p/tw06-p-early-ui-check-20261027/`, SHA256
`7fcdbc1984c6f51b00f4711bdefc3833996472b6c3e6dba5500176c80112a5f4`.
21 Artefakte/17.208.357B,13Live-Runtimes und935aktuelle Quellen Root-geprüft;
Node22.22, normalerBuild0,80s und Desktopbuild3,52s, jeweilsExit0.

S8-Nachreview abgeschlossen: Normalablauf/Drawliste/Numerik/Token/Belege sind
akzeptabel für den repräsentativen Bediencheck. Ein enger offener Befund:
`atlasMetricClearanceVolume`/`heightEnvelope` können vor Publish werfen; bei
setCamera/Animate-RAF läuft diese Ausnahme nicht überall durch Surface.fail.
Vierergrenzenabbruch ist korrekt, aber die umfassende Terminalbehauptung fehlt.
Kein beobachteter Normalfallauslöser, daher kein pauschales Hindernis des isolierten
Bedienchecks. Root autorisiert09:14 genau einen Lauf auf unverändertem Stand,
mit13GiB-Scope/frischerReserve/Prozesscoverage und echtenBild-/Writebelegen.
Jede Exception oder fehlender Draw stoppt negativ. Keine Quellkorrektur parallel;
danach derselbe S8-Owner zentraler fail+throw-Abschluss plus ein vorhandener
Fehlerfall. Keine Numerikneugestaltung oder allgemeine weitere Grenzfallrunde.

Erster nativer Startauftrag kam nicht bis zur App: User-systemd-Scope inaktiv,
ControlGroup leer, externer Monitor nach10s gestoppt; kein privaterKWin/Electron/
Input oder Produktversuch. Lesend bestätigt: Usermanager verzögert, siebenJobs
waiting, eigeneScopeStopanforderung ebenfallswartend. Keine fremdenJobs ändern.
Direkter bestehender Delegationsweg ist unter
`/sys/fs/cgroup/user.slice/user-1000.slice/user@1000.service/app.slice`
benutzereigen/beschreibbar, memory-Controller bereitsfürChildren aktiviert,
keine direkten Prozesse. Root autorisiert09:20 genau einen eigenen temporären
Child mit13958643712B memory.max: neuerLauncher verschiebt nur sich selbst und
startet danach privatenDBus/KWin/Harness. Tatsächliche Rechte/Cap/Zugehörigkeit
vorApp, bestehendeKind-/Host-/Framechecks vorEingabe. Externer direkter Monitor,
180sWallgrenze, Schutz-/Produktfehlernegativ, keineAutoRetries. Nur eigeneChild-
Nachkommen beenden und leerenChild nachBelegsicherung entfernen. Globale
Manager-/Controller-/Hostkonfiguration und fremdeProzesse bleiben unverändert.

Der direkte Lauf ist gebunden unter `native-direct-20261027-0920/EVIDENCE-MANIFEST.json`
im Bediencheck-Verzeichnis, SHA256
`ba0bba14c44ec272a2201c9dbfebf94d2deb364374863e3d9cc6f2fbbb4e4239`;
46Belege durch Root verifiziert. UHD620/1920×1080/20m/45° und effektiver13GiB-Schutz
funktionierten; Peak1.704.022.016B, keineMemoryevents, privaterChild geleert/entfernt.
Abbruch vorDown an `surface.pick=null`, keineGeste/Commit, Revision44/Hashgleich.
Root sieht auf beidenScreenshots tatsächlich Terrain amStartpixel.
Additiver Ursachenbeleg SHA256
`2afcc65d8f9f994c915579ecf0be961b6ee90544a19e58f937f38fb83eb1c2ad`
korrigiert die Interpretation: surface.pick verlangt allgemeineGPU-Objektselektion;
der normalePinsel nutzt preparedInputUsable/frame.ray/terrainRay. Somit falscher
zusätzlicher Harnessvorcheck, kein belegter Produkt-Brush-Nullhit. Der allgemeine
Objektselektionsnull bleibt separat offen. Root autorisiert09:29 beideToolchecks
auf echtenPinselpfad plus konkreteGate-/Raydaten beiNull umzustellen, Syntax/
Quellbinding und danach genau einen neuen identischen geschütztenLauf. Keine
Kamera-/Dosis-/Produktänderung, keineAutoRetries. Alle altenBelege bleiben.

**Erster tatsächlicher nativer Brushcheck 09:31: negativ.**
`native-direct-product-ray-20261027-0931/RUN-EVIDENCE-MANIFEST.json` unter dem
Bediencheck-Verzeichnis hat SHA256
`60edcdec694487816054b5e284a6abea8516c9e07f152580c036a693da42b449`;
46 Dateien von Root geprüft. Der additive Manifest-/SQLite-/Fehlerbeleg
`RUN-ADDITIONAL-MANIFEST.json` ist ebenfalls vollständig hashgeprüft.
40/40 Main-Ereignisse gesendet; Renderer nimmt Down, vier zusammengefasste Moves
und Up über359,8ms an. 52 Pickspuren insgesamt, davon47 während der Geste mit
177,9ms Arbeit, aber null `prepared.draft.dispatch` und null bestätigte Draftdraws
vor Up. Pickarbeit beweist keinen Workerfortschritt. Kein allgemeiner GL-Drawzähler.
Revision44→45/kanonischer Hash ändern sich, danach sind die Werkzeuge schon vor
Harnesscleanup blockiert: „Terrainworker beendet.“. Keine zweite Geste, kein
Funktionspass. Unterschiedliche History-/Receipt-IDs sind vorgesehen: Gesten-ID
gegenüber äußerer Command-ID. Der vollständige unabhängige Dosis-/Receiptbeleg
fehlt weiterhin. Peak1.661.562.880B, keine Memoryevents; eigener Child geleert und
entfernt. Produktstand unverändert zum Build7fcdbc.

Lesende Produktdiagnose 09:37–09:44, keine Edits/Läufe: Dispatch erfolgt erst nach
`author.refresh()`. Ob SQL-Read oder Replay noch läuft oder fehlschlägt, ist nicht
aufgezeichnet. „Terrainworker beendet“ stammt aus bereits gestopptem Client bzw.
Dispose-Reject; Raster.blocked folgt Retirement bei gehaltenem Journal. Normaler
OwnAck schließt den Client erst nach Queue-/Checkpointabschluss und erklärt diese
Kette nicht. Ein vorheriger Fehler kann durch die spätere Meldung verdeckt sein;
die erste Fehleridentität bleibt offen. `failure.errors=[]` erfasst nur pageerror
und entlastet den über console.error/UI gemeldeten Produktpfad nicht.

Zwei Harnessfehler bleiben separat: `moves>=8` ignoriert Ereigniszusammenfassung;
`continuousAttempt.point(t>240)` liefert bei findIndex=-1 den ersten Punkt statt
des Endpunkts. Frühere Behauptung „Endpunkt gehalten“ ist damit widerlegt.
Root autorisiert09:46 denselben Nativeowner ausschließlich für beide Korrekturen,
Erfassung des ersten originalen Raster.fail vor stopModels mit Zeit/Stack und
vorhandener A/Session/C-Diagnostik sowie genau einen neuen identischen geschützten
Lauf. Keine Produktänderung/neue Messpipeline, keine schwächeren Draw-/Speicherkriterien.
Vorherige Belege erhalten, Quellen/Runtime vorher verifizieren. Ergebnis bis09:56;
keine automatische Wiederholung oder Verlängerung der gemeinsamen10:00-Grenze.

**Gezielter Erstfehlercheck09:47 und Rootentscheid09:51:**
Toolfreeze `first-error-tool-fix-20261027-0946/MANIFEST.json`, SHA256
`3f2e104f050d238f12174df534e5b06ad962122dacd55877e77cff72fa5868ae`,
fünf Dateien/53.423B; `native-direct-first-error-20261027-0947/RUN-EVIDENCE-MANIFEST.json`,
SHA256 `3430045ea35edee5466982864504162eac9d99ac28dd6aa748a89724829e7c78`,
51 Dateien/8.940.741B, jeweils vollständig Root-geprüft. Zwei Harnessfehler
korrigiert; Produkt935Quellen/13Runtimes zum Start unverändert. Main40/40,
vier trusted DOM-Moves,0Draftdispatch/-bilder, Revision44→45. Erster Fehler
bei35984,6ms,112,2ms nachUp: `Uncaught TypeError: Illegal invocation` im
Prepared-Worker-Error-Event. Stack zeigt Client.port.onerror, ursprüngliche
Workerdatei/Zeile fehlen. UI zur ersten Consolemeldung ready; danach failed/
blocked. Die Consoleaufzeichnung ersetzt keine direkte Vor-stopModels-Sonde.
Fehlender Vor-Up-Dispatch ist durch einen erst nachUp erfassten Crash noch nicht
erklärt. Scopepeak1.638.375.424B,455Monitorwerte,keineMemoryevents,Child entfernt.

Konkreter Quell-/Runtimebefund des Produktowners: Workerconstructor78 speichert
`cancelTimer=clearTimeout`; receive81 ruft `this.cancelTimer` mit falschem
Browserempfänger auf. Catch105→failure155 wiederholt denselben Hostcall, der
zweite Throw entkommt. schedule/post sind bereits Wrapper. Tests mit No-op-
Cancel bzw. Node-Timern verdecken diesen Browserdefekt. Root autorisiert genau
den Defaultwrapper `timer=>clearTimeout(timer)` und einen bestehenden C-Test
mit receiverprüfendem Timerhost für laufenden Cancel und Fehlercleanup, plus
betroffenen Typcheck. Keine sonstige Produktänderung. Freeze erwartet10:03,
dann gezieltes Nachreview/serieller Build/ein geschützter Nativecheck.
Neue gemeinsame Grenze10:25 explizit entschieden:21–35min für diese gesamte
Kette, getragen durch konkrete neue Evidenz. Alle bisherigen Negative und
Laufzeiten zählen weiter. Bleibt fortlaufendes Malen negativ, keine weitere
Kleinreparaturserie; Root bewertet den Berechnungsablauf grundsätzlich.

Timerfix-Freeze09:54: `.build/terrain-water-p/tw06-p-worker-timer-fix-20261027-0951/manifest.json`,
SHA256 `604b3398af326fbac89bf0882ca8082f7d8863afdd263ffc5b8f9d73a4e8f7b4`,
16Artefakte/1.632.058B Root-geprüft. Delta
`a2a47b3b7835bd04f2b05c03838adc0fc9807661f2d9a0a8cbd0ee1cc842c90c`.
Gleicher receiverprüfender Test vor Fix negativ mit Illegal invocation in
failure→receive→replaceLatest, nach einzigem Wrapper positiv1/1; isolierter
Worker-Typcheck positiv. Laufender Cancel und Fehlercleanup räumen Timer jeweils
einmal sowie Basis/Reserve/Registry ab. Vorhandener Capabilitylink samt geprüftem
Einzelfall gepflegt; keine native Workflowabnahme. Produktworker4143c389 und
Testfca93b26 im Manifest gebunden;916Quellen laut Owner ohne Drift.
Unabhängige enge Delta-Nachprüfung akzeptiert denselben Fix/Regression/Typbeleg;
kein offener Befund im Timerfixbereich. Beide seriellen Builds positiv, neuer
Freeze `serial-build-timer-20261027-1003/MANIFEST.json` im Bediencheckverzeichnis,
SHA256 `fa8cd8a74c7768d4d5429c7e453766a09fe298b96c8cade240028d11147a5b42`.
25Artefakte/17.311.033B plus13Live-Runtimes/935Livequellen durch Root geprüft.
Nur Workerproduktquelle und zugehöriges Workerbundle02c8280f gegenüber vorherigem
Build verändert. Verzeichnis1003 ist Planlabel, tatsächlicher Handoff09:57.
Root autorisiert danach genau einen identischen geschützten nativen Bediencheck
mit unverändertem korrigierten Harness605bbc89. Keine weiterenEdits/Proben/Retry.
Nativewirkung und Vor-Up-Draftbilder bleiben bis zum Ergebnis offen.

**Native Rückprüfung09:58–09:59: Timerabbruch weg, Bedienablauf weiter negativ.**
`native-direct-timer-20261027-0958/RUN-EVIDENCE-MANIFEST.json` im Bediencheckverzeichnis,
SHA256 `a3184e33904ded4889b1d29ab9a0ab0a9dbed420a4243840bdb773f184b64dfa`,
51Artefakte/8.906.756B von Root geprüft. Keine Produkt-/Tooländerung;935Quellen/
13Runtimes gebunden. Main40/40, RendererDown/vierMoves/Up über325ms. FirstErrors
leer, UIready und später „Gespeichert“. Null gebundene Draftbilder während
Bewegung. Receipt45 bei36231,2ms, erster Draftdispatch erst36480,9ms, Up35730,7ms.
Keine zweite Geste/kein Bedienpass. Speicheränderung belegt, unabhängige spätere
Commitreferenzbindung nicht erreicht. Peak1.740.460.032B,431Monitorwerte,keine
Memoryevents,Child entfernt. Alle ursprünglichen Rohdaten/Bilder/SQLite erhalten.

Root stoppt10:00 jede weitere angrenzende Kleinreparatur. Neue frische unabhängige
Technik-/Architektur-Ansatzprüfung nach reviewed im Chat
`01a17cce-aa23-7570-82bf-d72e4e265e36`, keine Edits/Builds/Läufe. Frühere Timerfix-
Nachprüfung bleibt akzeptiert; S8-Terminalhelper/S3–S6/F weiterhin offen. Gefragt
sind tatsächliche Arbeit und Besitzer zwischen Input→Refresh/Replay→Draftdraw,
begründete Behebung versus Vereinfachung mit Gesamtkosten und kleinster
entscheidender Untersuchung bei fehlender Evidenz. Ergebnis bis10:15 innerhalb
der unveränderten10:25-Grenze. Kein Plan-/Scope-/Kriterienwechsel durch Reviewer;
Hauptchat entscheidet und plant betroffene Pakete nach.

**Frischer Ansatzreview, erster Entscheid10:09:** Korrektur nötig, konkrete
Hauptzeitursache noch nicht ausreichend geprüft. Einpunktstart erzeugt null
wirksame Dabs, startet aber Preview mit initialem Authorread und erneutem
Seedread, Visibility/Brush und allen65²Groundwerten je Lattice. Session hält
weitere Previewarbeit bis Draw+Settle hinter dieser Runde. Close invalidiert
den aktiven Capture strukturell. Lokaler S7-Livenessfall beginnt dagegen mit
zweiSamples t0/t1000 und wartet bis Fortschritt vorClose; kein Nachweis des
nativen Einpunktstarts/300ms-Durchsatzes.47Picks/153,1ms und Rawbaseline30,1ms
sind Rendererarbeit, nicht automatisch Workerursache. Fehlender Dispatch
lokalisiert die erste Verzögerung vor Fieldpack/GPU/Draw. Authorread ist lokale
Band-/Latticeabfrage, kein belegter Full-DB-Scan. Bei32Lattices enthält ein
Ground135.200Doublewerte/1.081.600B; Seed liefert/validiert Ground erneut, obwohl
Replay anschließend dessen Seiten nutzt. Quelle/Arbeitsweg belegt, Zeitdominanz offen.

**E-Diagnose — begrenzter Auftrag zur Ansatzentscheidung, Rootstart10:15 nach Planübernahme:**
Die unabhängige Technik-/Architekturprüfung akzeptiert die engere Beobachtung.
A-/Store-/SQLinterne Instrumentierung entfällt;75–90min-Vorschlag verworfen.
Ergebnis ist genau eine gebundene skalare Zeit-/Arbeitsbilanz desselben ersten
300ms-Zugs und eine begründete Entscheidung zwischen Read-/Seedwiederverwendung,
Reduktion tatsächlicher Replayarbeit und Ablauf-/Schedulingkorrektur. Ein großer
unerklärter Rendererrest bleibt ausdrücklich offen, kein erzwungener Sieger.
Kein Produktpass, keine Optimierung, kein Gesamtrewrite aus diesem Auftrag.
Eingaben: Timerfix604b3398, Buildfa8cd8a7, negativer Nativefreezea3184e33 und dessen
unveränderte Pose/Dosis/Pfad-/Schutzhülle. Alle bisherigen Negativbelege erhalten.

- **E-D1, Workeraggregate:** `tw06_boundary_implementation`, gpt-6.1-sol/high,
  allein `src/app/atlas-terrain-model-worker.ts`. Opt-in skalare Zusammenfassung
  pro vorhandener Epoch/Job/Capture: Eingang vor Validierung, aktive synchrone
  run-Zeit/Chunkzahl, enqueue→run-Wartezeit, Seedwartezeit, Ergebnisversand oder
  Cancel/Fail mit Grund/letzter Phase. Auch abgebrochene Jobs erfassen; nach
  Ergebnisversand bis Settle getrennt. Keine neue Wireart, kein Zahlenbuffer,
  keine per-Sample-/per-Yield-Ausgaben, keine Verhaltens-/Schedulingänderung.
  Bestehender Consolekanal; Aktivierung/Collection mit E-D2 einmal abstimmen.
  Enger Typ-/Diffcheck und gebundener Freeze; keine produktiven Builds oder Runs.
- **E-D2, vorhandene Toolgrenzen:** `early_gate_feasibility`, gpt-6.1-sol/high,
  nur bestehende `tools/test-desktop-terrain-water.mjs` und falls nötig
  `tools/terrain-water-replay.mjs`. Workerwrapper vor Appstart: bidirektional
  send/receive, Zeit auf Rendereruhr, Kind/Epoch/Job/Capture/Queryrequest,
  Samplecount/letztes t/Closing/Source/Prefix. AddEventListener statt Ersatz des
  Produkt-onmessage, unverändertes super.postMessage, keine Payloadkopien.
  Vorhandener Main-IPC-Wrapper für `atlas:author-checkpoint`: lokale Dauer,
  Queryidentität, Outcome, Seiten-/Groundcount und Bytes. Keine A-/Storeedits.
  Zeit bezeichnet gesamten Readservice, keine behauptete reine SQLzeit.
  Vorhandene Down/Up/Pick/Draw/Receiptspuren weiterverwenden; nur Skalarbelege
  sichern. Enger Syntax-/Diffcheck und Freeze; erst nach E-D1-Bindung weiter.
- **E-D3, Integration und genau ein Lauf:** E-D2-Owner allein nach beiden
  Quellfreezes und Rootübernahme: serielle Builds, vollständige Quellen-/Runtime-
  Bindung, vorhandener13GiB-Childschutz und externer Monitor. Identische erste
  Geste, keine Pause/Minidosis/verlängerte Eingabe, kein Auto-Retry. Diagnose
  verändert weder Draftbild- noch Speicherkriterium; fehlende Bilder bleiben
  negativer Funktionsbeleg. Workerzeiten lokal, IPCzeiten lokal, Ereignisse im
  Renderer kausal über IDs korrelieren. Keine Subtraktion fremder performance-
  Uhren, keine Addition überlappender Reads/Seedwartezeit. Root prüft Bindungen,
  der frische Reviewer prüft anschließend nur Schlussfolgerung/Aussagegrenzen.

Ausgabeort: `.build/terrain-water-p/tw06-p-phase-diagnosis-20261027/`, mit
getrennten `worker/`, `tools/`, `build/` und `native/`-Freezes. Jeder Owner bindet
Before-/After/Diff und Checks im eigenen Manifest; Nativeowner verknüpft diese
im finalen Handoff mit der skalaren Bilanz und dem tatsächlichen Rohdatenpfad.
Alte Ergebnisse nicht überschreiben. Der unabhängige Ablagereview hat Auftrag,
Zuständigkeiten, Reihenfolge und Stopgrenzen akzeptiert.

Aktueller Prüfstand10:22: E-D1 unter `worker/manifest.json`, SHA256
`9a8a65bd47974e560cdc2632987aa70d73459bb5082bac03d4f622a2a73885a1`,
12Artefakte/181.817B; E-D2 unter `tools/MANIFEST.json`, SHA256
`5f0ee89a9fa80956b764b1450ccf9f18e5e866deaa90cea263c702472970b5cf`,
7Artefakte/110.758B. Root hat beide Manifeste/Diffs geprüft; Worker-Typcheck und
Toolsyntax positiv. Opt-in `terrainPhaseSummary=1` mit vorhandener Consolecollection
abgestimmt, tatsächliches Routing erst im Einzellauf belegbar. Beide seriellen Builds sind positiv: `build/MANIFEST.json` SHA256
`30200cc279f10facf7c07f226d4a76a61a7a649d6e579239acba6fc4f0cc5787`,
25Artefakte/17.315.941B sowie13Live-Runtimes/935Livequellen Root-geprüft.
Root autorisiert danach genau einen geschützten nativen Diagnoselauf mit
unveränderten Kriterien. Fehlendes Console-Routing ergibt Diagnoselücke, kein
Auto-Retry; gemeinsame11:00-Grenze bleibt. Alte Reviewkoordination
01a179b3 nach bestätigter Übernahme aller offenen Befunde in den frischen Review
archiviert; keine Sachbefunde dadurch erledigt.

Einziger Diagnoselauf10:24:33–10:25:17 abgeschlossen, funktional negativ:
`native/RUN-EVIDENCE-MANIFEST.json`, SHA256
`f9aff6c7ef0a9a03e888a56c34f80b5bb00e11b580c23b3927191d24de76d95c`,
57Artefakte/9.134.948B Root-geprüft. `SCALAR-BALANCE.json` SHA256
`da6a8252b09f954b53fb62b8512cf25caf4cbc1e7207dc41badd7ed48d3a4b6f`.
Consolekanal funktioniert; keine firstErrors,40/40Main/vierDOMMoves/Up,0Vor-Up-
Draftbilder, keine zweiteGeste. Peak1.709.400.064B/435Monitorwerte,keineTrigger,
Child entfernt. Prepare7 begann vorDown und wurde währendGeste gecancelt:
315,7msaktiveArbeit/467,3msTimerwarte beziehen die ganze Vorlaufzeit ein.
RendererDown35725,9/cancelSend35782,5/Up36070,7/cancelledReceive36168,7;
dieser Renderer-Roundtrip ist keine isolierte Worker-Cancelreaktionszeit.
MainRead1 währendGeste106,8ms,4Pages/23Ground/842.936B; Read2 nachUp178,3ms.
Replay8 erstnachUp,18,1msaktiv/237,1msSeedwarte,abgebrochen; Read3sourcefail246ms.
Replay9 nachCommit41,3msaktiv,Result; Read4 157,4ms. Job10Draft erstnachUp,
kein terminales Summary vorCleanup. Kein beobachteter aktiver Einpunkt-Replay:
alle aufgezeichneten Replays8/9 erstnachUp, t0-Read dagegen belegt.
Aktive/Timer-/Seed-/Readzeiten nicht überlappend addieren; Ursache noch nicht
pauschal einem Anteil zugeordnet. Frischer Reviewer prüft jetzt allein gebundene
Bilanz, Hypothesen und kohärente Richtung; alle Implementierer angehalten.
Schlussfolgerungsreview10:38 beendet. Gesicherter kritischer Übergang:
Client hält Prepare7-flight bis nachUp empfangenem Cancel-Ack; pump bleibt
blockiert. Kein vorUp-Replay. Pageconsole sieht Summary atWall1793096714691,
RendererCancelACKwall5072 derselben Sekunde, Electronconsole5076; nur Indiz für
Zustell-/Verarbeitungsrest, keine fremdeMonotonuhrsubtraktion.47Picks177,5ms in
344,8msGeste plusBaseline30,5ms; UI304/306/342 undUp362/366 projizieren teilweise
identische Events mehrfach. Dieser vermeidbare Aufwand erklärt nicht den ganzen
ACKrest. Enqueuewarte beiCancel kann Cleanup enthalten, keine reineTimerclampzeit.

**E-H — ausführbarer Korrekturauftrag, Rootfreigabe 10:56 UTC:**

Prüfstand: `.build/terrain-water-p/tw06-p-handoff-fix-20261027/negative-first-20261027-1103/manifest.json`,
SHA256 `930c70bbe745b836e258778de8132aa8a486fb6ca812dbe1c7602c04521e6a91`.
Root verifiziert 14 Artefakte/8.252.182 B und 918 aktuelle Quellenbindungen.
Sechs UI-/Seed-/OwnAck-Fälle grün. Fester 300-ms-Klassenfall: früher Cancel,
t0-Skip am passenden Ausgang und tatsächliches ACK vor Replay belegt; genau ein
gebundener Draw mit Settle, Folge-Replay bei Ablauf noch aktiv. Zwei Draws fehlen;
Enddosis/Receipt/Hash/Folge/Escape durch frühe Assertion noch nicht erreicht.
Kein GPU-/Nativepass. Productfreeze, keine Wiederholung und keine weitere
Korrektur. Nur noch nicht gelaufene stationäre/Frührelease/form-/t0-Negativguard-/
Enddosisregressionen und Typcheck bis 11:20 autorisiert; bei Fehler melden, kein
stiller Fix. Fehlender Guardfall darf in vorhandener Testdatei ergänzt werden.
Reviewbefund 11:08: Quell-/Contentbindung belegt während eines kanonischen
Morphs noch nicht vollständige Darstellung. Root autorisiert ausschließlich
`screen.alpha === 1 && screen.endFrame` als zusätzliche t0-Bedingung und deren
negative Guardregression. Keine weitere Performancekorrektur/Timingwiederholung.
Ergänzungsfreeze erhält ursprüngliche Negativbelege und bindet den sonst
unveränderten Produktstand plus genau dieses enge Reviewdelta. Reviewer prüft denselben Diff parallel auf konkrete frühe
Prüfhindernisse und getrennte Lieferbefunde.

Ergebnis: zwei unterschiedliche bestätigte Draftbilder während desselben
300-ms-Pinselzugs, danach vollständige Dosis/Receipt und unmittelbares Weitermalen.
Die drei Eingriffe sind eine gemeinsame Übergabekorrektur, keine unabhängige
Optimierungsserie. Owner `tw06_boundary_implementation` (gpt-6.1-sol/high) besitzt
Umsetzung und gezielte lokale Prüfung; `early_gate_feasibility` besitzt Builds,
geschützten nativen Lauf und dessen Überwachung. Root besitzt gemeinsame Docs.

Eingaben: aktuelle E-D3-Quell-/Runtimebindung und `SCALAR-BALANCE.json` unter
`.build/terrain-water-p/tw06-p-phase-diagnosis-20261027/native/`; akzeptierte
S7/S8-Normalpfade und Timerfix; bestehende Diagnose-Tools bleiben unverändert.
Ergebnisfreeze unter `.build/terrain-water-p/tw06-p-handoff-fix-20261027/`
mit Source-/Diff-/Test-/Typbelegen; Build und Native in getrennten Unterordnern.

Schreibbereich genau `src/app/atlas-landscape-ui.ts`,
`src/app/atlas-terrain-prepared-session.ts`, `src/app/terrain-author-state.ts`
und die tatsächlich betroffenen vorhandenen Tests:
`tests/terrain-brush-frame.test.mjs`, `tests/terrain-stroke-queue.test.mjs`,
`tests/terrain-commit-display.test.mjs`. Zusätzliche Dateien nur nach konkreter
Rootentscheidung; fremde Arbeit bewahren, keine neuen allgemeinen Prüfgerüste.

1. Height-Move: genau ein lokaler Slot des letzten point-Aufrufs. Nur unmittelbar
   aufeinanderfolgende identische clientX/clientY wiederverwenden; jede andere
   Pixelabfrage ersetzt den Slot. Originale Reihenfolge Endpoint → Coalesced →
   Endpoint erhalten, alle Samples/Zeitstempel behalten. Kein früheren Endpoint
   über dazwischenliegende andere Abfragen wiederverwenden: Raster.point hat bei
   Hit und Miss eine lastPoint-Semantik. Up darf seine beiden unmittelbar gleichen
   Abfragen zusammenfassen. Kein Reuse über Handler, Draw, Kamera oder Quellen-
   wechsel; andere Tools behalten ihren Pfad. Regressionen prüfen ausdrücklich
   Miss → Hit → Endpoint-Miss und Endpoint-Hit → anderer Hit → Endpoint-Hit →
   späterer Miss. Einsparung real zählen; die 177,5 ms enthalten notwendige Picks.
2. Session.begin: vorhandenes fenceUnpainted nach gültigen Surfacechecks,
   Freeze/Escapeaufnahme vor author.begin vorziehen; nur gestarteter Heightzug.
   Client behält Flight bis echtem Cancel-ACK. Preview bei genau einem t0-Sample
   nur ohne form auslassen, wenn der gesamte vorher angenommene Zustand bereits
   belegbar im eingefrorenen bestätigten Screen vertreten ist. Leeres Journal
   allein reicht nach Receipt mit ungezeichneter Enddosis nicht: offenes Journal,
   angenommene Autoren-/Write-/Checkpoint-/Restorearbeit oder fehlende Source-/
   Snapshot-/Screenbindung → normal refreshen. Ein reiner ungezeichneter
   Hintergrund-Prepareflight allein verbietet den Skip bei belegtem vorigem
   Screenzustand nicht; der Flight bleibt bis zum echten ACK blockiert.
   A.begin bleibt sofort, stationäre RAF/Frührelease und Einpunktformen wirken.
3. Ein Rebuild darf beim ersten exakt passenden input.load seinen vollständig
   decodierten Initialcheckpoint wiederverwenden. Source mit Token/Fence/Revision,
   Owner/Serie/Operation/Fenster/Prefix/Receipt/geordnete Lattices/Pixel/Box sowie
   current() müssen passen; erster exakter Hit einer Rebuild-Iteration, Match
   aller kanonischen Queryfelder außer request vor neuer Queryerzeugung.
   Stroke-Objektidentität ist keine zusätzliche Voraussetzung. Ursprüngliche Query unverändert zurückgeben, bei Miss
   normal lesen. Kein installed.ground als kanonische Quelle, kein globaler Cache,
   keine zusätzlichen numerischen Backingstores oder Transferregeländerung.

Prüfung: bestehende Coalesced-/stationäre-/Frühreleasefälle mit unveränderter
Zeitdosis, weniger Projektionen und wirksamer Einpunktform; vorhandene
Read-/Writefälle mit einmaligem Seedreuse und Source-/Box-/Fenster-Misses.
Klassenfall: bestätigter Ausgang, laufendes Prepare, Einpunktstart, feste 300 ms,
kein Replay vor Cancel-ACK, zwei gebundene Drawbestätigungen, danach Enddosis,
unabhängiger kanonischer Hash, ein Receipt und Folgegeste im selben A/C. Ein
kontrollierter Drawanschluss ist ausdrücklich noch kein nativer GPU-Beleg.
Gezielte Typprüfung und Delta-/Ressourcenprüfung vor Freeze; Nativeowner bindet
alle Produkt-/Buildquellen und 13 Laufzeitdateien, führt seriell beide Builds und
anschließend genau den vorhandenen geschützten Bediencheck aus.

Die Hypothese betrifft weniger synchrone Rendererarbeit, früheren Abbruch und
vermiedenen passenden Initial-/Seedread. Sie erklärt nicht den gesamten ACK-Rest;
Reads 1/2 aus E-D3 sind nicht automatisch derselbe vermeidbare Read. Aktive
Draftkosten bleiben offen. Kein Erfolg durch verlängerte Eingabedauer, Minidosis,
Ausweichpose, Sampleverlust oder voreiliges flight=null. Keine automatische
Fix-/Laufserie bei Negativ; gemeinsame Kontrolle und Grenze im Plan.



E-D1 und E-D2 dürfen mit getrennten Schreibbereichen parallel arbeiten.
Anschluss-/Opt-in-Fragen zwischen beiden Ownern direkt klären; keine separate
Tool-/Protokollentwicklung. **Nach20min** müssen die vorhandenen Summarykanäle
nutzbar sein; andernfalls stoppen und konkret fehlenden Anschluss melden.
Eine zusätzliche allgemeine Messpipeline ist nicht autorisiert. Genau ein Lauf,
auch bei unentschiedenem Resultat keine automatische Diagnose-/Fixserie.

Entscheidungsregeln: lange Main-Readservices/Seedwartezeiten→Read-/Seedreuse
prüfen; überwiegende aktive Workerrechnung→Replayarbeitsmenge reduzieren;
kleine beide bei großer Timer-/Cancel-/Queuezeit bzw. gehaltenem t0→kohärenten
Ablauf-/Schedulingfix prüfen. Renderer author-result-Empfang→Draftdispatch
bleibt separat; unbekannten Rest nicht als Workercompute ausgeben. Enddosis,
Write→Checkpoint→Confirm und Folgegeste sind bei einer späteren Korrektur zu erhalten.
Zeitplan/Grenze ausschließlich im [Plan](../plan.md#nächster-integrierter-produktnachweis).

**Aktuelle Reihenfolge nach unabhängigem Fallreview:** S7 und S8 sind zwingende
Voraussetzungen des frühen Gates. Der einmalig vorgeschlagene Lower/Sea250-Fall
ist verworfen: die Fixture hat 247,5–252,5m Gelände; bei 300m/s Senken bleibt über
Sea250 höchstens 8,34ms sichtbare Wirkung. Ein 300ms-Zug senkt 90m. Mehrfache
sichtbare Updates und freie Sicht in den engen Einschnitt sind nicht belegt;
Sea0 allein löst dessen mögliche Verdeckung bei 20° Neigung nicht. Die tatsächliche
Auge-/Nearhülle ist ebenfalls unvollständig. Keine weitere Pose-/Minidosis-Suche.
Die frühere bedingte Erlaubnis für S8 nach dem Gate ist deshalb keine ausführbare
Route mehr. S8-Plan wird konkretisiert und unabhängig geprüft; Produktstart erst
nach S7-Freeze und Reviewübernahme, kein paralleler Schreiber am Integrationstest.
30 originale Samples/100ms/33,3ms/Commit/Escape/Undo/beide Picks/1117 Draws/Schutz
bleiben unverändert.

**S7-Finalfreeze für unabhängigen Ergebnisreview:**
`.build/terrain-water-p/tw06-p-s7-20261027-0802/manifest.json`,
SHA256 `79be6aa41af2faad2fd08f33129124590e63a6eeab1ec118dff6cd61b41081d1`,
53 Artefakte/17.772.244B durch Root hashgeprüft, Livequellkopien gleich.
Fixdiff `c9323b5b7fc957a4795a7d846369ff5c872263385a6a749404c7f8ab067aa6f3`.
Erster positiver Freeze4e543 bleibt unverändert. Final: wiederholte gebundene
Screens bei unverlangsamter8ms-Eingabe, alle33Pointerup-Samples exakt im einen
Writerauftrag, einReceipt, unabhängigerHash, BDraw/lateA/Cancel+Retain positiv.
24A/Queue-, neun verschiedeneC/Owner- und elfIntegrationsfälle sowie beide
finalen Typchecks grün. Der9erGrenzlauf lag vor letztem requested/completed-
Scalarfix; realer NieDispatchDiscard/Progress/Undo danach auf finalem Stand.
Exakte Versionsgrenzen in runtime.json, kein pauschaler Wiederholungslauf.
Zusätzlicher Wholebufferhalter67600B neben33800B neuerA fällt nach terminalem
Release weg; snapshot-owners.json führt Besitz. Kein globalerPeak-/GPU-/Nativepass.
Unabhängiger Nachreview bestätigt A/Session, Progress-/Writerbeleg, alle26
TAP-Metadatenbindungen und die ausgewiesenen Versionsgrenzen. Nur ein konkreter
C-Terminalbefund bleibt:
Ein aus latest abgetrennter Task konnte vor flight-Anlage werfen und blieb vom
fail-Abschluss unerfasst. Derselbe Owner korrigiert nur Client und Worker-Test
mit genauem Vor-flight/keinDispatch-/failed-Beleg und betroffener Typprüfung.
Kein A-/Session-/Integrationstestedit; eigener Deltafreeze,79be bleibt unverändert.
Der enge Nachfix ist fertig und zur gezielten Nachprüfung übergeben:
`.build/terrain-water-p/tw06-p-s7-terminal-fix-20261027-0841/manifest.json`,
SHA256 `93bfa4d84b4d75fd07c5a643cca1454b659d2ea939ce7f6f92033d22d94af200`,
16 Artefakte/1.162.195B durch Root hashgeprüft.48Byte-Produktdelta im Catch,
ein bestehender Fall für beide Preflightfehler/keinDispatch/exakten Onceabschluss
und isolierter Client-Typcheck grün. A/Session/Integrationstest unverändert;
parallele S8-Änderung getrennt gebunden. Unabhängiger Review hat alle16Artefakte, Before-/Livebindungen, beide
Vorflightfehler und den Typbeleg bestätigt. Root übernimmt S7 damit vollständig
im vereinbarten lokalen Prüfbereich; keine weiteren S7-Nachtests nötig.
Native-/GPU-/Leistungsabnahme bleibt separat.

**Aufwand und Freigabefolge:** S7-Plan unabhängig auf Machbarkeit/Ablage prüfen und
Reviewübernahme bestätigen → ausdrücklicher Rootstart → erster entscheidender
Progressbeleg nach geschätzten25–35min → gesamte begrenzte Umsetzung/Checks/Bindung
60–85min → enge Nachprüfung15–25min. Tatsächlicher S7-Start08:02; erster
Kontrollpunkt spätestens08:37, neue Widerlegung sofort melden. Machbarkeits- und
Ablageprüfung samt Korrekturen sowie Reviewer-Architekturübernahme sind bestätigt.
F-Quellarbeit ist unabhängig abgeschlossen,
abschließende Bindung/Build wartet auf akzeptiertes S7/S8, korrigierten Adapter sowie
konkrete Budget-/Schutzentscheidung. Noch keine S8-Umsetzung aus dieser Planung.
Gemeinsame10:00-Grenze bleibt, alle zusätzlichen Prüf-/Wartezeiten zählen; keine
Gesamtzusage. Neue Widerlegung/Scopezuwachs sofort Root, kein Zurücksetzen der
bisherigen E-/P-Historie oder verdeckte Retryserie.

### F — Begrenzter früher Messanschluss

**Rootentscheidung07:15; Machbarkeit/Ablage und Reviewübernahme bestätigt; Quellstart07:23:** Der unabhängige technische
Review bestätigt, dass eine vollständige transiente physische A-/Workerhalterbilanz
für den begrenzten frühen GPU-/Latenzentscheid nicht erforderlich ist. Deren
Instrumentierung würde den entscheidenden Produktversuch weiter verzögern und
zusätzliche Messlast schaffen. Root ersetzt deshalb ausschließlich diese frühe
Startpflicht durch konservative Vorabrechnung, vorhandene Inventuren und extern
überwachten Speicherschutz. Nutzerziele,30er-Ablauf und Bild-/Eingabe-/Latenzkriterien
bleiben vollständig; endgültige F-/R3-/Maximal-/Recoveryqualifikation bleibt offen.
Keine neue produktive Diagnostikbrücke in Raster, Session oder Worker.

**Ergebnis, Eingaben, Zuständigkeit:** Aus den zwei eingefrorenen F-Toolquellen,
übernommenem E-R3-Observer, bestehenden K2/K4-Fällen, C/D-Rechenfunktionen und dem
noch zu akzeptierenden S1/S2-Stand einen startfähigen Messadapter herstellen.
`early_gate_feasibility` (gpt-6-sol/high) besitzt Adapter, Assemblierung,
Ressourcenschutz und später exklusiv Build/Laufüberwachung. `field_gate_layout`
(gpt-6.1-sol/high, GL-Drawprüfung) korrigiert parallel den vorhandenen FieldGate;
keine gemeinsame Datei. Root besitzt Plan/Startentscheidung, unabhängiger Review
prüft gebundenen Handoff vor Native. Quellarbeit darf nach Planübernahme parallel
zum E-Testabschluss beginnen; finaler Build/Erwartungsfreeze wartet auf die
vollständige Startbedingung unter „Prüfung, Reihenfolge und Aufwand“ unten
(S1/S2/S7/S8, FieldGate und korrigierter Adapter).

**Schreibbereiche und Schnittstelle:** FieldGate-Owner ausschließlich
`tools/terrain-water-field-gate.mjs` und `tests/terrain-water-field-gate.test.mjs`:
P-Vertexlayout14 gegenüber historischem4 korrekt unterscheiden; tatsächliche
Endframe-Drawliste und ausgelassene inaktive Alt-/Neupartitionen berücksichtigen.
Vollständige Index-/Programm-/AfterRender-Bindung bleibt; gekürzte Erwartung und
fehlende/duplizierte aktive Draws müssen negativ bleiben. Bestehende öffentliche
Observer-/Evaluatorschnittstelle erhalten, notwendige kleine Erweiterung vorab
mit Adapterowner abstimmen. Adapterowner ausschließlich
`tools/test-desktop-terrain-water-p-gate.mjs`,
`tools/terrain-water-p-program-expectation.mjs` und eigenes gebundenes Handoff
unter `.build/terrain-water-p/`. Kein Produktedit, keine weiteren Messbibliotheken.
Nötige weitere Datei oder Schnittstelle vor Edit begründen.

**Ablauf-/Bildkriterien:** Pointerdown am tatsächlich bestätigten20m-Screen und
synchronen Freezeergebnis binden, nicht am früheren Weltbild. Angenommener neuer
Draft → vollständiger produktiver AfterRender → nachgewiesene Terrainbildänderung;
Kamera/Cursor/UI/JPEG-Rauschen dürfen nicht als Wirkung zählen. Alle30 ursprünglichen
Samplezeiten/p95 und geladenen Navigationsframes ausweisen; Bildabtastlücken dürfen
keinen unbeobachteten exakten Erstpixelzeitpunkt vortäuschen. Vorab festgelegter
Trigger am natürlich bestätigten Zwischenalpha, keine künstlich verzögerten Writes
oder Zusatzbedingung zweiterPointerdown-vorAck. Beide unabhängigen Packed-Picks,
Rand-/Detailbild, reguläres Commit/Escape/Undo bis tatsächlichem Screen/Ready/Retain.
Gemeinsamer terminaler Fehlerzustand verhindert sofort weitere geplante Eingaben.
Vorhandener exakter1.117-Draw-K2-Fall bleibt getrennte Laststufe im selben Gate.
Chromiumeingaben bleiben so bezeichnet, keine behauptete OS-Mausabnahme.

**Begrenzter Ressourcenvertrag vor Native:** Für tatsächliche Geometrie/Indizes/
Knoten/Rays/Materialbanken, erforderliche Autorenhülle, Transportkopien, gleichzeitige
Alt-/Neudarstellung, Escape/Restore und Uploadscratch bestehende
`terrainPreparedAllocation`/`terrainPreparedAuthorBound` und C/D-Formeln konservativ
rechnen, ohne unbelegte Aliasabzüge oder bloße Übernahme alter Gesamtzahlen.
DTO/SQLite/Workerheap/Browserheap/Treiber sowie Messadapter, Framecaptures,
ausstehende Schreibpuffer und die1.117-Draw-Laststufe benötigen zusätzliche Reserve; nicht einordenbare
Allokationsklasse blockiert Start. Surface/GPU-Inventur und GL-Lebenszyklen an
natürlichen Phasen beobachten, bestehende Workerzahlen nur als Teilbeobachtung.
Extern zur Renderer-RAF echte PID-/Prozesstyp-/Zeit-/Abtastratenreihen für Main,
Renderer,GPU, verfügbare Heap-/externe Werte sowie Kernel-/cgroup-Hochwasser und
memory.events erfassen. Worker nicht nochmals zum Renderer zählen; summiertesRSS
ist wegen SharedPages keine exakte physische Gesamtsumme. Vorab numerisches Budget
und Hostreserve binden und einen für die private Sitzung tatsächlich wirksamen
äußeren Speicherschutz für Harness, privaten Compositor und alle Electronkinder
nachweisen; cgroup-Zugehörigkeit allein genügt nicht.
Schutz-/OOMtrigger, Kontextverlust, fehlende Messabdeckung oder unerklärliches
Wachstum stoppen negativ. Keine neue native Vorprobe zur Beschaffung von Messdaten.

**Endzustand und Beweisgrenze:** Bekannte GPUhalter, reguläre Draw-/Settle-/Retain-/
Undoabschlüsse und verbleibende Heap/RSS-Werte prüfen; keine ZwangsGC oder
zusätzlichen Drainwartephasen. RSS muss wegen Caches nicht exakt zum Startwert
zurückfallen. Neue Sitzung je Versuch beweist keine langfristige Leckfreiheit.
Positiv bedeutet nur: dieser gebundene Ablauf erfüllt Bild-/Eingabe-/Latenzkriterien
im beobachteten konservativ geschützten Speicherrahmen. Keine vollständige
Halter-/Transienten-/globalHardcap- oder Recovery-/Langzeitsicherheitsaussage.
Offene genaue A-/Workerhalterbilanz bleibt im abschließenden F.

**Abgeschlossener F-Quellfreeze07:52, noch keine Startreife:**
`.build/terrain-water-p/tw06-p-f-gate-prep-20261027/f-source-freeze-20261027-0752/MANIFEST.json`,
SHA256 `2df92f706124383a7d9556494f05ffd2a01da650c5816949b32fd2ab66889b7d`,
mit `PREP-HANDOFF-0723.md`, beiden Toolkopien/Deltas und Syntaxlog. Nur Syntaxchecks
positiv; keine Toolausführung, Tests, Builds oder Native. Konkrete Counts/Budget/
Hostreserve/wirksamer Gesamtsitzungsschutz, Fall, Plattforminfo, endgültige Quellen/
Programme/13Runtimehashes bleiben echte Startblocker. Der unabhängige Quellreview
ist negativ abgeschlossen; die folgenden sieben Befunde verhindern den Hardwarelauf.
Der ursprüngliche ignorierte PREP-HANDOFF wurde vor Sicherung überschrieben;
bytegenauer Originalinhalt ist nicht verfügbar. Dieser Zwischenbeleg darf nicht
als erneut geprüft ausgegeben werden; damalige Toolhashes und die neue Beweislücke
stehen ausdrücklich im neuen Manifest. Der neue eingefrorene Vollquellstand ist
unabhängig lesbar, keine alten Runtime-/Laufnachweise werden damit ersetzt.

**Übernommene F-Quellbefunde gegen 2df92f; Korrekturplanung ohne Codefreigabe:**

1. Welt-Draftrevision wird als 20m-Baseline benutzt; der erste bestätigte
   Zwischenalphaframe wird nicht am tatsächlichen Ereignis gebunden.
2. Pixelvergleich kann Morphbewegung als Pinselwirkung zählen; Vorher/Nachher
   müssen dasselbe bestätigte Kamera-/Basis-/Alphapaar verwenden.
3. Dreißig Wiederholungen desselben Pfads ersetzen nicht die ursprünglichen
   zeitgebundenen Hold-/Sparse-/Dense-Eingaben; tatsächliche Dosen fehlen.
4. Pickreferenz verwendet produktive Höhenevaluation und prüft nach Welt-Rückkehr;
   unabhängige P14-Evaluation und echte aktive 20m-Phasen fehlen.
5. Folgegeste/Escape/Undo sind nicht bis zu angenommenem B, tatsächlichem Restore
   und aktuellem Worker-Retainabschluss gebunden.
6. Worker-failed/messageerror/error, fehlende Prozessmessung, hängende Abfragen und
   memory.events.max/high sind nicht zuverlässig terminal. Externer begrenzter
   Watchdog und vollständige Schutzabdeckung sind nötig.
7. Die 1117-Draw-Stufe verletzt preparedBasis/vertices-Alias und ignoriert das
   vollständige FieldGate-Ergebnis; Layout, aktive Deskriptoren, Kapazitäten,
   Offsets und Programme müssen gemeinsam entscheiden.

Assemblerquelle ohne konkreten Fehlerbefund; vorhandener FieldGate bleibt
akzeptiert. Derselbe Adapterowner erstellt den kleinsten Korrekturplan samt
sinnvoller Logikprüfung und S7/S8-Schnittstellen. Kein neuer Nativeversuch,
keine Produktinstrumentierung, keine neue allgemeine Messbibliothek. Historischer
Freeze bleibt unverändert; keine Rücksetzung bisheriger Befunde oder Laufzeit.

**Autorisierter schlanker Bediencheck-Anschluss, Rootstart08:40:**
Derselbe F/Gate-Owner ändert nur `tools/test-desktop-terrain-water.mjs` und
`tools/terrain-water-replay.mjs` plus eigenes Handoff. Kleiner
`--continuous-paint-check`-Zweig nutzt vorhandenen Main-sendInputEvent-Scheduler,
300ms-Dense-Pfad mit zeitlich interpolierten8ms-Ereignissen, anschließend identischer
fest benachbarter Zug ohne Reset.20m, Raise300/radius.625/Sea0, ausdrücklich
gebundene normale45°/rotation0/exaggeration1/focus250-Pose; keine Ausweichminidosis.
Vorhandene produktive AfterRenderprobe nur verketten: begrenzte Raw-/PNG-Sequenz
mit echten Field/Screen/Draft/Alpha/Kamerabindungen während Bewegung. Echte
Commitantwort/CommandID/Referenzfingerprint und unabhängige kanonische Hashes
vor/zwischen/nach. Bildsichtung beurteilt Terrainänderung; Kameraeffekt allein
ist kein Erfolg. Kein SameCamera-Zwang, keine Erstpixel-/p95-/30er-Aussage.

20–30min bis Tooldelta/Syntax-/Quellcheck und konkreter Startform; keine neue
allgemeine Testsammlung. S7-Retention in numerischer Hülle berücksichtigen.
Sicherer äußerer MemoryMax-Scope für Harness/privatenKWin/Electronkinder und
Hostreserve bleiben vor Lauf konkret zu binden. Builds und Native noch nicht
freigegeben; S7/S8 müssen übernommen sein. Später genau ein Owner für seriellen
Build, Lauf und Überwachung. Vollständiger F-Adapter bleibt unverändert/offen.
Der erste kleine Quellfreeze ist fertig: `.build/terrain-water-p/tw06-p-early-ui-check-20261027/MANIFEST.json`,
SHA256 `4657515ddfbbbee346ebd4fa92e79d2affb19bb65c4fb9632cc076b718414848`,
8 Artefakte/114.944B und beide Livequellen durch Root hashgeprüft; zwei Syntaxchecks
positiv, keine Toolausführung/Build/Native. Root verlangt eng den noch fehlenden
originalen300ms-Pfadendpunkt und eindeutige Trennung von Rawbilddifferenz und
menschlicher Sichtprüfung. Derselbe Owner korrigiert dies und berechnet jetzt die
konkrete Zwei-Züge-Speicherhülle; keine vollständige F-Maximalbilanz.
Endpunkt-/Textdelta `endpoint-fix-20261027-0854/MANIFEST.json` unter demselben
Handoff, SHA256 `64caeb3643d91537c4ceed0d430e9156ef210f005159511bca9066713c4c3040`,
sechs Artefakte durch Root verifiziert. Beide Syntaxchecks grün; ursprünglicher
300ms-Endpunkt ist enthalten, Bildsichtung bleibt ausdrücklich offen.
Der Ressourcenvertrag dort reserviert12.551.813.140B (11,690GiB) bei13GiB
MemoryMax und2GiB Hostreserve. Root übernimmt diese konservative Hülle für den
Bediencheck: aktuelle AuthorBound plus drei volle S7-Snapshots, drei größere
K2-Topologiegruppen, Transport und ausdrücklich reservierte Browser/SQL/GPU/
Bildpuffer. Historischer GPU-Prozesspeak begründet Reserve, keinen aktuellen
Messwert. Host hatte32.618.033.152B MemAvailable; frische Reserve und tatsächliche
Scopeabdeckung bleiben beim ersten echten Lauf vor Eingabe Pflicht. Keine
zusätzliche native Vorprobe. Finaler Vertrag bleibt bis S8-/Buildbindung und
Rootstart separat zu schreiben; unveränderter Vorschlag bleibt reviewed=false.
Der enge vorhandene Surface-Countanschluss ist ebenfalls eingefroren unter
`topology-check-20261027-0900/MANIFEST.json`, SHA256
`44df32ac3960b9a2299c077c91737b8c6c28342c2ca8b8ab8befe563d232d5eb`.
Root bestätigt drei Artefakte und Live-Toolbindung. Tatsächlich gezeichnete
Prepared-Descriptorlängen und retainedBases werden vor erster Eingabe gegen die
Hülle geprüft; nur Worker-Family-Nodes bleiben konservative Sourcecount×4225-
Schranke. Syntax positiv, keine Toolausführung. Finale S8-Quelle und echte
Scope-/GPU-/Framewerte werden im ersten echten Lauf gebunden.

**F-Korrekturplan in Machbarkeitsprüfung, noch keine Umsetzung:** Derselbe Owner
korrigiert ausschließlich den bestehenden Adapter und einen gezielten
`tests/terrain-water-p-gate-logic.test.mjs`. Assembleränderung nur bei konkret
belegtem Bedarf der abschließenden Quellen-/Runtimebindung. Keine neue
Messbibliothek und keine produktive Instrumentierung. Reine vorhandene
Auswertungsfunktionen können über einen seiteneffektfreien CLI-Main-Guard direkt
geprüft werden; ein Test gegen bloß nachgebaute Implementierungslogik genügt nicht.

Geplant sind tatsächliche 20m-AfterRender-Ereignisse, originale zeitgebundene
Hold-/Sparse-/Dense-Eingaben, eigene P14-Höhen-/Dreiecksreferenz auf dem aktiven
20m-Screen, genaue B/Restore/Undo-/Retain-Ereignisketten, unabhängig begrenzte
externe Messabfragen/Watchdog und volle akzeptierte FieldGate-Prüfung der
1117-Draw-Stufe. Fehlende Abdeckung, Workerfehler und Schutztrigger sind terminal.
S7-Feldabschluss und S8-Framepaar werden nach deren akzeptiertem Freeze gebunden.
Gezielte negative/positive Logikfälle, Syntax, Fixdiff/Hashfreeze und unabhängiger
Quellreview vor Build/Native. Die sieben Befunde bleiben bis zum Beleg offen.

Die Machbarkeitsprüfung hat bereits zwei konkrete Konzeptgrenzen gefunden:
Ein asynchron ausgelöstes Chromium-Pointerdown kann nicht garantiert denselben
vorher beobachteten Frame einfrieren. Autoritativ wird daher der tatsächliche
synchrone Pointerdown-Freeze mit passender Rawbaseline; das erste natürliche
20m-Zwischenframe-Ereignis ist nur Startsignal, verpasste Phase stoppt negativ.
Außerdem kann ein regulärer S8-Kameralift den SameCamera-Pixelvergleich unmöglich
machen. Wie echte sichtbare Terrainwirkung von Kamerabewegung getrennt wird,
ist vor Umsetzung zu entscheiden. Bloße Geometrieänderung ist kein Pixelbeleg.

Owner schätzt150–220min Umsetzung/Logiktest plus20–30min Review, zuzüglich S7/S8-
Warten, finaler Budgets/Plattform/Buildbindung und Hardwarelauf. Diese Schätzung
ist keine Freigabe; Root prüft den kleinsten tragfähigen Messanschluss angesichts
des gewachsenen Aufwands. Gemeinsame10:00-Grenze unverändert.

**Gebundener FieldGate-Teilstand07:30:** Nur die beiden zugewiesenen Dateien,
53/53 gezielte Tests und zwei Syntaxchecks positiv, kein Build/Native. Handoff
`.build/terrain-water-p/tw06-p-field-gate-20261027/HANDOFF.md`; Manifest SHA256
`f132c17d0d391ff520b2a88ce43a6a53d1ca4126995ac2e402fa206a25c36be6`. Root bestätigt
sieben gebundene Artefakte/92.264B sowie beide Livequellen ohne Drift.
Unabhängiger Review bestätigt Artefakte, beide Quellen und drei Semantikquellen,
53Tests sowie Layout-/Endframe-/Kapazitäts-/Programmvertrag; Root übernimmt
den Baustein07:32 ohne Testwiederholung. Additive Descriptorfelder sind mit Adapterowner
abgestimmt. Vollständige Feld-/Quellen-/GPUabnahme ist daraus nicht abgeleitet.

**Prüfung und Reihenfolge:** Der erste Adapterplan ab07:23 samt damaliger
160–255min-Gesamtschätzung ist historisch und durch den negativen Quellreview
überholt; er begründet keine aktuelle Freigabe. Der neue vollständige
F-Korrekturplan und seine offenen Konzeptgrenzen stehen unmittelbar oben.
Build/Native dieses vollständigen 30er-Messauftrags sind nicht autorisiert.

Der nächste Nachweis ist gemäß aktuellem [Plan](../plan.md#nächster-integrierter-produktnachweis)
ein schlanker repräsentativer nativer Bediencheck, ausdrücklich ohne p95-/30er-/
Lieferbehauptung. Dessen Anschluss verwendet vorhandene Prüfmittel und nur die
notwendigen Voraussetzungen für Funktion, sichere Ausführung und verlässliche
Beobachtung. Vollständige Messinfrastruktur und unabhängige Lieferbefunde sind
keine pauschalen Vorbedingungen. S7-/S8-Funktion, tatsächliche Terrainbilder,
unverlorene Eingabe und Speichern/Folgegeste bleiben nötig. Der F-Owner konkretisiert
diesen kleinen Anschluss; keine automatische Umsetzung des150–220min-Messplans.

**S1/S2-Hypothese vor Edit:** S1 klassifiziert alte gleicheToken-Projektionen gegen
den bestätigten Raster-/A-Quellstand vor Invalidierungswirkung; andere autoritative
Quelle bleibt gefenct. S2 bindet im Readfehlerpfad einen tatsächlich überlappenden
eigenen Write an dessen exakte Ausgangsquelle. Nach dessen Antwort gelten die
bestehenden current/sameSource-Regeln; ohne gültige Ersetzung bleibt der Originalfehler.
Kein neuer Queue-/Owner-/Receiptpfad. Die benannten bestehenden Tests sind freigegeben.

**Versuchsgrenzen:** Vorab festgehaltene Kontur-/Stylekonfiguration; keine Aussage
zur dynamischen Konturbedienung. Speicherstatuslabel ist wegen S3 kein Erfolgsbeleg:
tatsächliche Receipts, unabhängiger kanonischer Hash, gezeichneter vollständiger
PackedScreen/ready und abgeschlossener Escape/Retain sind maßgeblich. Keine
künstlichen zusätzlichen Wait-/Drainphasen, keine ausgelassenen/ersetzten Samples.
Unknown/Freeze, Capacity-/Eingabeblockade, unerreichbarer Escape, fremde Quelle,
fehlender sichtbarer Effekt/Receipt/Hash, falscher Draw, GL-/Kontextfehler oder
nach dem begrenzten F-Vertrag nicht eingeordnete Allokation/Schutzverletzung im regulären Lauf: sofort negativ stoppen und Rootentscheid.
Kein Recovery zur Fortsetzung derselben Messserie. S3–S6 bleiben Lieferblocker;
positive Laufwerte sind nur der gebundene frühe GPU-/Latenzentscheid. Finale
Ressourcenmaxima einschließlich Recovery bleiben offen. Spätere S3–S6-Fixes
verlangen erneute Prüfung der tatsächlich berührten Hardwareübergänge.

**Gemeinsamer Rahmen:** P- und E-Beginn sowie drei Produktversuche/zwei Diagnosen
bleiben bestehen. Die07:08-Kontrolle hat den Teilfortschritt und konkreten
Testgrenzen-/F-Restbedarf bewertet; Entscheidung und nächste Kontrolle im Plan. Gemeinsame10:00 bleibt;
keine implizite Verlängerung und keine Zusage, dass die Umordnung hineinpasst.
Ohne gebundene Startreife beginnt kein Hardwarelauf. Der unabhängige Review hat
die Umordnung fachlich bedingt erlaubt; Root lässt den konkreten Auftrag vor
Umsetzung auf Machbarkeit/Ablage prüfen und die Übernahme bestätigen.

**Unveränderliche Belege und ihre Grenzen:**

- Einzige V2/e77-Charakterisierung: `fixture-v2-characterization-20261027-0644/manifest.json`,
  SHA256 `987f2fbb6d91d7d48d37c2fa7879204d72dee3ad271e2efb887a22b4610ca8ec`.
  Root/Review9Artefakte/9.778.373B,791Produktquellen und V2/Node/SQLite gebunden;
  tatsächliches Bundle e77-bytegleich. Ein Aufruf,exit1/TAP3.360s/Test1.488s,
  Assertion statt Timeout. Nach49Ack alterR0-Render bei writingtrue, danach
  Streamcancel/A-C-Abbau. Nach50R3/prefix3/journal0/failedtrue,Sessionnull,
  Originalworker beendet; alterR0-Draftscreen,Surfacefailure=null,errors=[].
  Drei Writes48/49/50; unabhängiger Hash/Receiptzählung/Pick400/51 danach nicht
  erreicht. RAF0, kein Morphnachweis und keine S2-Ordnungsprüfung. Negative
  Einordnung06:51 unabhängig bestätigt; keine Wiederholung oder Fix im Beleg.
- Unausgeführte F/Harness-Vorbereitung: `.build/terrain-water-p/tw06-p-f-gate-prep-20261027/PREP-HANDOFF.md`.
  Toolquellen `terrain-water-p-program-expectation.mjs` SHA256
  `e56d83645be362e7874768dc669c8fe7f38c5473cc05f087b38b6705514bfbdb`,
  `test-desktop-terrain-water-p-gate.mjs` SHA256
  `3d6cc257bd537834b0cf4a50a0e46246ffd245db7a3f943180afc294cf200cab`.
  Noch KEINE Startreife: sichtbare Erstpixel/p95, Alpha-/Pick-Nachweise,
  vollständige physische Halter-/Freigabebilanz und terminale Navigations-/
  Unknownauswertung teilweise noch nicht implementiert. Unabhängiger Quellreview
  hat Vertexlayout14 statt4, falsche Weltbild-Zeitbasis und unnötige Ack-Timing-
  Bedingung als konkrete Fehler benannt. Breite Produktinstrumentierung ist
  nicht begründet; tatsächliche Renderer-/Workerinstanzen-Erreichbarkeit und
  kleinster Messanschluss werden vor jeder weiteren Umsetzung eng nachgeplant.
  Frühere zusätzliche30–50min plus45–75min sind keine belastbare Restprognose.
- Übernommene Fixture-V2: `fixture-delta-v2-20261027-0640/manifest.json`,
  SHA256 `c1e56a1021f77da9403505cecca89f7f0e403114c4d06a068464edbb3f3fdb71`.
  Root/Review8Artefakte/193.534B; V2before=V1after, V2after=live,907übrige Quellen
  e77-bytegleich. Delta `892582568f2d336d9e1f66a386243e625fe4de4eede5e3f78e33db3dbfad0ae1`.
  Voller Dump vor erstem produktivem await, Nulls für nicht initialisierte Besitzer.
 06:44 genau ein ausgewählter Node22-Lauf mit normalem Testbundle-Build und20sWait
  autorisiert; weder Ergebnis noch Produkt-/Hardwarepass vorweggenommen.
- Unausgeführtes Testdelta: `fixture-delta-20261027-0613/manifest.json` im E-Verzeichnis,
  SHA256 `6aadef20ea9e66bac2b04df40eb5ff01cd13c3c7a88003436fdd21b1b00eaf4d`.
  Root06:35 prüfte8Artefakte/208.836B, beide Live-Testbytes,907unveränderte andere
  Quellen sowie1025unveränderte e77-Artefakte ohne Drift. Patch
  `87e132a014b4deef9c452253c1aa9626c862e5a4a525d5a8fd944a7c126f6e4d`.
  Genau0Ausführungen/Builds. Review bestätigt Punkte1/2/4/5 und Punkt3 bis auf
  fehlenden vollständigen frühen Dump; minimale Vorverlegung vor erstem await in
  Arbeit, danach nur Delta-Nachprüfung. Dieser Gesamtlauf ersetzt keine gezielten
  S2-Tests beider Read-/Write-Startordnungen.
- Gesamt-E-Teilstand: `.build/terrain-water-p/tw06-p-product-e-20261027/e-partial-stop-20261027-0534/manifest.json`,
  SHA256 `e77fe7ecefb62df14403d43da1554e7c16a943c7f4c903650179630fd29e1d5f`.
  Root1025Artefakte/27.252.254B,909Livequellen/9.519.862B ohne Drift. Drittdelta
  `86e96bdcaecdf8ac68b23aea3fa9954925ffedbce1e9ba09dcd1621d5489aa55`, Gesamt-E-Delta
  `cd6dd7b6ba93ceab2578a4a56e554795e764f01b38aed839f41be1dff49c7e77`.
  HANDOFF/OWNER-INVENTORY enthalten tatsächliche Halter und Vorzustände.64/64 und
  Typchecks liegen vor drittem A-Edit;64erLog mit fatalem Altread ist kein Endpass.
- Ungültige Einzelprobe: `following-diagnosis-20261027-0543/manifest.json` im selben
  E-Verzeichnis, SHA256 `e7f2ad182ac5dffacc64cdfe1fcf97df5958677f260b11a3a6da01222054f34b`.
  Root/Review10Artefakte/7.652.096B;791Produktquellen und Runtimebytegleichheit
  bestätigt. Falscher Testprefix2 ohneReceipt statt Referenzprefix0; exit1/3.138s,
  kein Produktbefund. Querybinding ist ehrlich rekonstruiert, kein Laufzeitdump.
- Genau einmal erlaubte prefix0-Wiederholung: `following-diagnosis-repeat-20261027-0550/manifest.json`,
  SHA256 `afe75be6535108966e8400bc1ecd5dff4d3ad7f24c15bffb13b39bb01c767bb8`.
  Root/Review11Artefakte/7.654.267B,909Livequellen/alle Altartefakte unverändert,
  identisches Runtimebundle. Ein Lauf23.175s/20s-Wait; drei Writes/Receipts und
  Referenzhashvergleich vor Wait bestanden, Hashwert nicht geloggt. Finale Daten:
  A R3/content15/prefix3/Journal0/failedfalse; C flight/latest/control leer;
  Session draftContent−1/operation5/fieldLatestnull; Screen=null; RasterR3/readyfalse;
  errors[]. Keine interne Surfacefehler-/Contextaufzeichnung, kein Pick400/51-Pass.

Gebundener Negativstand:
`.build/terrain-water-p/tw06-p-product-e-20261027/unknown-blocker-20261027-0440/diagnosis-manifest.json`,
SHA256 `5e3ba12fb97c251e8d3e588458b68318e15bd8477674918629f8f392669341dd`
(23 Einträge / 7.895.793 B, Root und Review unabhängig geprüft).
Der bestehende Reviewchat `01a179b3-ced4-7dd2-bd61-16dd07fd0bc5` akzeptiert den
folgenden engen Vertrag zur Umsetzung, nicht als behobenen Lieferblocker.

- **Ergebnis und Owner:** Derselbe E-Implementierer (gpt-6.1-sol/high) stellt
  Wiederaufnahme und verständliche Konfliktauflösung her. Zusätzlich erlaubt sind
  `src/app/terrain-stroke-queue.ts` und `src/app/campaign-atlas-author.ts`; sonst
  die vorhandenen E-Dateien `terrain-author-state.ts`,
  `atlas-terrain-prepared-session.ts`, `atlas-raster-presentation.ts`,
  `campaign-atlas-ui.ts` und `tests/terrain-commit-display.test.mjs`.
  Kein neuer Main-/Preload-/Storagepfad, kein DTO, kein weiterer Owner/Worker/Queue.
- **Eigener Normalfall:** Vor await originales landscape-height-stroke48 mit
  commandId/fingerprint, erwarteter Revision R, exaktem Journalhead,
  Owner/Queue/Serie/Fehlergeneration sichern. Read-only reconcile bestätigt genau48
  applied; Ack und aktuelle TerrainSource zeigen R+1. Bekannte relevante
  Fremdinvalidierung, retired/anderer Owner, aktive source.shadow-Preview und
  fehlende originale In-memory-Bindung schließen diesen Weg aus. Original48 darf
  keinen Preview-target haben;49 nutzt weiter den bestehenden bedingten Write mit
  aktueller Revision/Fence. Alle relevanten
  kanonischen Height/Sea/Water/physical-landscape-Schreibwege benutzen den
  revisionierten Atlaswriter; selected_id/data_version allein erfordern keine
  neue Quellenarchitektur. Kein historischer Fence48 wird behauptet. Unveränderte
  Capture49-View/Water/Sea-Bindung bleibt Pflicht.
- **Atomare Übernahme:** Alte Queuearbeit abwarten, während Reads und Suffixreplay
  eingefroren bleiben. Checkpoint bindet aktuelle Quelle UND Receipt48; nach
  jedem await die ursprünglichen Bindungen erneut prüfen. Gültige Ground-/Bandbasis
  mit Präfix48 und denselben Captures49… installieren; erst atomar danach Head48
  lokal konsumieren und vorhandene Captures regulär pumpen. Kein write48,
  enqueue49, neues Capture oder neue Nummerierung. Eigenes Recoverypromise besitzt
  Drainabschluss; Doppelklick teilt laufende Operation. Fehler erhält Command-/
  Receiptbeleg und Eingaben. Unknown hält denselben A/C wiederaufnehmbar; echtes
  Dispose bleibt endgültig und spätes Ergebnis wirkungslos.
- **Konflikt:** applied48 separat als gespeichert zeigen. Folgezüge bleiben
  standardmäßig erhalten. Expliziter Statusbutton „N ungespeicherte Folgezüge
  verwerfen und aktuelle Karte laden“ betrifft nur sicher nie geschriebene,
  exakt gebundene Captureobjekte/Owner/Queue/Head/Fehlergeneration; vor Mutation
  erneut prüfen. Abbrechen erhält alles; keine History-/Undo-/Datenbankwirkung
  auf48. Aktive ungeschlossene Geste gesondert behandeln. Reloadfehler verursacht
  keinen zusätzlichen Verlust; bereits ausdrücklich verworfene Züge ehrlich
  anzeigen. Wird49 selbst Unknown, ist es nicht mehr als ungeschrieben verwerfbar;
  erst Receipt klären, alter48-Dialog wirkungslos. Der normale Pinselablauf bleibt
  direkt, ohne neue Vorschau oder Bestätigung.
- **Prüfkriterium:** Bestehender tatsächlicher UI/Raster/A/C/Surface/SQLite-48/49-
  Ablauf: UI-Klärung →48 insgesamt genau einmal →identisches49 erstmalig genau
  einmal →unabhängiger kanonischer Hash →nächste Geste nutzbar bei gleichem
  Owner/Worker. Fremdcommit vor Klärung:49 bleibt ungeschrieben, Abbrechen erhält,
  bestätigtes Verwerfen lädt wieder nutzbar. Stale Recovery/Dialog und Dispose/
  Quellenwechsel während awaits mutieren nichts. Checkpointfehler mit erneutem
  Klärungsversuch, Doppelklick und49→Unknown gehören zu diesen Negativfällen.
  Bestehende passende Prüfungen
  erweitern, standardmäßig ausführbar; Quellfreeze/Fix-Diff/Logs zur gezielten
  Nachprüfung. Kein Native-/F-/Lieferpass aus lokalen Tests.
- **Abfolge und Aufwand:** Enge Planchecks → Rootübernahme/Reviewbestätigung →
  Korrektur beim selben E-Owner (55–80min einschließlich dieser Tests und
  Typchecks) → gebundene E-Nachprüfung (15–25min) → Rootübernahme. Unabhängige
  E3-Tests durften während Planung weiterlaufen; Recovery ab Rootübernahme04:55.
  Das damalige Handoffziel06:31 ist durch den Fixture-Nachplan ersetzt;
  07:00-Kontrolle ist erfolgt; aktuelle Folgeentscheidung im Plan,10:00 bleibt;
  kein neuer Paketbeginn setzt die E-/P-Laufzeit zurück. Root bewertet nach30min
  Korrektur oder bei widerlegter Grundlage; maximal drei erfolglose Fixversuche
  am selben Problem vor erneutem Entscheid. F/Native bleiben abhängig.

Der Aufwand2,5–3,5h aktiv ersetzt die unvollständige frühere1,5–2h-Hypothese;
Review/Integration sind zusätzlich im gemeinsamen Terminplan reserviert.

| Teil | Ergebnis / ausschließlicher Schreibbereich | Eingaben, Schnittstelle und Prüfkriterium |
| --- | --- | --- |
| E1 Vertikaler Höhenanschluss,45–60min | atlas-raster-presentation.ts; eng campaign-atlas-ui.ts, landscape-brush-session.ts, landscape-workbench-types.ts; genau ein kleiner atlas-terrain-prepared-session.ts-Adapter bei Bedarf | Bestehende UI-/Pointerereignisse an denselben A-Owner und C-Worker, D als einzige bestätigte Heightfläche. UI führt keine zweite unabhängige Strokequeue. Writer liefert A denselben tatsächlichen Command-Receipt zusätzlich zum Ack; Command-ID/Fingerprint des wirklich geschriebenen immutable Auftrags. Main/Storage/Recovery unverändert. |
| E2 Fenster und Lebensdauer,45–75min | terrain-author-state.ts und derselbe Präsentationsadapter; C-Client gebundene Settle-Benachrichtigung, discardFieldLatest und cancelUndrawnField | A wechselt Lattices atomar mit eigener Fenstergeneration; Queue/angenommene Captures/Suffix/aktive33 erhalten. Nach jedem await Operation/Quelle/Fenster prüfen, Escape nie fremden Fensteranfang installieren. Commit/Folgegeste/Escape plus genau die oben gebundenen Lease-/Retain-/beiden ApplyCancelrennen. |
| E3 Quellen, Picking und Prüfung,45–75min | dieselben E-Dateien und tatsächlich betroffene bestehende Integrationstests/Tracepunkte | Undo/externe Quelle/Unknown/Dispose; Water/Sea/View/Landfarbe immutable an Geste. EigeneHeightreceipts und externeQuellen-/Stilwechsel unterscheiden. Beide Picker ausschließlich bestätigtes gepacktes Feld; keine analytische Höhennachkorrektur. Trace Pointerannahme/Dispatch/ersterDraftdraw/Receipt/kanonischesEndbild/Folgegeste, Prozessuhren getrennt. |

Der Adapter verwaltet Präsentationsbindungen und Leases, keine zweite numerische
Autorenautorität, keine weitere Queue/Workerinstanz und kein vorsorgliches Gerüst.
A bleibt alleiniger Autorenbesitzer. Command-Receipt wird unverändert aus dem
bestehenden Writer bis A durchgereicht; nur der oben begrenzte Recoveryanschluss ist zusätzlich vorgesehen.
C darf zusätzlich ausschließlich ein veraltetes Field-Latest entfernen, ohne
Flight oder vorrangigen Autorenreplay anzutasten (discardFieldLatest). Der Aufruf
ist an gültigen Pointerdown/Operationskontext gebunden; ein später Callback darf
kein neueres Gestenziel verwerfen. Dieser Anschluss vermeidet Cancel eines bereits
gezeichneten, noch nicht settled Flight, ohne neue Queue oder Besitzerpolitik.
Für Dispose/ungezeichneten Abbruch darf cancelUndrawnField nur Field-Flight und
Field-Latest abbrechen, niemals Replay oder Settling. Replay-Latest bleibt
erhalten, bestehende Cancel-/Ackbindung wird genutzt. E fencet zuerst Surface;
gezeichnete Applys durchlaufen bound settled. Angenommene A-/Schreibarbeit wird
vor endgültigem Workerabbau gedraint, ohne Veröffentlichung nach Surfaceabbau.
Dieselbe integrierte Prüfung muss Aktionsverlust und dauerhafte Workerhaltung
ausschließen; der oben begrenzte Recoveryanschluss nutzt ausschließlich vorhandene Speicherpfade.
Raster hält dafür höchstens die tatsächliche retiringSession mit Drainbarriere;
kein neuer A/C vor endgültiger Workertermination. Failed/ungeklärtes nichtleeres
Journal bleibt beim selben gehaltenen Besitzer, ohne vorgetäuschten Erfolg.
F zählt diese Halter mit. Der integrierte Neustartfall prüft seriell1→0→1 Worker
und verhindert Neustart nach endgültigem Raster-Dispose.
D-Dateien bleiben exklusiv beim D-Owner; nötige enge Surface-/Pickerschnittstellen
vor Edit Root melden und seriell abgrenzen. Konkrete Anschlusslücke03:34: Nach
freezeTerrain fehlt gebundenes Resume vom bestätigten Alpha; der vorhandene
Contentwaiter wartet auf complete. Vorhandener observePreparedScreens genügt für den Erstscreen; kein zusätzlicher
Waiter. Enger D-Auftrag an tw06_e_surface_bridge
(gpt-6-sol/high): Ursache klären, kleinsten Resume-/Erstscreenanschluss in
atlas-deck-surface.ts und bestehenden Surfacetests belegen, ohne Shaderumbau.
E1 beiAlpha1 ist unabhängig; E2-Zwischenalpha wartet auf diesen übernommenen
Beleg. Handoff03:41 frozen: `.build/terrain-water-p/tw06-p-e-surface-bridge-20261027/manifest.json`
SHA256`124cfda80237156cbd66e2ee2a42fe8c677593492d83193d0a2a880dd9ba5228`,
Delta`3d109b1f540bec19f7fe00f4045b696b5904ebcf54a0c6d750067b7fe586331e`.
50/50 Surfacefälle und beide Typchecks grün; Root prüfte8Artefakte/324.067B
und beideLivehashes. Enge unabhängige Nachprüfung03:44 ohne Blocker abgeschlossen; Root übernimmt
den exakten Delta für E2. Der integrierte Adapter-/Folgegestenbeleg bleibt offen.
FrozenDraft→Resume→
echterAlpha1/endFrame→C commitThrough→Canonical; sofortigesB friert erneut ein.
Keine parallelen D-Edits, ursprüngliche D-Belege bleiben unverändert.
Die alte old-only-Testfixture brauchte New=Old-Alias; initial49/50 nur im
Agenten-Tooloutput erhalten, kein separater Fehllog. KeineGPU-/Nativequalifikation. Keine Main-/Storageänderung oder
neue kanonische Leseausweitung ohne konkrete Eskalation.

**Erster entscheidender Anschluss:** Bestehender Raster-/Brushcontroller verarbeitet
eine reale Höhenpinselgeste aus bestätigtem PreparedScreen bei gültiger gleicher
Kamera/Quelle. A.begin/update→vorhandener Modellworker→kumulativer Draft→tatsächlicher
Produkt-Surface-Ack; Pointer-up schreibt genau einmal. Sofortiger Folgezug B bei
noch ausstehendem A-Endbild bleibt erhalten; verspätetes A ersetzt B nicht.
Gleiche A-/Workeridentität und kanonischer Höhenhash werden geprüft. Bestehende
Produktklassen/Testharness verwenden, keinen neuen Simulator oder Ersatzrenderer.
Dieser lokale Integrationsbeleg ist kein tatsächlicher GPU-/OS-Eingabe-/Latenzpass.
Fehlt er nach45–60min oder widerlegt er den Ansatz, Rootentscheidung vor weiterer
E-Arbeit. Danach denselben Ablauf um Bupdate→Escape, beide Stagingrennen,
Fensterwechsel mit angenommenem Suffix, Unknown, Undo/externeQuelle und Dispose
ergänzen. Bestehende passende Testbelege nicht pauschal wiederholen.

**Aktiver Cutover und zurückgestellter Umfang:** Sämtliche aktive Höhenvorbereitung
und Drafts laufen über C/D. terrainHit und GPU-Pickabschluss lesen Ds bestätigtes
Packed-Feld; alte Heightclient-/Worker- und synchrone Tilemodels verlieren dort
produktive Aufrufer. Keine dauerhaft parallel gehaltene Height-Ersatzpipeline.
Qualifizierter Terrainmodus bindet die sieben vereinbarten Höhen-/Formpinsel und
Meeresspiegel. Pigmententwicklung ist nicht Teil von E: gespeicherte Farben werden
über Materialquellen weiterhin dargestellt, vorhandene Pigmentdaten/Funktionen
bleiben erhalten und zurückgestellt. Keine neue Pigmentcapture-Erweiterung;
im aktiven Terrainmodus keine auswählbare tote Aktion oder heimlicher alter
Heightfallback. Keine breite Nebenbereinigung oder neue UI-Produktarchitektur.

E-Handoff bindet Delta gegen C52f165/D7ca, gezielte Prüfungen, Capture-/Receipt-/
Leaseverträge und tatsächliche neue Halter für F. Produktquellen einfrieren, enges
unabhängiges Nachreview und Übernahme vor vollständigem F. Die oben06:28
beschlossene frühe Umordnung erlaubt ausschließlich den gebundenen Normalpfad
nach S1/S2; offene S3–S6 sind dadurch nicht übernommen. Relevante lokale Checks/Builds nur
koordiniert einmal; alle neuen tatsächlichen Testlinks im Capabilitykatalog pflegen.

**F und vorhandenes frühes Gate:** Vollständiges F folgt auf akzeptiertes E;
für das vorgezogene frühe Gate gilt ausschließlich der oben abgegrenzte
S1/S2-/F-Anschluss mit offener E-Gesamtübernahme. Ergebnis bleibt
reale vollständige VS-/FS-Offlineassemblierung als unabhängiger E-R3-Erwartungsinput,
für das endgültige F Inventur aller integrierten Author/Worker/Surface/E-Restore-/
Uploadhalter und13aktuelle Runtimeartefakte. Für den frühen Entscheid ersetzt
der [begrenzte F-Messvertrag](#f--begrenzter-früher-messanschluss) diese Vollinventur. Quellen-/Programme-/Runtimes müssen denselben Stand bezeichnen.
Der zugewiesene F/Gate-Owner führt nötige gemeinsame Builds seriell aus; keine zusätzliche native Vorprobe.
F-Handoff und gezieltes Nachreview vor bestehendem P/E-Hardwaregate. Native Probe
auf privater Sitzung bei gesperrtem Host, unveränderte Messkriterien/30Vergleichsläufe;
bei falschem Draw, fehlendem sichtbaren Effekt, unbilanzierter Allokation oder
neuem Grundlagenfehler stoppen und Rootentscheid statt weiterer Proben.

### Übernommene P-B-Grenzen für B bis F

P-Bs 726/834ms-Replay-/Checkpointwerte enthalten überlappende Instrumentierung
und sind keine Produktlatenz. Sie rechtfertigen C, keinen weiteren Messzyklus.
Der gültige256-Seiten-Boxguard begründet W774; K8448/D256 ergeben
`(4K+2W+4D)*16384 = 595.787.776B`. Seed13.815.480B und Ergebnis158.901.792B
sind **getrennte** Jobarten. Mit P56 und Restore1.538.002.908B Backingstores;
bestehende Base64-/JSONpayloads zusätzlich816.299.072B. Die Summe2.354.301.980B
ist keine universelle Obergrenze: Metadaten waren unbeschränkt und Objekt-/SQLheap
fehlt. A entfernt unnötige Metadatenmaterialisierung, B/F zählen die echte Umsetzung.
3GiB ist höchstens eine vorläufige Beobachtungsgrenze mit echtem Heap/RSS und
Stop-/Rootentscheid bei Überschreitung, kein bewiesener Hardcap.40/160MiB-Jobgates
bleiben bedingt. Alias-/Transferabzüge brauchen echte Bufferidentität und Freigabe;
keine versteckten kombinierten Seed-/Modelljobs.116e6 ist eine aus32 geschlossenen
plus einer aktiven Geste abzuleitende Rechenhülle, weder Clamp noch Gradientennachweis.

K2-Partition, geschnittene Dreiecke, Indizes und lokale Double-Ursprünge bleiben.
Die unabhängige Nachprüfung hat den begrenzten
[Autorencheckpoint P-B](TW06-P-B.md) als Entscheidungsbasis übernommen. Nur aktive Bandseiten plus vorhandene Groundnäherung; keine zusätzliche49-Band-/Legacy-Previewgleichheit. Kanonische Höhe besitzt konservativ
±50e6 m; lokale Folge-Drafts halten diese Hülle bisher nicht ein. Ein bloßer
Transport-Reject oder Gesamtground-Clamp ersetzt keine bandweise Sättigung.
Formfunktionen und kanonische Speicherwahrheit bleiben maßgeblich; der dafür
notwendige Preview-Datenanschluss erweitert den bisherigen P-Schreibumfang
gezielt in den oben abgegrenzten Produktabschnitten. Bei wirklich begrenztem Suffix P≤32 ist die abgeleitete Draft-Rechenhülle±116e6, kein Clamp; Checkpoint/Retention müssen das erst belegen.

Bedingte Repräsentation danach: **56 B Basis und 24 B absolutes Draftfeld je
Vertex**. XY unverändert, Höhen und rohe physische Gradienten im Worker in
Double vorbereiten und je Komponente als `hi=f32(x), lo=f32(x-hi)` packen.
Alt-/Neu-/Draftslots bleiben pro Draw konstante Uniforms. Kein frühzeitiges
`hi+lo` vor einem nötigen vertikalen Darstellungsursprungsabzug. Beide Picker
an denselben gepackten tatsächlichen Screenstand binden.

Die konkrete CPU-Auswertung und erzeugte GLSL-Operationsfolge sind in B lokal
gebunden; R2 sichert inzwischen die unmittelbare Endfeldwahl beiAlpha1. Aktuelle
bedingte Höhen-/Gradientenhüllen, Fehlerrechnung und12.000 unabhängige rationale
Float32-Fälle stehen im Produkt-B-Handoff, nicht in der überholten50e6-Referenz.
Das ist kein Compiler-/GPUbeweis. C muss die tatsächliche Double-Vorbereitung
anschließen; D den vertikalen Darstellungsursprung und die Endrundung korrekt
behandeln. Compilerkontraktion/-umordnung, Readback und sichtbare Detailqualität
bleiben am tatsächlichen neuen Programm zu prüfen. Keine vierte12-B-Variante.
Verluste bereits vorhandener Quellraster werden damit nicht rückgängig gemacht.

Keine Normalisierung im VS; die vorhandene FS normalisiert. Typen und Bedeutung
von `fieldHeight`, `fieldWorld`, `fieldSlots` bleiben. Die alte Normalisierung
dreier Knoten vor Interpolation entfällt bewusst. Familienintern gleiche affine Gradienten
auf groben Rändern erhalten; neue Licht-/Stein-/Schnee-/Küstenbilder belegen
Produktqualität. Höhen und Formen nicht reduzieren, um das Format einzuhalten.

## Tatsächlicher Draftauftrag und Lebensdauer

Der vorhandene Rasterpfad stoppt bei Draft den Worker. P muss auch den echten
Draftauftrag im vorhandenen Worker bearbeiten, an bestätigte Geometrie,
Alt-/Neumodelle, eingefrorenes Alpha, Quelle/Epoche/Inhalt und kumulativen Draft
gebunden. Kein synchroner Renderer-Fallback oder weiterer Worker.
Kanonische Bildnachladung während der Geste pausieren; bildunabhängige Autorencheckpoints gemäß P-B laufen weiter. Für Bildjobs gilt: ein laufender Auftrag plus
ungekopiertes kumulatives Latest-Ziel. Vorbereitete Basis/Knoten/Stencils je
Generation halten und mitzählen, kein K2-Neuaufbau pro Pointerevent. Belegte
kanonische Jobs von2,0–2,7s sind ein Risiko, keine gemessene Draftlatenz.
Bestätigte Basis/Produkte bleiben unveränderlich bis tatsächlichem Nachfolgedraw;
späte Antworten nach Escape/Commit/Quellenwechsel/Dispose übernehmen nichts.
Der konkrete Vertrag unten bleibt Grundlage; A–F setzen den in P-B begrenzt
belegten Autorenband-/Checkpointanschluss produktiv um.

## Konkreter Vorbereitungsvertrag P (Start 20:26 UTC)

Die abgeschlossene Vorbereitung von `tw06_boundary_implementation`,
gpt-6.1-sol/high, begann26.10.2026 20:26 UTC. Sie änderte nur dieses Paket
und isolierte CPU-Zählhilfen; sie selbst lieferte keine Produktänderung oder
native Probe. Die aktuelle Produktarbeit steht oben. Die folgende Schnittstelle ist der begrenzte Umsetzungsvorschlag,
kein bereits implementiertes Protokoll. Producerpayload, endgültige Ressourcenrechnung und numerischer Nachweis
blockieren weiterhin die Übernahme als vollständig ausführbaren P-Vertrag.

### Nachrichten und Inhaltsbindung

```ts
type Source = {token:string; fence:string; revision:number};
type Basis = {generation:number; topology:number; manifest:number};
type Binding = {
  epoch:number; job:number; operation:number; requestContent:number;
  target:Source;
};
type Screen = {
  surfaceGeneration:number; frameRevision:number; fieldState:number;
  content:number; alpha:number; basis:Basis; draftRevision:number;
};
type Capture = {
  id:number; editSeries:number; gesture:number; draftRevision:number;
  // Immutable dispatch copy, never the live author arrays.
  tiles:readonly (AtlasSurfaceTile|null)[]; sourceIds:readonly number[];
};
type Prepare = Binding & {
  kind:'prepare'; from:Basis|null; fromEnd:Screen|null;
  sources:Capture; request:string; camera:string; complete:boolean;
  commitThrough?:{editSeries:number; draftRevision:number; target:Source};
  inventory:Readonly<Record<string,number>>; // only numeric counts; local graphs stay local
};
type Draft = Binding & {
  kind:'draft'; basis:Basis; frozen:Screen; capture:Capture;
  inventory:Readonly<Record<string,number>>; // only numeric counts; local graphs stay local
};
type Result = Binding & {
  kind:'result'; captureId:number; basis:Basis; draftRevision:number;
  // Canonical: compact base, unchanged K2 indices/draws, sources, XY ray index.
  // Draft: same basis identity + 24B/vertex field + five display channels.
  payload:unknown; buffers:readonly {id:number; buffer:ArrayBuffer}[];
  metrics:Record<string,number>; error?:string;
};
type Settle = Binding & {
  kind:'settle'; outcome:'screen-confirmed'|'discarded'; screen?:Screen;
  retainedBases:readonly Basis[]; retainedBufferIds:readonly number[];
};
```

`epoch` ist die eine Workerinstanz für die aktive Kampagne, `job` monoton je
Instanz, `operation` die Invalidierung durch Escape/Undo/Quellenwechsel,
`requestContent` eine Absicht vor Surfaceübernahme. Die Surface vergibt einen
anderen tatsächlichen `content`; er wird erst durch den korrigierten K3-Beleg
mit Screen-Generation, Frame-Revision, Feldzustand, Inhalt und gezeichnetem
Float32-Alpha verbunden. Alpha ist der tatsächlich hochgeladene Float32-Uniformwert,
nicht ein erneut berechneter Double-Zeitquotient. Ein Screenbeleg ist Dispatch, keine GPU-Fertigstellung.
`Basis.generation` bindet genau das unveränderliche Attribut-/Indexpaket;
`topology` bindet K2-Draws/Indizes/Double-Ursprünge, `manifest` seine geordneten
Alt-/Neuquellen einschließlich Adresse, Source, Rastermaßen und Buffer-IDs.
Kein ID-Recycling innerhalb der Epoche, keine Identität allein aus LOD/Adresse.

Kanonische Quellen sind durch die bestehende Token/Fence/Revision und die
validierten zusammengehörigen Höhen-/Materialantworten gebunden. Der Worker
kennt keine DB und lädt nichts nach. Im Draft sind Originalquelle und
kumulativer `draftRevision` getrennt: mutierte Autorenarrays behalten häufig
Objektidentität. Jede erfolgreiche Preview erhöht deshalb die Inhaltsnummer.
Erst beim Dispatch wird synchron einmal `structuredClone` erstellt und ihm
`Capture.id` zugewiesen; nur dessen neue Buffer werden transferiert. Die
Antwort muss sämtliche Bindungen unverändert zurückgeben. Es braucht keinen
37-MB-Hash im Pointerpfad: Capture-ID bezeichnet genau diese unveränderliche
Kopie, nicht einen später aus mutierbaren Arrays rekonstruierten Inhalt.

Die Codec-ID-Tabelle wird aus **allen noch lebenden Snapshotbesitzern** gespeist,
nicht nur dem neuesten Resultat. Float32-/Uint32-/Uint8-Views behalten Offset,
Länge und ganze Backingstores. Neue Workeroriginale werden genau einmal für den
Renderer kopiert; Transport überträgt diese Kopie, kein dritter JS-Uploadbuffer.
Der nur im Renderer benötigte neue Rayindex wird direkt transferiert und nicht
zusätzlich im Worker gehalten. Keine theoretische Aliasersparnis: dieses
Besitzverhältnis muss der Übernahmetest mit echten Bufferidentitäten belegen.

### Queue, Bestätigung und Freigabe

Ein laufender Auftrag, ein ungekopiertes kumulatives Latest-Ziel. Während
Workerrechnung oder noch unbestätigtem Resultat wird kein weiterer Auftrag
kopiert. Latest ersetzt nur Darstellungszwischenstände; `AtlasSurfaceDraft`
und die vorhandene `TerrainStrokeQueue` enthalten alle Autorenänderungen.
Kanonische Nachladung pausiert während der Geste. `gesture(true)` terminiert
keinen Worker mehr; es pinnt den letzten echten Screenstand einschließlich
Alpha und verwirft ausschließlich nicht bestätigte Kandidaten. Ein bereits
laufender synchroner Workerjob darf fertig werden; seine veraltete Antwort wird
kontrolliert verworfen, dann startet das aktuelle kumulative Ziel. Diese Wartezeit
zählt zur ersten Draftlatenz. Kein zweiter Worker oder Renderer-Fallback.

Der Worker hält `confirmed`, `pending` und eine Registry gepinnter Basen.
`prepare` promoviert seine Modelle **nicht** vor `settle`. `discarded` schließt
auch einen inzwischen invalidierten Job mit dessen ursprünglicher Bindung ab;
es ist kein `displayed`. Bei `screen-confirmed` pinnt der Worker die tatsächlich
gezeichnete Basis. Die kanonische Nachladebarriere bleibt zusätzlich bis zum
bestätigten Alpha1-Endbild bestehen. Frame-/Jobantworten aus anderer Operation,
Quelle, Capture-/Basisgeneration oder nach Dispose übernehmen nichts.

Vor jeder Kopie/Allokation reservieren Worker und Surface reale ganze lebende
Backingstores plus die konkret nächste Allokation. Freigabe folgt tatsächlichen
Referenzen: bestätigter Screen, ausstehender Kandidat, Gestureanfang, Settle-
Endbild, Deck-Layer und laufender Workerjob. Freigabe alter Slots/Tabellen folgt
weiter dem korrigierten K3-Vertrag. Alte Basis-/Knotencaches fallen erst bei
vollständigem Referenzabbau; Dispose terminiert einmal und leert alle Registry-
und Queuebesitzer. Definite Fehler führen zum vorhandenen Fehlerweg; kein Retry.
Neue Frames verlängern keinen Bestätigungs- oder Jobdeadline.

Pro Workerdispatch gilt als vorgeschlagene feste Vorbereitungsgrenze 15 s,
orientiert am vorhandenen `waitForFrame(15000)` und den belegten 2,0–2,7 s
kanonischer Rechnung. Für die tatsächliche Screenbestätigung wird **die finale
K3-Frist** übernommen, keine konkurrierende neue Screenfrist. Fehlende Commit-
Antwort ist kein Screenfehler: höchstens 15 s angesammelte geschlossene Wartezeit
je Editserie ohne verlässlichen kanonischen Folgestand; aktive Geste pausiert
nur diesen Zähler, setzt ihn nicht zurück. Danach bestehender Fehler-/Klärweg,
letztes bestätigtes Bild halten, keine selbständige Storagewiederholung und keine
späte automatische Übernahme. Diese Präsentationsfrist setzt keine I/O-Antwort
als Erfolg und ändert weder Speichertransaktion noch `TerrainStrokeQueue`.

### Frozen Draft, folgende Geste und Commit

Der Draft verwendet dieselbe K2-Topologie und denselben Basisbuffer. Er liefert
absolute `hDraft,gDraft.xy` auf der **kanonischen Neuquellenbasis**, nicht eine
neue Form oder normalisierte Vektoren. Die 24 B bleiben ein eigener bestätigter
und ein vorbereiteter Buffer; der Escape-Anfang besitzt zusätzlich einen
ausdrücklich Renderer-only CPU-Stand. Das angezeigte Feld ist mathematisch weiterhin
`mix(old,new,alpha) + (draft-new)`. No-Draft und unveränderte Komponenten müssen
denselben regulären Mixpfad wie der kanonische Stand behalten. Die bedingte neue hi/lo-Auswertung ist oben als noch zu prüfender Vertrag
beschrieben; alte numerische Fehlvorlagen werden nicht integriert.

Bei Pointer-up ohne neuere Folgegeste den **letzten kumulativen** Draft wirklich
bestätigen. Beginnt B vor dem noch unbestätigten finalen A-Bild, darf B dieses
durch seinen kumulativen Stand ersetzen. A bleibt genau einmal in Autorenstand
und Schreibqueue; ein verspäteter A-Screen darf nicht innerhalb B erscheinen.
Nach tatsächlicher Bestätigung des aktuellen kumulativen Standes Alt→Neu ab genau dem
bestätigten Alpha mit unverändert gehaltenem kumulativem Draft fortsetzen:
180 ms × verbleibender Alphaanteil, kein Neustart von Alpha0 und kein erzwungener
Midpoint. FS und seine drei Materialgruppen bleiben dabei unverändert.

Der reale Pointerdown-Guard in `atlas-raster-presentation.ts` darf einen
kanonischen Pendingkandidaten nicht schon wegen `terrainFrameUsable=false`
vor `gesture(true)` ablehnen. Fortsetzung aus gültigem bestätigtem Screen
**gleicher Kamera und Quelle** vor oder in dieser Autorisierung ermöglichen;
kein Bypass bei Kamera-/Quellen-/Kontextwechsel oder fehlendem Screen.

Eine unmittelbar folgende Geste hält den zuletzt bestätigten Settleframe wieder
an. Sie startet mit dem vorigen lokalen Autorenresultat inklusive Editing-
Ground und Materialien; `AtlasSurfaceDraft` unterstützt dieses Verhalten bereits.
Sie bleibt in derselben Editserie und derselben ursprünglichen kanonischen
Neuquellenbasis, erhöht aber Gesture-/Draftrevision. Ihr absolutes Draftpaket
enthält den **gesamten** kumulativen Stand. Ein bereits vorbereiteter kanonischer
Folgekandidat wird verworfen. Keine blockierte oder still ignorierte Geste.
Für Escape bleibt A, der tatsächliche Anfang von B, als **Renderer-only
CPU-Snapshot** erhalten: fünf Kanäle, gepacktes Feld und Screen-/Basisreferenzen
sowie Autorenanfang. Keine dritte dauerhaft gepinnte GPU-Draftbank. Nach
B-Screenerfolg dürfen A-Slots frei werden; mehrere B-Updates und pending C
halten trotzdem A-CPU unverändert.

Bei Escape Operation invalidieren und C vollständig verwerfen/freigeben;
B bleibt bestätigtes Bild. A aus gehaltenen CPU-Produkten in freie Slots laden,
erneut durch K3 bestätigen, erst danach B freigeben. Workerbestätigung für A,
Cacheinvalidierung und nächster Rebuild müssen in der konkreten Umsetzung
gebunden sein. Jede Rückkopie vorab reservieren; nicht gleichzeitig mit
weiterlebendem C-Scratch als Alias abziehen. Escape verwirft nur B; vorige
abgeschlossene Gesten/Schreibaufträge bleiben bestehen. Dieser Restorepeak
gehört noch in die vollständige Etatentscheidung.

Endbildbestätigung und Speichermatching sind zwei Bedingungen. Erst ein echter
Alpha1-Screen beendet die eingefrorene Alt→Neu-Bewegung. Erst
`reconcile(revision,fence)` nach leerer Schreibqueue und geschlossener Geste
belegt die bestehende bestätigte Autorenfolge; es wird mit genau diesem
`editSeries/draftRevision` als `commitThrough` verbunden. Trifft zuerst die
Speicherantwort ein, bleibt das sichtbare Endbild ausstehend; trifft zuerst das
Endbild ein, bleiben seine Daten gehalten. Neue Geste macht ein älteres
`commitThrough` unzureichend. Unbekannte/fehlgeschlagene Antwort bleibt unbekannt;
späte Antwort nach Verwerfen/Quellenwechsel stellt keine Geste wieder her.

Nach bestätigtem Alpha1 sind die fünf ursprünglichen Draftquellkanäle auf dem
uniformen Neuquellenraster als **Altquelle des folgenden kanonischen Übergangs**
verwendbar. Kein Resampling einer Zwischenalpha-Fläche und kein Warten auf
zufällig höhenidentische DB-Raster. Vorschau und kanonisches Ergebnis können
wegen vorhandener Preview-Näherung oder geänderter LOD verschieden sein; dann
regulärer K2-Übergang von diesen gehaltenen Draftquellen zum bestätigten
kanonischen Folgestand. Vorher numerisch belegen, dass das gezeichnete gepackte
Alpha1-Feld auf den tatsächlichen Draftquellen liegt; Abweichung nicht durch
neue Detailtoleranzen verdecken. Material folgt derselben bestehenden FS:
bei Alpha1 ist `new+(draft-new)` das Draftmaterial; anschließend ist es die
Altmaterialgruppe. Tatsächliche Rundung/Filterung und Küstenbild bleiben E-Gate.

Vor der nächsten kanonischen Generation wird ein echter Endframe mit pro Draw
`oldSlot=-1` bestätigt. Das entfernt die bei Alpha1 sonst noch ausgeführten
alten FS-Abfragen und autorisiert den Abbau der nicht mehr verwendeten Altbank;
hOld/gOld im gepackten Basisbuffer bleiben bis dessen Freigabe unverändert.
So bleibt der physische 128-Layer-Vertrag auch beim Folgestand endlich:
32 verbleibende kanonische, 32 bestätigte Draft-, 32 pending/neue kanonische
und höchstens 32 weitere tatsächlich benötigte Slots. Drei volle kanonische
Generationen plus zwei Draftgruppen dürfen nicht gleichzeitig angelegt werden.

Undo/Redo oder externer gleicher-Kampagne-Quellenwechsel invalidieren Latest und
aktuelle Operation. Eine bereits gezeichnete Zwischenalpha-Basis wird bis zu
ihrem gebundenen Endframe regulär abgeschlossen, dann folgt der neue kanonische
Zielstand; kein ungeprüftes Zwischenalpha→Uniform-Rebase. Diese höchstens 180 ms
Morphrestzeit ist zu messen. Kampagnen-/Tokenwechsel und Dispose beenden die
Epoche; ihre Daten und Antworten dürfen niemals in der neuen Kampagne erscheinen.
Der bestehende Autoren-/Storageentscheid bestimmt, was gespeichert ist; P
interpretiert Escape oder Undo nicht selbst als Speicherrollback.

### Vorbereitete Knoten, Stencils und beide Pickeinstiege

Korrekturvertrag nach dem negativen4→8m-Endpunktfall: Die Altquellenmenge (höchstens32 Quellen) und
die Neuquellenmenge (höchstens32 Quellen) bilden jeweils eine Endpunktfamilie mit stabilen nodalen Rohgradienten
auf ihrer eigenen affinen Partition. K4 löst innerhalb jeder Familie Randbesitzer,
physische Stütze, einseitige Nenner, Randsegmente/T/Ecken auf. Draft verwendet die
New-Familienpartition. Fremde Unionknoten dürfen keine zusätzlichen Gradientenknicke
in einer Familie erzeugen. K2 wertet beide Felder aus und muss beide Partitionen
verfeinern. Normalisierung ausschließlich im FS; keine drei normalisierten Vektoren
interpolieren. Die frühere gemeinsame Alt-/Neustützweite ist damit ersetzt.

Old kann bei Basispackung unmittelbar ausgewertet werden; New/Draft behalten
je Vertex drei Uint32-Knotenindizes und zwei Double-Gewichte (**28B/Vertex**).
Aktuell100B/nativeFamilienknoten; maximal drei physische Caches, separat
gefrorene Gradientarrays und Draftscratch sind im akzeptierten C-Handoff gezählt.
F ergänzt tatsächliche integrierte Lebenszeitüberlappungen. Zwei gehaltene Basisregistries sind eine Vorabgrenze, kein
nachträgliches Trimmen nach Anlage einer dritten pendingBasis.

Jeder kumulative Draft vergleicht seine 65²-Höhen pro Quelle mit dem gehaltenen
bestätigten Draft bzw. kanonischen Ziel. Geänderte Quellknoten erzeugen Quelle-
Bitmaske und Weltrechteck; Knoten mit passender Maske/Rechtecküberschneidung
werden neu ausgewertet, sonst ihren alten absoluten Draftgradient behalten.
Abhängigkeiten enthalten auch grobe Randauflösung und einseitige Centerabfragen,
nicht nur den geometrischen Pinselradius. Verwerfen kann den veränderlichen
Draftcache invalidieren; dann ein vollständiger einmaliger Neuaufbau der
Draftwerte auf denselben vorbereiteten Koordinaten/Stencils, kein K2-Neuaufbau.
Keine Qualitätsaussage aus einem noch nicht gemessenen Cachehit.

Rayvorbereitung einmal pro K2-Topologie: pro Draw lokaler XY-BVH, Blatt höchstens
acht vorhandene indizierte Dreiecke; 32 B je Knoten (vier Float32-Grenzen,
vier Uint32-Baum-/Blattfelder) plus Uint32-Triangleordinal je Dreieck. Double-
Drawursprung bleibt separat. Grenzen aus den tatsächlichen lokalen Float32-XY-
Vertices; keine Höhen-AABB, die nach Draft veraltet. Höhen erst am getroffenen
Kandidaten aus bestätigtem gepackten Basis-/Draftfeld und demselben Alpha
bestimmen; ursprüngliche Indizes/Diagonalen verwenden. Aufbau temporär zwei
Float64-Zentrumswerte je Dreieck, kein allgemeiner Objekt-BVH pro Draft.

`AtlasDeckSurface.terrainRay`, Surface-Pick und Raster-Autoren-/Navigationspick
lesen denselben tatsächlichen Screenstand. `navigationPoint` darf das Ergebnis
nicht anschließend mit analytischem `this.height` überschreiben; auch benötigte
vertikale Höhenabfragen kommen aus dem gepackten Dreieck. Kein analytischer
Fallback auf die rohen Quellen, wenn das Feld noch unbestätigt ist. Handgerechnete
Dreiecks-/Float32-Erwartungen bleiben unabhängig vom Produktionshelper.

### Aktuelle B-Inventur und bedingte Probeetats

Die konkrete aktuelle Rechnung und Besitzer-/Transporttabellen stehen im gebundenen
B-Handoff und `counts.json`. Historische32/12-,50e6-,824.353.788B- und gepackte
13.815.480B-Seedreferenzen sind keine aktuellen Gesamtbelege. Der neue Objekt-DTO
überträgt DisplaySource statt vollständiger Modelgraphen; Metadaten werden separat
codiert und sind keine erfundenen festen Descriptorbytes.

Konservativ ohne unbewiesene Quellteilung:1.070.580.220B Modellbesitzer (acht32er-
Quellgruppen für zwei Basisgenerationen, jeweilsAlt/Neu in Worker/Renderer),
860.162.352B zusätzliche A-Besitzer einschließlich ausgehenderAuthorResultkopie
und193.484.288B voller Restore ergeben **2.124.226.860B Backingstores**. Bekannte
zusätzliche UTF16-/Aktions-/numerische Metadateninhalte einschließlich518.480B
ausgehender Deskriptorinhalte ergeben **2.334.868.300B**; R1 begrenzt die Closingbindung. Objekt-/SQLiteheap/GC/Uploadspitzen
bleiben tatsächlich zu messen.3GiB ist ein Beobachtungsvorschlag, kein Hardcap.
Tatsächliche IDs trennen logische Inhalte und physische Stores; Klone voll zählen,
nur realen Transfer oder nachgewiesene Aliase abziehen. E darf bestehende
Rasterbesitzer erst nach wirklichem Referenzabbau aus der Bilanz entfernen.

Getrennte Backingstore-Transportarten: kanonische Rohquellen37.273.984B,
maximaler A-Seed13.762.816B, Autorenresultat152.174.848B,
Feldresultat98.146.080B, Draft41.309.440B.40/160MiB sind nur Backingstoregates,
keine universellen Browser-/Electronclonegrößen. Autor+Feld250.320.928B passt
nicht als gemeinsames160MiB-Resultat; vollständiger A-Stand nicht als40MiB-Eingabe.
C rekonstruiert unbekannte Vollstände regulär aus Checkpoint+immutable Suffix und
getrennten Seeds, ohne gültige Geste zu verwerfen oder Rendererfallback.

GPUgeometrie61.245.856B bleibt bedingt unter64MiB. Historisches Gesamtmodell
mitR32F532.531.374B ist **kein neuer GPUetatpass**; D zählt seine tatsächlichen
Basis-/Material-/Draftslotregistries, Tabellen, Framebuffer, Uploads und Restores
vor Allokation. Acht CPUquellgruppen beweisen keine GPUressourcenteilung.
Kein weiterer GPUbesitzer wurde in B angelegt. NativeHeap/RSS/Peak/Plateau und
GPU-/Bildnachweise bleiben eigene Pflicht; kein Etaterfolg allein aus Formeln.

### Belegfortgeltung und offene numerische Qualifikation

Gebundener erster Vertrag: `.build/terrain-water-p/tw06-p-contract-20261026/manifest.json`,
SHA256 `bde89c35bcaa25aae1909b42fbda062f6687f68ca118c0a96aba255d1703702f`.
Vor K3-Edits erhaltene tatsächliche Bytes liegen unter
`.build/terrain-water-p/tw06-p-contract-snapshot-20261026-2117/`;
relative Manifestpfade beziehen sich dort auf diesen Snapshot, nicht Livecode.
Die ursprüngliche P-Dokumentfassung ist außerdem unter Git-Blobref
`refs/codex/snapshots/tw06-p-before-producer-p-1793049392` gesichert.

Relatives Float32-Delta verlor kleine Zielhöhen; naive absolute Umordnung
verlor einen geänderten Alpha0-Anteil; kompensierte12-B-Auswertung bestand
17 Teilfälle plus12 gemeinsame Randeingaben, scheiterte aber beim vom alten
Validator akzeptierten1e35-Fall. Diese lokale Reihe ist beendet, kein weiterer
Splitter-/Packfix. Belege bleiben negativ; keine P-Runtime wurde gebaut.
Alle endlichen Float32 sind technische Bestandseigenschaft, kein Nutzerziel.

Kanonisch begrenzte Autorenbänder, tatsächlicher lokaler kumulativer Pinselstand
und Transportgates werden durch A/B auf Grundlage von P-B konsistent verbunden. Keine
Gesamtground-Begrenzung, die gültige Bandänderungen abschneidet. Frühere
Quell-XY-/LOD-/Material-/Meerregeln bleiben, bis ein begründeter konkreter
Änderungsauftrag etwas anderes entscheidet. Neue hi/lo-Auswertung wird aus
geprüfter Produzentenhülle und vollständiger Budgetrechnung umgesetzt und
separat am tatsächlichen Shader qualifiziert. Alte CPU-Arithmetikbelege sind
kein Nachweis dieses neuen Programms.

Vorbereitung20:26–21:02:40 UTC hat Verträge/Ownerrechnung konkretisiert, aber
keinen Produktpass geliefert. P-Start und bisherige Problemgeschichte zählen
weiter. Die frühere3–5-h-Schätzung ist durch die begrenzte Produktzerlegung
oben ersetzt; deren Gesamthypothese verlängert keine gemeinsame Grenze.

## Reihenfolge und lokale Übernahme

Finale Gesamtübernahme: A → B → (C parallel D, übernommen) → vollständiges E
→ gezielte E-Nachprüfung → vollständiges F und Nachprüfung. Das vorhandene frühe
Hardwaregate wird ausschließlich nach der oben begrenzten06:28-Reihenfolge nach
S1/S2 und laufbezogenem F vorgezogen; es ersetzt diese Gesamtübernahme nicht. Abhängige Arbeit wartet
auf konkrete lokale Ergebnisse, nicht nur eine Planfreigabe. K3/E-R3 sind bereits
lokal unabhängig akzeptiert; keine Wiederholung ihrer allgemeinen Prüfung.

Lokale Regressionen: A-final pending → B → spätes A → B-Update → Escape;
realer Pointerdown bei kanonischem Pendingkandidaten; volle Alt-/Neubänke,
mehrere bestätigte B-Updates und pending C, dann Escape. Exaktes Undo gegen
kanonische Höhen/Materialien, nicht nur IDs. Außerdem Alt/Neu/Draft bei Alpha 0/0,5/1 und eingefrorenem
Zwischenalpha, gemeinsame grobe Randgradienten, T-/Eck-/überdeckte Elternränder,
negative/große Ursprünge einschließlich 1-m-Detail; neue Float32-Höhenattribute
gegen unabhängige Dreiecksinterpolation. Queue/Latest/Verwerfen/Commit/Escape
und Dispose an wirklichen Besitzerübergängen, keine verlorenen Änderungen.
K3-Screendrawfälle und die neuen Deltabuffer zusammen prüfen. Bestehende
Tests inhaltlich erweitern, keine parallele allgemeine Suite; Capability-
Verknüpfungen für tatsächlich geprüfte Abläufe pflegen.

## Frühes repräsentatives Hardwaregate

Vor Launch liefert der P-Runtimebesitzer das vollständige aktuelle assemblierte
VS-/FS-Paar einschließlich Bibliotheksprolog/Defines mit unabhängig
nachvollziehbarer Quellen-/Runtimebindung an den akzeptierten E-R3-Harness.
Dessen Packhelper assembliert GLSL nicht; ein ausführbarer Offline-Erstellungsweg
für den neuen Kandidaten fehlt noch. Das historische K4-Paar legitimiert keine
neue Runtime. Keine zusätzliche native Beschaffungsprobe daraus ableiten;
dieser Anschluss gehört zum P-Handoff vor dem bereits geplanten Hardwaregate.

Besitzer: bestehender E-Implementierer gpt-6.1-sol/high, exklusiver Build-/Gerätelauf.
Privates UHD620-/Wayland-Verfahren ohne Hostentsperren; eingefrorene aktuelle
Quell-/Runtime-/Fixturebindung. Tatsächliches neues VS + voller FS mit
Produktionsressourcen linken und zeichnen; vorhandene externen Compiler-
Schutzgrenzen bei erstmaliger Vorbereitung erhalten. Kein reiner Linkpass
als Ersatz für vollständigen aktuellen Screendraw und Terrainbild.

Aus bestehenden K4-/F1-Fällen eine feste kleine repräsentative Fahrt ableiten:
Misch-LOD-T-/Eck-/überdeckte Elternränder, schmale Autorenküste, feine Form;
256²-RGBA8-Materialarrays linear/clamp, RGBA32F-Metadaten nearest. Alt/Neu/Draft
aktiv, Alpha 0/0,5/1 sowie Geste in tatsächlich bestätigtem Zwischenalpha.
Welt→20 m→Welt kontinuierlich, mehrere lokale Draftupdates, Loslassen/Commit,
Escape und exaktes Undo. Unberührte Form und Material erhalten. Beide
Pickeinstiege gegen unabhängige Interpolation gepackter Höhenattribute binden.

Separat den vorhandenen großen K2-Fall mit 1.117 aktiven Übergangsdraws als
synthetische reale Draw-/Ressourcenlast messen, nicht als typische Streamlast.
Reale Rendergröße/UI-Skalierung, aktive Sampler, Bandpixelanteil, sichtbare
Draws und Upload-/CPU-/Drawzeiten getrennt berichten. Kein künstlich
bildfüllender Materialsaum. GPU-Timer nur fertig/nichtdisjunkt verwenden;
sie isolieren nicht automatisch Fragmentkosten.

E friert vor Lauf genau eine schwierige Werkzeug-/Maßstab-/Skalierungskombination
aus bestehender Messfixture mit **30 vollständigen vorab geplanten Versuchen**
ein; jeder startet vom selben eingefrorenen Ausgangsstand. 30 Updates einer
warmen Geste genügen nicht. Wahl aus repräsentativer Pinsel-/Detailarbeit
begründen; Messung vom Pointereingang bis geändertem Terrainbild. Erster Draft inklusive
Initialisierung zählt. Sichtbare Wirkung je Sample belegen, keine Ersatzsamples;
p95 ≤ 100 ms. Ein einzelner Wert >100 ms ist noch kein p95-Verstoß. Geladene
Navigationsframes gegen 33,3 ms berichten, keine volle G5-Freigabe ableiten.
Kopie/Queue/Worker/Rücktransport/Übernahme/Upload/erster Terrainframe trennen.

Positiv: vollständige aktuelle Screendraws und geänderte Terrainbilder, keine
Risse/Detailverluste/harten Licht-/Küstenwechsel, keine verlorene Geste,
der [begrenzte Ressourcen-/Schutzvertrag](#f--begrenzter-früher-messanschluss)
und bestandener begrenzter Leistungsentscheid. Direkt stoppen bei ungültigem Draw, fehlender sichtbarer
Wirkung/verlorener Eingabe, Kontextverlust, erneutem Compiler-RAMtrigger,
sichtbarer Detail-/Randverletzung oder nicht eingeordneter Allokation/Schutzverletzung. Negativer
abgeschlossener Leistungsentscheid führt zum Rootentscheid; keine offene
Pack-/Shaderoptimierungsserie. Teilbefunde und ursprüngliche Geschichte erhalten.

Material zunächst beibehalten. Falsche Ränder begründen gezielte Korrektur;
langsamer Gesamtframe allein keinen Materialumbau. Erst vorhandene Upload-/CPU-/
Drawmessung nutzen. Nur bei verbleibender konkreter Fragmentfrage kann Root
einen kontrollierten Pixelmengenvergleich bei identischem Programm, Geometrie
und Uploads begründen; hier noch nicht freigegeben.

## Zeitrahmen, Fortsetzung und Belegfortgeltung

Aufwände, Rahmen und Entscheidungen stehen ausschließlich in der Produktzerlegung
oben. P-A/P-B sind abgeschlossen, A/B samt Fix unabhängig übernommen. C/D sind
lokal unabhängig akzeptiert; aktuelle gemeinsame Entscheidung ausschließlich im Plan.
Ursprünglicher P-Start26.10.20:26 und alle Warte-/Prüfzeiten zählen weiter.
Frühe native Probe0,5–1h exklusive Gerätezeit plus gezielte Nachprüfung bleibt
bedingt. Keine Zusage einer Gesamtfertigzeit, kein neues Startdatum durch Aufteilung.

M1/M2-Formkern und K1 bleiben. K2-Topologie-/Präzisionsfälle bleiben Grundlagen;
gepackte Höhen-/Buffer-/Raygleichheit neu belegen. K4-Höhen-/Materialfälle
bleiben, alte Normalenwerte beweisen keine identische neue Schattierung.
K3-Teilfälle bleiben; Screenframe und neue Delta-Lebensdauer müssen bestehen.
C/U-Negativbelege und C01 bleiben unverändert. Positiver Durchstich erlaubt
die restlichen E/Q/G5- und Lieferprüfungen, ersetzt sie nicht. Keine pauschale
Wiederholung unberührter Tests oder Umetikettierung alter Laufzeiten.
