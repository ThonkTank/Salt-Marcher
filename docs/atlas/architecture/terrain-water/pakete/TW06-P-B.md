# TW06-P-B — Begrenzter Autorencheckpoint vor weiterer Umsetzung

Status: Begrenzter Entscheidungsbeleg am26.10.22:37 UTC unabhängig akzeptiert und vom Hauptchat übernommen. Tatsächlicher Produktbesitzer/aktive Geste, fortsetzbare Modellarbeit, SQL-Höhenprojektion, globale Etats und Präzision bleiben Umsetzungspflichten im bestehenden P-Auftrag; keine weitere isolierte Probenserie.
Owner: bisheriger P-Implementierer tw06_boundary_implementation, gpt-6.1-sol/high.
Last Reviewed: 2026-10-26
Source of Truth: Ein einziger ausführbarer Entscheidungsbeleg für Präfix, Seitenfreigabe und begrenzten Folgegestenstand.

## Ergebnis und Eingaben

Ein kanonischer Autorencheckpoint schreitet unabhängig vom angezeigten Bild
fort. Aktive Bandseiten tragen die bandweise Sättigung; das vorhandene
begrenzte Ground liefert weiter die Näherungsquelle. Main behält exakte
Formregeln, Sampling, Routenkopplung und Speicherung. Keine zusätzlich
erfundene vollständige Previewgleichheit für Smooth/Level, keine 49-Band-
oder gefilterte Legacykopie. Sichtbare Übergänge und Details bleiben spätere
Produktkriterien.

[P-A](TW06-P-A.md) belegt die feste Folge und den Istfehler. Maßgeblicher
Freeze: `.build/terrain-water-p/tw06-p-a-20261026/manifest.json`, SHA256
`202e45082b3eda9f3e5184d776057b607b523f8205a11984b7f201ddf2659c72`.
Offenes Review: `01a179b3-ced4-7dd2-bd61-16dd07fd0bc5`.
Die 46,9-MB-Seedrechnung und 1,486-GB-Illustration gehören zur verworfenen
Vollgleichheitserweiterung; sie sind keine neuen Etats.

Gezielte Quellen: `terrain-stroke-queue.ts`, `landscape-brush-session.ts`,
`campaign-atlas-ui.ts` und tatsächlicher kanonischer Write-/Receiptpfad;
`desktop/atlas-region.ts`, `desktop/atlas-region-worker.ts`, zugehöriger
Workervertrag und vorhandene Store-/Worker-Testeinstiege. Dazu die bereits
gebundenen `terrain-height.ts`, `terrain-brush.ts`, `terrain-brush-draft.ts`
und P-A-Probe. Keine breite neue Bestandsaufnahme.

## Ein konkreter Anschluss

- Geschlossene Gesten behalten unveränderliche lokale Ordinale, Gesten-ID,
  Command-ID und Inhalt. Nach bestätigtem Write folgt innerhalb derselben
  seriellen Queue ein Checkpointread **vor** dem nächsten Write. Der bislang
  synchrone `accepted`-Callback braucht dafür einen tatsächlichen asynchronen
  Abschluss. Quelle/Fence/Revision und akzeptierter lokaler Präfix sind exakt
  gebunden; eine höhere Revision allein beweist keinen eigenen Präfix.
- Der gepinnte Read liefert vollständige aktive Bandcoverage und kanonisches
  Doubleground an den eingefrorenen Darstellungsquellknoten. Bild, Material und
  Picking bleiben davon unberührt. Basis atomar installieren, ausschließlich
  unveränderten Suffix dahinter erneut vorbereiten, jeweils vom Gestenanfang.
  Grounddelta = Interpolate(neues Band) minus Interpolate(Anfangsband).
- Kalte Bandfenster sequenziell nachladen: höchstens ein neuer Seed unterwegs,
  Latest hält nur eine gewünschte Fenster-ID. Alte bestätigte Seiten/Aktionen
  erst nach vollständiger Installation freigeben. Alte Serie, alter Seed oder
  fremde Fence darf weder installieren noch freigeben. Die Bildübernahme oder
  eine leere Gestenqueue ist ausdrücklich keine Freigabebedingung.
- Bei Unknown bleibt das bestehende Freeze. Eine bereits angenommene nächste
  Aktion bleibt unverändert und ungesendet erhalten, auch wenn UI/Recovery die
  bisherige Queue ersetzt. Explizite Receipt-Klärung wiederholt keinen Write.
  Receipt `applied` enthält keine ausreichende Fence/Revision: eine spätere
  Fortsetzung benötigt neue Serie und frischen Seed. Keine automatische
  Wiederaufnahme als Prüferfolg ausgeben.

## Begrenzung und numerische Hülle

D ≤ 256 veränderte Seiten je Geste; P ≤ 32 angenommene geschlossene, noch
**nicht checkpointete** Operationen plus eine aktive. Erst der wirkliche
Kapazitäts-/Retentionbesitzer kann K ≤ (P+1)D beweisen; `pendingWrites` allein
reicht nicht. Bei vollem Bestand oder Unknown keine bereits angenommene Geste
verlieren/kürzen. Aufnahme-/Freezeverhalten ausdrücklich prüfen. Unbegrenzt
weitere Annahmen bei dauerhaft unbekannter Antwort sind nicht beauftragt;
kein neuer dauerhafter Spool.

Aktives Bandfenster mit Halo konservativ W ≤ 774 Seiten. Die zu überprüfende
zusätzliche Seitenreservierung `(4K+2W+4D)*16.384 B` umfasst alten und neuen
Replaystand. Tatsächliche Bufferidentitäten zählen, außerdem beide IPC-Kopien,
Groundstände, Samples/Aktionen, Adapterheap und Escapeüberlapp. Kein pauschaler
Aliasabzug; nach Checkpoints darf bestätigte Historie nicht weiter anwachsen.
Seedgrößen, maximale Ein-/Ausgaben und tatsächliche Besitzer im Beleg ableiten.

Aus shape-preserving Bandinterpolation ±1e6 folgt Banddelta ±2e6. Mit
kanonischem Checkpointground |Hc| ≤ 50e6 ist die bedingte Hülle
`|Previewground| ≤ 50e6 + (P+1)*2e6`, bei nachgewiesenem P=32 also116e6.
Das ist kein Clamp oder neue Nutzergrenze. Ohne Checkpoint-/Suffixbeweis kein
Hüllenpass. P-Präzisions-/Gradientenrechnung anschließend auf diese tatsächliche
Hülle anpassen; hier keine vierte 12-B-Arithmetikvariante.

## Ausführung und feste entscheidende Folge

Die existierende isolierte Probe erweitern: echte Queue in isolierter Kopie
mit minimaler Checkpoint-/Retentionanpassung, tatsächlicher kanonischer
Store-/Write-/Receiptpfad und AtlasRegionService/Node-Worker, minimaler
isolierter Autorenread. Keine erfundenen Storeergebnisse. Transportverzögerung
und Antwortverlust dürfen gezielt injiziert werden und sind als solche zu
kennzeichnen. Ein laufender Electron-Main oder echte Bridge-IPC ist hier
nicht qualifiziert; deren Verdrahtung bleibt gebundener Anschlussvertrag.

Erfolgszweig: bestehende Sättigung → sofortiges Lower bei verzögerter Antwort
→ Bandwechsel. Insgesamt96 räumlich getrennte Gesten, kanonische Bildübernahme
durchgehend zurückhalten. Jeder dritte Zug wechselt Band/kaltes Fenster;
mindestens zwei disjunkte gehaltene Folgegesten enthalten Smooth/Level.
Geste97 beginnen und Escape. Jeder Commit genau einmal, kein Doppelreplay,
Capturewiederholung stabil, Escape korrekt, keine fortwachsende bestätigte
Seitenhistorie. Raise/Lower-Bandbytes exakt; Smooth/Level korrekt bandgesättigt
und innerhalb deklarierter Hülle, ohne zusätzliche kanonische Previewgleichheit.

Getrennter Fehlerabzweig: Commit48 erfolgt, Antwort verloren,49 bereits
angenommen. Unknown verhindert weitere Writes und erhält49 unverändert.
Explizite Receipt-Klärung ohne Replay; danach verspätete48-Antwort und alter
Seed. Keine alte Serie wiederbeleben oder49 still verwerfen.

Wirebeleg im selben Lauf reparieren: getrennte16-KiB-Seiten brauchen passende
Buffer-IDs, Offset0, wirkliche Version und vollständige Coverage. Komplettes
Paket tatsächlich decodieren/validieren, alle Werte/Identitäten prüfen;
fehlende Coverage negativ. Einen vorhandenen NaN-Knoten einschließen. Der
bisherige Clone-/Detach-Beleg allein war kein gültiger Payloadnachweis.

## Schreibbereich, Zeit und Abschluss

Nur eigener isolierter Ordner unter `.build/terrain-water-p/` und dieses
Paketdokument. Vorhandene Komponenten dürfen dort gezielt gebündelt/kopiert
und mit dem minimalen Autorenread erweitert werden; kein Überschreiben der
gemeinsamen Buildassets. Keine Live-Produkt-/Main-/Preload-/Storageänderung,
kein Produktbuild, keine native/Compilerprobe oder vollständige Testsuite.
Root besitzt gemeinsamen Plan, TW06 und P. E-R3 arbeitet unabhängig am Harness.

Aufwandshypothese20–35 aktive Minuten; **höchstens35 Minuten Kalender ab
Rootstart bis Ergebnis oder konkretem Rootentscheid**. Der kurze Rahmen ist
eine Entscheidungsgrenze, keine zugesagte Fertigstellung: vorhandene feste
Vorlage und Store-/Queuekomponenten wiederverwenden, keinen neuen Simulator
oder allgemeine Infrastruktur bauen. Nach15 Minuten tatsächlichen Anschluss
oder konkreten Blocker melden. Kein automatischer weiterer Versuch bei
fehlender Quelle/Präfixbindung, Retention oder Freigabe.

Handoff: ausführbare Probe, tatsächliche Quell-/Runtimebindung, vollständiger
Payloaddecode, Identitäts-/Speicherzählung und getrennte Ergebnisse beider
Zweige. Initialisierung, Seedmiss, Checkpoint und Replay zeitlich getrennt
offenlegen; keine100-ms-/Nativebehauptung. Root und offenes Review entscheiden
danach tragfähigen Anschluss, numerische Hülle/Etats und neu begründeten
P-Restaufwand. K3 bleibt lokal akzeptiert. P-Code und neue Hardwareläufe
warten weiter. P-Start26.10.20:26, Kontrolle27.10.00:26 und ursprüngliche
TW06-Zeit bleiben einschließlich dieser Warte-/Probezeit unverändert.


## Gebundenes Ergebnis P-B

Der eine vereinfachte Anschluss ist **headless positiv**, mit ausdrücklich
getrennter Ressourcenentscheidung. Es wurden ausschließlich drei isolierte
Kopien erweitert: `TerrainStrokeQueue` um asynchrones `accepted` und einen
extern gehaltenen Retentionbesitzer, `AtlasRegionService` um einen Autorenread
auf seiner bestehenden Autorenlane und derselbe Node-Worker um diesen Read.
Der echte `CampaignStore`, kanonische Brush-/Pyramidpfad, SQL-Write und Receipt
blieben unverändert. Keine Änderungen an Live-Produktquellen, kein Produktbuild,
kein Electron-/Bridge-IPC-, Screen-, Material-, Shader- oder Native-UI-Pass.

Ausführbarer Freeze unter
`.build/terrain-water-p/tw06-p-b-20261026/manifest.json`:
`setup.mjs`, `probe.mjs`, `wire-audit.mjs`, `count.mjs`, `isolated.patch`,
`result.json`, `summary.json`, `counts.json`, `wire-packet.v8`,
`wire-identities.json` und `source-binding.json`. Die gebündelten
`runtime.cjs`/`worker.cjs` wurden nach dem Quellenfreeze identisch erneut
hergestellt. 351 tatsächliche transitive/gezielte Quelldateien sind im
`source-snapshot/` gebunden; Node22.22.0 und das tatsächlich geladene
SQLite-Modul sind mit Hash im Sourcebinding bezeichnet. Die drei isolierten
TypeScriptkopien sind ausführbare Probequellen, keine produktfertige
Typ-/Bridgeimplementierung. Kein Produkt-Typcheck oder vorhandener Testsuitenpass
wird daraus abgeleitet.

### Tatsächlicher Anschluss und Freigabe

Jede Annahme erzeugt einen unveränderlichen Capture mit eigener lokaler
Ordinalzahl, Gesten-ID, Command-ID und Inhalt. `retention.entries`, nicht der
abnehmende `pending`-Zähler, besitzt die noch nicht checkpointeten Captures.
Der Writecallback prüft vor jedem tatsächlichen kanonischen Write
`acceptedPrefix === ordinal-1`. Nach dessen Ack wird im selben seriellen
Queuefortschritt der genaue Quellstand gelesen, Receipt-ID/Fingerprint im
gepinnten Worker-Snapshot geprüft und der eigene unveränderte Suffix erneut
vorbereitet. Erst nach Read/Replay setzt die Queue den Präfix und gibt den
Capture frei. Ein Ack oder eine größere Revision allein gibt nichts frei.
Maßgebliche unveränderte Eingänge: `store.ts:406` (Strokequelle), `:413`
(Write), `:443` (Receiptklärung), `:463` (Quellfence),
`campaign-atlas.ts:435` (Receipt ohne Replay), `terrain-scale.ts:115`
(kanonische Berechnung); Worker-Snapshot/Readersync in
`desktop/atlas-region-worker.ts:51`, bestehende Workerinstanz in
`desktop/atlas-region.ts:200`.

Autorenreads sind strikt sequenziell: ein kaltes aktives Bandfenster und eine
gewünschte Folgeposition, keine Fensterwarteschlange und kein weiterer Worker.
Die Fixture hält dieselben eingefrorenen 65²-Groundknoten. Aktive Bandseiten
werden vollständig mit vier Knoten Halo an ihrer tatsächlichen `height.x/y`
selektiert; die kanonischen RTree-/Objektgrenzen enthalten bereits einen
Interpolationshalo und dürfen dafür nicht als Seitenursprung gelten.
Ground verwendet den vorhandenen `landscapeSampleFilter` und
`terrainHeightSources`/`accumulateHeightSources` als Stream, jeweils ein
Quellpayload und ein Auflösungslevel. Keine vollständige Welt-Höhenliste,
keine 49-Band-Seedkopie. Der Stream erhält das Doubleground vor der sonstigen
Float32-Ausgabe; Main berechnet und speichert weiterhin exakt. Smooth/Level
verwenden lokal das bestehende approximative Ground. Es wird keine vollständige
kanonische Smooth-/Level-Previewgleichheit behauptet.

Die Probe bindet Epoch/Serie, Präfix, Token, Fence, Revision und Receipt im
Paket, aktive Fenstercoverage im Decoder und die feste Groundlattice im
Probeeingang. Die spätere Produktverdrahtung muss zusätzlich die bereits in P
geforderten Quellenknoten-/Kamera-/Latest-Generationen durchgehend mitführen;
Kamerafolgen oder frei wechselnde Groundlattices sind hier nicht getestet.
Ein kurzer positiver Read ist keine Erlaubnis für fremde Quellen oder eine
automatische Unknown-Wiederaufnahme.

### Feste Folge und Grenzen des Nachweises

Finaler fester Lauf: **22:21:41–22:22:17 UTC**, `pass:true`.
Alle96 Gesten benutzen reale `applyTerrainBrush`-Captures und den tatsächlichen
kanonischen Store-/Workerpfad. Die ersten beiden teilen absichtlich das
Sättigungsfenster; danach sind die Räume getrennt. Anfangsband999999,5 m,
Raise bis zur Bandsättigung, sofortiges Lower bei zurückgehaltener Antwort,
danach Bandwechsel. Der spätere tatsächliche Originwert ist wieder999999,5 m;
alle Raise/Lower-Bandbytes stimmen mit dem kanonischen Ergebnis überein.
Jeder dritte Zug verwendet Radius64/Band2/kaltes Fenster, andere Radius32/Band1.
Die disjunkten Paare17/18 und53/54 enthalten Smooth/Level und sind jeweils
zusammen gehalten; ihre wiederholten Captures sind bytegleich und bandgesättigt.
Die Smoothfenster liegen auf zuvor leerem Ground: Stabilität/No-change wird
geprüft, keine sichtbare Glättungsstärke oder kanonische Smoothgleichheit.

96 tatsächliche Writes und96 abgeschlossene Checkpoints, Präfix96,
0 gehaltene Captures und0 Vorhersageseiten danach, **0 Bildübernahmen**.
Der erste Write ist gezielt verzögert;32 geschlossene Captures sind bereits
angenommen. Eine weitere geschlossene Aufnahme wird an dieser Kapazität
abgewiesen, während die aktive33 unverändert gehalten bleibt. Nach Freigabe
wird genau dieser Capture einmal übernommen. Das ist ein bewiesenes
Kapazitäts-/Besitzerverhalten der isolierten Vorlage; die tatsächliche UI-
Hinweis-/Aufnahmeverdrahtung bleibt Produktarbeit. Geste97 erstellt einen
separaten Previewstand; Escape löst ihren aktiven Besitzer und erhält die
unveränderten Anfangsbandbytes ohne97. Write. Der spätere Renderer-/Worker-
Displayrestore wird hier lediglich gezählt, nicht ausgeführt.

Getrennter Unknownzweig: Commit48 wird tatsächlich gespeichert, seine Antwort
gezielt verloren,49 zuvor angenommen. Genau48 Writes, eigener Präfix47,
Retention `[48,49]`. Der Queueersatz teilt denselben Retentionbesitzer;50 wird
abgewiesen,49 bleibt mit gleichem Inhalts-/Identitätshash erhalten. Der echte
Store-Receiptread bestätigt48 als `applied`, erzeugt keinen Write und enthält
keine `sourceFence`. Eine verspätete48-Antwort darf den gefrorenen Besitzer
nicht verändern. Ein tatsächlich gehaltenes Paket mit Präfix47/Serie1 wird
gegen Wiederaufnahme-Serie2 decodiert und abgewiesen.49 bleibt unverändert.
Es gibt **keine automatische Fortsetzung**; neue Serie plus frischer genauer
Seed bleiben zwingender Anschluss vor einer späteren Fortsetzung.

816 vollständige Paketdecodes im festen Lauf: eindeutige Buffer-IDs,
4096 Float32 je separater16-KiB-Seite, Offset0, tatsächliche gespeicherte
Seitenrevision, bekannte Bandversion2, vollständige Coverage und alle Werte.
Die fehlende Coverage wird negativ geprüft. `wire-audit.mjs` bindet zusätzlich
ein echtes resultierendes Paket als V8-Datei und SHA pro Backingstore:
vier Seiten + Ground + Descriptor + Coverage = sieben getrennte Backingstores,
99.648 B, darunter ein vorhandener NaN-Knoten. Node→Host benutzt tatsächliches
`postMessage`-Cloning; Host→Rendererclone und Renderer→Modellworkertransfer
werden im Headlesslauf ausdrücklich durch `structuredClone` nachgestellt.
Nach Transfer ist der sendende Descriptorbuffer detached. Das ist kein echter
Electron-Main-/Preload-/Bridge-Pass.

### Vollständige Reservierung und Etatentscheidung

`counts.json` trennt ausgeführte kleine Fälle und konservative Produktreserve:
D256, nachgewiesener Retentionvertrag P32 plus aktive Geste, K8448;
W774 folgt aus maximal `(nx+2)(ny+2)` bei `nx*ny<=256` (1×256).
Vier vollständige K-Versionen (alter/neuer Workerreplay, Renderer-Escapeanfang,
Renderer-confirmed/pending-Union), zwei W-Fenster und vier D-Arbeitsstände
werden ohne unbewiesenes Sharing reserviert:
**`(4K+2W+4D)*16384 = 595.787.776 B`**.
Zwei weitere Seedtransportkopien werden zusätzlich und vollständig gezählt.

Ein maximaler Seed enthält12.681.216 B Seiten,49.536 B Seitendescriptoren,
1.081.600 B Ground,56 B Coverage,2.048 B Griddescriptoren und vorgeschlagene
1.024 B Bindungsreserve: **13.815.480 B**. Ein geändertes Gestenresultat
braucht höchstens4.194.304 B Seiten +16.384 B Descriptoren sowie Ground,
Suffixmanifest und gepackte Samples. Das bisherige P56-Resultat steigt
konservativ von153.068.832 auf **158.901.792 B**.40-MiB-Eingabe und
160-MiB-Resultat bleiben dafür plausible Vorschläge, kein freigegebener Gatepass.

Weitere Besitzer werden getrennt vollständig reserviert: sieben Groundstände,
fünf K-Manifeste, Fenster-/Griddescriptoren,1 MiB Samplingblockscratch und
ursprüngliche/gehaltene Samples (bis2×33×20.000×24 B). Escape bei gesundem
Worker darf den gehaltenen Anfang über Identität erreichen; die konservative
Reserve zählt trotzdem einen fehlenden D-Seiten-Anfang, Ground,
34.095.232 B Displayprodukte,7.214.208 B gepacktes Feld und540.672 B Manifest:
**47.126.016 B zusätzlicher Restorepeak**. Ein älterer C-Scratch wird dabei
nicht als vorzeitig frei abgezogen. Mit der unabhängigen P56-Grundreserve
824.353.788 B entstehen **1.538.002.908 B Backingstores einschließlich Restore**.

Die tatsächliche Probe benutzt weiterhin `LandscapeRecord`-/Brush-Adapter mit
Base64daten. Diese bleiben neben decodierten Float32-Seiten lebendig; ein
künftiger reiner Typed-Pagebesitzer ist hier nicht bewiesen. Konservativ werden
zwei K-Replaybestände, W Node-Read-Zeilen und zwei D-Adapterübergänge nochmals
als UTF16-Base64payload (`21848*2` B/Seite) reserviert, dazu ausdrücklich
vorgeschlagene1200 B Metadatapayload je Record: **816.299.072 B**.
Die Summe beträgt **2.354.301.980 B** vor zusätzlichem V8-Objekt-/Mapheap,
SQLite-/TEMP-/Prozess-RSS. Metadaten-/Bindungsreserven sind sichtbare technische
Annahmen, kein neu validiertes universelles Produktmaximum. Die Zahlen sind
eine konservative Payloadreservierung und ausdrücklich **kein globaler Heap-/
Ressourcenpass**. Weniger Kopien oder typed-only Speicherung dürfen erst nach
einem tatsächlichen Besitzer-/Freigabebeleg abgezogen werden.

Technischer Vorschlag zur Root-/Reviewentscheidung: vorläufig **3 GiB CPU
inklusive Rawstream/Adapterheap**,40 MiB Eingabe,160 MiB Resultat;
64 MiB Geometrie/512 MiB GPU bleiben die vorhandenen bedingten Vorschläge.
896 MiB reicht für diese konservative Umsetzung nicht. Die Etats sind interne
Vorschläge und kein Grund, gültige Gesten zu kürzen oder Detailtreue abzusenken.
Das tatsächliche Zielgerät, Reaktionszeiten und sichtbare Übergänge entscheiden.

Im festen kleinen Lauf waren maximal32 geschlossene Captures,
128 Vorhersageseiten und2.396.096 B durch Identität deduplizierte,
im Hosttracker zugängliche Backingstores gleichzeitig erfasst;
Actions als JSON8268 B. Der Tracker umfasst ausdrücklich weder Nodeworker-Heap
noch SQL, Objekt-/Mapheap oder die absichtlich für Prüfung gehaltene
Command-/Receipt-Instrumentierung. Typischer direkter Folgezustand mit zwei
kleinen geschlossenen Gesten plus einer aktiven, D4/W4/K12, hätte nach derselben
reinen Seitenformel1.179.648 B; das ist kein gemessener ganzer Produktzustand.
Nach bestätigtem Präfix verbleiben weder Vorhersageseiten noch bestätigte
Aktionshistorie im Retentionbesitzer.

Bedingte numerische Hülle: kanonisches Ground≤50e6 m, pro Bandänderung≤2e6 m,
höchstens33 kumulative lokale Operationen ergeben **|Previewground|≤116e6 m**.
Kein Clamp und keine neue Nutzergrenze. Die P-Höhen-/Gradientenpräzision ist
auf diese Hülle neu zu rechnen; keine vierte12-B-Arithmetikvariante wurde
versucht. Die drei bisherigen negativen Vorlagen bleiben unverändert erhalten.

### Zeiten, offene Entscheidung und Rückgabe

Zeiten in `summary.json`, auf diesem Host und dieser kleinen Fixture, kein
100-ms-/Produktlatenzversprechen. Initialisierung229,5/358,7 ms (zwei Fälle).
Seedroundtrip Median5,50/p9521,12/max223,72 ms; tatsächlicher Node-Read
Median4,12/p9519,29/max28,38 ms. Akzeptierter Checkpoint **inklusive Suffixreplay**
Median30,95/p95833,60/max1652,39 ms; Replay selbst Median41,80/p95726,24/
max1668,11 ms. Kanonische Vorbereitung Median8,27/max173,99 ms;
Write Median21,92/max49,95 ms. Clone/Transfer separat erfasst. Zeiten
überlappen und dürfen nicht addiert werden; sie beweisen keine Skalierung
auf32 Quellen oder den maximalen256-Seitenfall. Gerade der32er-Suffix ist
sichtbar teuer und bleibt eine spätere Produkt-/Zielgerätefrage.

Ein konkreter lokaler Fehler wurde bei der Abschlussrechnung gefunden:
der erste Autorenread materialisierte alle Welt-Höhenrecords. Der positive
Fixturelauf ist unter `before/second-run/` erhalten und war deshalb kein globaler
Heapbeleg. Die begrenzte Korrektur selektierte zunächst über haloerweiterte
`min_x/y`; der vollständige Decoder erkannte fehlende echte Versionen.
Dieser fehlgeschlagene Zwischenstand ist unter `before/bounded-read-failed/`
erhalten. Nach belegter Ursache wurde auf `height.x/y` korrigiert;
derselbe feste Lauf ist nun positiv. Zwei enge Readkorrekturen, keine offene
Variantenserie. Der erste einfache Lauf ist zusätzlich unter `before/first-run/`
erhalten. Einmalige Inhalte/SQLite-Fälle wurden vor Ersetzung verschoben.

**Rückgabe jetzt:** Prefix-/Retention-/Wire-/Unknownanschluss ist isoliert
belegt. Root und gezieltes Review entscheiden Payload-/CPUetat und späteren
P-Implementierungsumfang, insbesondere Adapterbesitzer, tatsächliche
Bridge-/Workerverdrahtung, generationsgebundene Latestfenster,32-Quellen-
Skalierung, Höhengenauigkeit116e6 und sichtbare Restore-/Folgegestenübergänge.
Keine automatische weitere Optimierung, Produktänderung oder Hardwareprobe.
P-B endet innerhalb seiner35-Minuten-Grenze. Original-P20:26→00:26 und
ursprüngliche TW06-Zeit/Versuchshistorie bleiben unverändert.
