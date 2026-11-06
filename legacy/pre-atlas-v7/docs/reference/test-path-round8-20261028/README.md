# Normaler Prüfweg, Kosten und begrenzte Schutzwirkungen — Runde 8

Status: Lokaler Vergleich; Candidate, Paket, Zielgerät und Ownerabnahme separat.
Owner: project
Last Reviewed: 2026-10-28
Source of Truth: [Messwerte und Quellenbindung](measurements.json), normale Runnerberichte und konkrete Testassertions. Keine zweite aktuelle Capabilityliste.

Der normale `npm test -- <Datei>`-Weg startet ohne manuelle Cgroup. Tatsächliche
2/3-GiB-Grenzen bleiben erhalten. Kein aktiver Test und keine Fachassertion wurde
für den Zeitvergleich entfernt. Die 709 Sekunden vom früheren Stand sind kein
aktueller Benchmark; CI ist kein Bestandteil dieser lokalen Messreihe.

## Startfehler und Prozessbesitz

Der ursprüngliche Normalaufruf blieb reproduzierbar vor jedem Test in einer
inaktiven systemd-Scope mit wartendem Startjob stehen und brach nach 30 Sekunden
ab. Ein eigener kurzer Service-Start blieb ebenfalls wartend; Auskunftsaufrufe an
den Benutzermanager funktionierten weiter. Fünf ältere inaktive Stopjobs waren
bereits vorher vorhanden. Ein genau eingegrenzter Hostfehler im systemd-internen
Dispatcher ist damit nicht bewiesen. Appschutz, fremde Jobs und der Benutzer-
manager wurden nicht neu gestartet oder verändert.

Der Launcher nutzt den bereits delegierten eigenen systemd-Benutzerbaum, wenn
dessen Memorycontroller verfügbar ist. Er erzeugt ausschließlich eine neue eigene
Cgroup, schreibt und prüft die Grenzen und startet darin einen kleinen Entry,
der seine tatsächliche Mitgliedschaft und die wirksamen Vorfahrengrenzen prüft,
bevor er den Prüfbefehl startet. Engere Grenzen bleiben erhalten. Ohne Delegation
bleibt die begrenzte systemd-Scope der Startweg; ein Fehler löst keinen weiteren
Prüfstart aus. Ein Timeout storniert den eigenen wartenden Startjob, statt einen
weiteren wartenden Stopjob zu erzeugen.

Der Besitzer bleibt außerhalb seiner Gruppe und wartet auf das eigene Prozessende.
Danach entfernt er verbliebene Nachkommen einschließlich abgetrennter Prozesse
und die leere Gruppe. Signalignorierende Prozesse erhalten zwei Sekunden Frist;
die gezielte Abbruchprobe endete danach mit SIGKILL und wird als Abbruch geführt.
Normales Ende, dieser Abbruch und das Entfernen eines abgetrennten Kindes sind
mit tatsächlichen PIDs und deren Verschwinden belegt. Der echte blockierte
systemd-Gegenlauf startete keinen Prüfbefehl und hinterließ keinen eigenen Job.
Die fünf vorher vorhandenen fremden Jobs bleiben unberührt.

Startablehnung, Timeout, Erfolg ohne bestätigten Entry, unbekannte Mitgliedschaft,
fehlendes Programm und Signal-/Exitweitergabe sind zusätzlich im aktiven
Launcher-/Policytest geprüft. Details: `.build/round8-point4/scope-before.log`,
`launcher-probes.json`, `launcher-probes.log` und `.build/local-checks/`.

## Aktuelle Messung und begrenzte Optimierung

Node 22.19.0, npm, ein Testprozess, derselbe Dirty-Checkout auf `5c679da32` und
jeweils eine eigene tatsächliche 2/3-GiB-Cgroup. Der Messwrapper hält die
Produktions-, Desktop-, Test-, Tool- und Konfigurationshashes vor und nach jedem
Lauf fest. Die Betriebssystem-Dateicaches wurden nicht geleert. Eigene Builds,
Tests und native Proben liefen nacheinander. Die aktive Desktopumgebung blieb
bestehen. In der getrennten Fünf-Sekunden-Stichprobe belegten der Benutzermanager
87 %, der Codexrenderer 33 %, uresourced 20 % und Appschutz 6 % eines CPU-Kerns;
das ist Fremdlast und kein vom Test erzeugter Gewinn. Linuxlast und Druckwerte
stehen im jeweiligen `host.json`.

Die vollständige Ausgangsmessung bestand: 313 Dateien, 2606 Fälle, 2605 bestanden,
null Fehler, ein optionaler SRD-PDF-Skip. Gesamter äußerer Lauf 726,641 Sekunden,
Runner 726,245 Sekunden, 765,08 Sekunden User-CPU und 59,47 Sekunden System-CPU,
maximales Prozess-RSS 1.328.332 KiB und Cgroup-Peak 1.764.065.280 Bytes. Quellen
vor/nach dem Lauf sind identisch. Der Ausgangslauf beginnt nach Reparatur des
Launchers; der ursprüngliche Fehlstart bleibt separat erhalten.

Die größten beobachteten Dateiprozesse waren die fünf TypeScriptumgebungen samt
Browser-Capabilityproben (mindestens 55,92 s / 83,79 s CPU), Materialtiles
(19,29 / 24,45), Terrainrouten (19,28 / 22,33), Reise (17,28 / 19,86) und die
vollständige Referenzwelt (17,26 / 18,40). Das sind Ein-Sekunden-Prozessstichproben
und Untergrenzen, keine exakten Einzeldatei-Timings. Vollständige Compilerprüfung,
Rasterarbeit, Storeinitialisierung, Fehlerfälle und Neustarts bleiben erhalten.

Identische Quellen wurden im Cachehelfer mehrfach vollständig gelesen/gehasht.
Der vorhandene Helfer wiederverwendet nun ausschließlich im selben Prozess
bereits ermittelte Quelldigests bei gleichem Gerät, Inode, Größe und
Nanosekunden-mtime/ctime. Vor/nach dem ersten Lesen müssen die Metadaten ebenfalls
übereinstimmen. Jeder Scan entdeckt weiterhin Hinzufügen/Entfernen. Ergebnisse
bleiben SHA-256-Inhaltsschlüssel; Ausgaben werden immer vollständig gehasht.
Gleich lange Änderungen mit wiederhergestellter mtime und exakte Wiederherstellung
sind geprüft. Es werden keine Store-, Datenbank-, Worker- oder Editorinstanzen geteilt.

Vier abwechselnde Paare mit je sechs Scans desselben unveränderten Quellenbaums
lieferten denselben Inhaltsschlüssel. Original: 212,1 / 147,2 / 147,7 / 154,1 ms;
Wiederverwendung: 83,9 / 36,5 / 39,7 / 34,4 ms. Das erste Paar enthält den ersten
Scan; der Gewinn betrifft wiederholte Scans innerhalb eines Prozesses.
Ein erster Scan kann durch die zusätzlichen Metadatenprüfungen teurer sein.

| Unveränderte Auswahl | Vorher warm, Runner | Nachher warm, Runner | Shared-Vorbereitung vorher/nachher |
| --- | ---: | ---: | ---: |
| Atlas, vier Dateien | 5,162 s | 5,054 s | 95,8 / 84,1 ms |
| Store/Transfer, drei Dateien | 7,058 s | 6,963 s | 53,5 / 74,1 ms |

Die Unterschiede von rund 0,1 s sind kein belastbarer allgemeiner Suite-Speedup.
Der kalte Atlaslauf musste zwei neue Bundles zum geänderten Helferfingerprint
bauen: 5,973 s Runner, 902,3 ms Shared-Vorbereitung. Cachezustand und Quellenbindung
stehen separat im Bericht. Die Auswahl und Fachfälle dieser fünf Messungen sind
identisch; die zusätzlichen Fachfälle entstanden erst danach. Keine Änderung an
Parallelität, Standardsuite oder Candidate-Gates. Ein Gesamtziel unter 300 s bleibt offen.

## Heutige Wirkung, erforderliche Lücke und ausdrückliche Produktänderung

Der bestehende einmalige historische Abgleich umfasst elf entfernte Dateien mit
1731 Assertstellen. Vor dieser Runde waren 409 konkret zugeordnet und 1322 offen;
die fünf bereits ergänzten Schutzgruppen mit 384 Erwartungen bleiben erhalten.
Sieben konkrete Erwartungen des verspäteten Preparation-Receipts besitzen nun
die direkten aktuellen Assertionbelege: 416 zugeordnet, 1315 weiterhin offen.
Das ursprüngliche Inventar bleibt bytegenau als `assertion-inventory-before-round8.json`
erhalten; dies ist weiterhin der einmalige Altvergleich, kein aktueller Coveragekatalog.
Die Einordnung unten folgt den tatsächlichen Assertions und dem aktuellen
Terrain-/Wasservertrag (TW-G1–6, HEX-06/08/16), nicht Dateinamen oder Fallzahlen.
Unzugeordnet bleibt offen. Die aktuellen Ablauf-/Dateilinks besitzt ausschließlich
der gemeinsame Capability-Katalog.

| Fehlerwirkung / aktueller Umfang | Konkreter heutiger Beleg oder verbleibende Grenze |
| --- | --- |
| Arbeitsverlust durch gehaltene Folgezüge, Antwortverlust oder Kontextwechsel | `atlas-terrain-edits.test.mjs`: beide Gesten bleiben gehalten, Kampagnenwechsel wird verweigert, bestätigter Präfix wird nicht erneut geschrieben, Readfehler und spätere fremde Quelle verlangen die konkrete Entscheidung, Ausblenden/Wiederöffnen entwertet alte Receiptantworten. `atlas-ownership-boundaries.test.mjs`: verweigerte Grenze erhält Autorentwurf/Auswahl; alte Scope-/Objektantworten haben keine neue Auswahlhoheit. |
| Falsche Speicherbestätigung und Doppelwirkung | `desktop-atlas-commit-recovery.test.mjs`: echte Worker-/HostIpc-/Preload-/Authorgrenze klärt verlorene angewandte Antworten ohne Replay; neue direkte und Recoverygegenfälle behalten denselben Auftrag bei fremder Kampagne trotz passender Kennung, fehlendem Terrainfence, rückläufiger oder gebrochener Revision. Keine Invalidierung/Savedwirkung, keine zweite Dispatchwirkung und unveränderte SQLitebytes. |
| Fremde Preparation-Receiptantwort nach Kampagnenwechsel | Neuer Fall in `desktop-preparation-owner.test.mjs`: heutiger Entwurf erzeugt einen echten nicht angewandten Receiptread; seine verzögerte Antwort verändert weder neuen Rohtext, Titel, Vorlesetext, Meldungen noch SQLitebytes. Der nächste ausdrückliche Save schreibt nur Kampagne B; A bleibt unverändert. |
| Bestätigte Höhen/Meer, Historie und Neustart | `terrain-height.test.mjs`: Meeresspiegel und Abfragen nach Reopen/Archiv, grober Eingriff erhält ausdrücklich feine Daten; Transaktionsfehler bleiben ohne Teilwirkung. `terrain-live-history.test.mjs`: einmalige gruppierte Wirkung, Idempotenz und Wiederöffnung. `terrain-route.test.mjs`: Pflichtpunkte/Bettbudget, unmögliche Flüsse atomar abgewiesen, gemeinsames Undo und unabhängiger frischer Read. Diese Store-/Geometriebelege sind keine native Gesamtbedienabnahme. |
| Umfang direktes Malen statt gesonderter Terrainübernahme | Ausdrücklicher Nutzerentscheid im aktuellen Terrainvertrag: keine vorgeschaltete Umrissauswahl/gesonderte Übernahme. Entsprechende frühere Terrainpreview-Bedienerwartungen sind für diesen Fokus überholt. Preview-/Quellschutz für den ausdrücklich bestätigten Flusszyklus und bestehende Autorenentwürfe bleiben erforderlich. |
| Noch erforderliche unbelegte Detailwirkung | Vollständiger TW-G1–6-Ablauf am selben Paketstand, tatsächliche Bildqualität/LOD und Zielgerät-p95, vollständige Maus-/Textfokusabnahme, Spezialpinselnähte und der erweiterte Flussabschluss bleiben offen. Einheiten-/Prototypentests oder alte Zoombelege schließen dies nicht. |
| Übrige historische Erwartungen | Verschachtelte Notizmappen, Archiv-/Zeitcontrols, besondere Quellkontexte und weitere nicht konkret zugeordnete Fälle bleiben offen. Die Terrainfokussierung hebt deren bestehende Daten-/Entwurfsschutzregeln nicht auf. Keine pauschale Wiederherstellung alter Matrizen und keine pauschale Vollabdeckung. |

Acht neue ACK-Fälle, ein konkreter Preparation-Kontextfall und die gezielten
Launcher-/Cachefälle benutzen die vorhandenen öffentlichen Produktionsanschlüsse.
Sechs einzelne Gegenproben entfernten jeweils Kampagnenbindung, Fenceprüfung,
monotone/ganzzahlige Revision, Preparationowner oder ctime-Bindung. Jede zugehörige
neue Assertion scheiterte gezielt; die vollständigen Quellen einschließlich
vorbestehender Änderungen wurden jedes Mal bytegenau restauriert.
Details: `.build/round8-point4/counterprobes/report.json` und einzelne Logs.

## Abschluss und verbleibende Grenzen

Die vollständige Abschlussmessung bestand mit denselben **313 Dateien**, jetzt
**2617 Fällen / 2616 bestanden / null Fehler / einem optionalen SRD-PDF-Skip**.
Beide vollständigen Läufe haben unveränderte Quellen vor/nach ihrer Ausführung.
Zwischen ihnen ändern sich ausschließlich vier Testdateien und zwei Tooldateien;
die Produktions-/Desktopquellen sind identisch. Elf Laufzeitfälle kamen nach der
Ausgangsmessung hinzu. Über die ganze Runde entstanden fünf Launcher-/Policy-,
ein Cache- und neun fachliche Gegenfälle, insgesamt 15 zusätzliche Fälle.

| Größe | Ausgangslauf | Abschlusslauf |
| --- | ---: | ---: |
| Äußerer Gesamtlauf | 726,641 s | 722,901 s |
| Bestätigter Launcherstart | 66 ms | 63 ms |
| Katalogvorbereitung im Runner | 18,801 ms | 28,295 ms |
| Tests einschließlich dateieigener Shared-Assets | 726,226 s | 722,555 s |
| Root-Shared-Assetzeit innerhalb der Tests | 6,067 s | 6,091 s |
| Root-Builds / Treffer | 2 / 89 | 0 / 91 |
| User-CPU / System-CPU | 765,08 / 59,47 s | 762,66 / 58,68 s |
| Größter Prozess-RSS | 1.328.332 KiB | 1.344.816 KiB |
| Cgroup-Peak | 1.764.065.280 Bytes | 1.414.582.272 Bytes |

Die Gesamtdifferenz beträgt −3,740 s (−0,51 %), bei elf zusätzlichen Fällen.
Das ist **kein isolierter allgemeiner Beschleunigungsnachweis**. Insbesondere
wurde die Root-Assetvorbereitung insgesamt nicht günstiger; der Gewinn der
Digest-Wiederverwendung betrifft wiederholte identische Scans innerhalb desselben
Prozesses. Der erste Einzelaufruf kann teurer sein. Ausgangslauf und Schlusslauf
haben außerdem unterschiedliche Erstbuild-/Dateicachebedingungen und schwankende
Fremdlast. Die zweite Fünf-Sekunden-Probe fand rund 91 % eines CPU-Kerns beim
Benutzermanager und 22 % bei uresourced, während die App weniger CPU benötigte.
Die Speicherwerte sind tatsächliche Messwerte ihres Laufs, kein allgemeines
Ressourcenversprechen. Die sieben zusätzlichen Cache-Misses des Schlusslaufs
gehören zu absichtlich isolierten Cachegegenfällen; die Rootartefakte waren warm.

Die gezielte Auswahl besteht mit 44 Fällen. Repositoryprüfung, vollständige Typ-/
Umgebungsprüfung, Desktop-Typprüfung, beide Builds, Formatprüfung der geänderten
JS-Dateien, Python-Syntaxprüfung und `git diff --check` bestehen. Eine erste
Repositoryprüfung erfolgte noch vor dem Anlegen der neuen Referenzdatei und
meldete ihre zwei fehlenden Dokumentlinks; der erhaltene Fehlbeleg liegt separat,
die erneute Prüfung mit vorhandener Referenz besteht. Es gibt keine eigenen
verbliebenen Cgroups, Prozess-PIDs oder wartenden systemd-Jobs. Die fünf bereits
vorher vorhandenen fremden Stopjobs sind unverändert vorhanden.

Der ursprüngliche Bestand und sämtliche neuen Schutzfälle bleiben in der
Standardsuite. Native Produktbedienung wurde in
dieser Infrastruktur-/Teständerung nicht neu qualifiziert; die Launcherproben sind
konkrete Linux-Prozessproben. Alle nativen Bedienprüfungen bleiben ausschließlich
bei 100 Prozent Appzoom. Verpackung, Installation, Candidate-CI, Integration und
menschliche Ownerabnahme sind nicht Bestandteil dieses lokalen Auftrags.

Lokale Detailbelege: `.build/round8-point4/`; aktuelle Typ-/Buildprüfungen und beide
vollständigen Runnerberichte werden in [measurements.json](measurements.json)
referenziert. Die kleinen Auswahlen stehen in der bestehenden
[Testauswahlanleitung](../../project/verification/test-selections.md) und ersetzen Candidate nicht.

## Reviewkorrektur

Drei systemd-spezifische Gegenproben sind ausdrücklich auf Linux begrenzt, weil
Nicht-Linux den portablen Launcherweg verwendet. Die reine Delegationspfadprüfung
verwendet plattformgerechtes Path-Joining. Produktionsquellen blieben unverändert.
Der normale begrenzte Runner bestand danach alle zehn Launcher-/Policyfälle ohne
Skip auf Linux: `.build/test-runs/db308047-0c3b-4725-955d-ebff75238bbf/report.json`.
Die vollständigen Läufe oben wurden wiederverwendet; deren Quellbindung geht diesen
zwei Testdateiänderungen voraus. Ein Nicht-Linux-Lauf wird nicht behauptet.

## Fortsetzung des Restplans: Ursachen und begrenzte Wiederverwendung

Die vorstehenden 722,901 s werden als Ausgangsmessung weiterverwendet. Die
Fortsetzung verändert zwei Testdateien; Produktions-, Desktop-, Runner- und
Speicherpolicy bleiben gegenüber dem übernommenen Stand erhalten. Kein Fall
entfällt. Zwei zusätzliche Schutzfälle betreffen entwertete Quellenantworten.

Die fünf bereits benannten teuren Dateien wurden mit derselben Auswahl einzeln
instrumentiert. Die folgende sortierte Diagnose trennt synchron gemessene,
verschachtelungsbereinigte Kosten; ihre Summe enthält keine doppelt gezählten
Storeaufrufe. „Rest“ umfasst tatsächliche Berechnung, Fixture-/Modulladen und
nicht einzeln instrumentierte Arbeit, nicht bloße Wartezeit. Dies sind
Diagnosezeiten mit Instrumentierungsaufwand, kein zweiter Suitebenchmark.

| Datei | Gesamt | Compiler | Build | DB öffnen/initialisieren | Assertfunktionen | Store-Fachaufrufe | Rest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TypeScriptumgebungen | 57,461 s | 56,831 s | — | — | 0,002 s | — | 0,628 s |
| Terrainrouten | 20,897 s | — | 0,437 s | 0,347 s | 0,736 s | 6,319 s | 13,058 s |
| Materialtiles | 20,429 s | — | 0,364 s | 0,528 s | 0,006 s | 0,571 s | 18,961 s |
| Reise | 18,215 s | — | 0,067 s | 1,568 s | 0,012 s | 13,461 s | 3,106 s |
| Referenzwelt | 17,573 s | — | 0,094 s | 0,040 s | 6,382 s | 0,004 s | 11,053 s |

Die Referenz-Assertzeit enthält das echte Lesen und Hashen aller kanonischen
Tabellen sowie Integritätsprüfungen. Sie ist keine unnötige Assertionmenge.
Material-/Routenrest enthält insbesondere Raster-/Geometrieberechnung. Die
Katalogprojektion wird beim Laden des Bundles erzeugt; ihre verbleibenden
Installations-/Schreibkosten sind Teil der echten DBinitialisierung. In diesen
fünf Dateien werden die Regionsleser direkt ausgeführt, keine separaten
Produktworker gestartet. Esbuild besitzt zusätzlich einen internen Worker;
dessen erst später zugestelltes `online`-Ereignis enthält die blockierte
Ereignisschleife und darf nicht als Workerstartkosten addiert werden.

Eine getrennte aktuelle Probe von `atlas-first-product-worker.test.mjs` besteht
mit allen sechs Fällen in 6,875 s: echte Regionsworker einschließlich expliziter
Neustarts bleiben erhalten. 14 erste Workerantworten benötigen zusammen 4,634 s
und enthalten jeweils den ersten Fachauftrag. Die `online`-Benachrichtigungen
von 15 Threads einschließlich Esbuild summieren sich auf 0,864 s; auch diese
Beobachtungszeit ist keine isolierte Modulinitialisierung. Die übertragenen
workerinternen lokalen Traces trennen Regionsreads (1,054 s) und Synchronisierung
(0,095 s). Das gesamte gemessene Bundleladen einschließlich der statischen
Katalogprojektion benötigt 0,124 s; dies ist eine Obergrenze für diesen
Katalogteil, keine isolierte Katalogzeit. Keine prozessübergreifenden Uhren werden subtrahiert. DBinitialisierung,
Indexerstellung und erster Fachauftrag werden damit nicht fälschlich einem
reinen Threadstart zugeschlagen. Diagnosen und Skripte: `.build/round8-rest/`.

Als einziger relevanter vermeidbarer Block wurde der zweite Renderer-Compiler-
und Capabilitydurchlauf entfernt. Ein Programm enthält jetzt beide virtuellen
Prüfquellen neben sämtlichen originalen Produktionseinstiegen. Derselbe volle
TypeScriptcheck und dieselbe Browseranalyse liefern beide Assertiongruppen.
Die fünf unterschiedlichen Produktionsumgebungen bleiben fünf eigenständige
Programme. Für den zweiten Assertionsblock werden nur beobachtete Namen,
Fehlercodes und Zeilennummern gehalten; weder Compilerprogramm noch Host oder
Checker werden zwischen Umgebungen geteilt. Auch die isolierte Auswahl des
zweiten Falls initialisiert ihre benötigte Rendererprüfung selbst.

Der gezielte Compilervergleich besteht mit unveränderten sieben Fällen:
57,461 → 48,687 s, 6 → 5 Programme, 2 → 1 Browseranalysen; −8,774 s / −15,3 %
innerhalb dieser Datei. Die Browseranalyse umfasst weiterhin direkte, aliassierte,
indizierte, destrukturierte und native Importzugriffe. Produktionsdiagnostik,
zulässige Globals und sämtliche verbotenen Globals bleiben geprüft. Der kleine
Gewinn reicht für das Suiteziel nicht. Ein zweiter Optimierungsblock wurde nicht
auf Verdacht begonnen: DB-/Buildkosten sind hier klein; der übernommene Vollbericht
weist für 91 Root-Assettreffer insgesamt nur 6,091 s aus. Mehr Fingerprintarbeit
oder geteilte veränderliche Stores würden den gemessenen Haupttreiber verfehlen.

## Begrenzte Parallelitätsversuche und Ressourcenentscheidung

Zwei identische Versuche starten innerhalb jeweils einer tatsächlichen
2/3-GiB-Gruppe gleichzeitig genau zwei unabhängige Gruppen: TypeScript alleine
und die anderen vier Diagnose-Dateien seriell. Ihre Buildausgaben sind verschieden;
alle SQLite-Dateien und Verbindungen bleiben unabhängig. Das sind dieselben
88 Fälle, jeweils vollständig bestanden. Gesamtdauer der beiden Gruppen:
104,310 und 97,389 s. Ihre gemeinsame Cgroup einschließlich Runner, Compilern,
Esbuild und Nachkommen erreichte 1.980.796.928 beziehungsweise 1.928.249.344 Bytes.
High-, Max-, OOM- und OOM-Kill-Zähler blieben null. Speicher und Prozess-RSS wurden
alle 100 ms gemeinsam erfasst; die Kernel-Peaks ergänzen die Stichproben.

Gegenüber der seriellen Diagnose derselben fünf Dateien (126,533 s am Kandidaten)
zeigen diese engen Versuche einen Gruppengewinn von etwa 22 bis 29 s. Der Compiler
alleine wurde unter Konkurrenz allerdings langsamer: 68,273 / 63,659 s statt
48,687 s. Die Fremdlast und geteilten CPU-Kerne begrenzen den Durchsatz. Es wird
weder eine zweifache Skalierung noch ein Suitegewinn daraus hochgerechnet.

Ein zusätzlicher Wächter bricht den Versuch bei 95 % des tatsächlich wirksamen
High-Limits ab. Eine Gegenprobe senkte ausschließlich diese experimentelle
Abbruchschwelle auf 150 MiB: beide eigenen Gruppen endeten nach 0,434 s, der
Launcher bestätigte das Ende der Nachkommen und entfernte die eigene Cgroup. Das prüft den
Überlast-/Abbruchpfad; es ist ausdrücklich keine behauptete 3-GiB-OOM-Probe.
Kein Appprozess, fremder Job oder fremde Cgroup wurde beendet.


Ein zusätzlicher Versuch mit denselben fünf Dateien in drei Gruppen bestand bei
gleichzeitigem Start in 90,513 s mit 1.891.106.816 Bytes Peak. Die bewusst
ungünstig ausgerichtete Gegenprobe verzögerte den Referenzweltstart um 20 s,
sodass dessen DB-/Pufferspitze mit Compiler und Rasterarbeit zusammentraf.
Sie überschritt nach 29,375 s die 95-%-Schutzschwelle; der Kernelpeak betrug
2.045.038.592 Bytes. Alle drei Gruppen endeten, die eigene Cgroup wurde entfernt,
High-/OOM-Zähler blieben null. Das ist ein konkreter Ressourcenbefund gegen einen
pauschalen Mehrprozessstandard: ein günstiger Startplan ist kein verlässlicher
Speicherspielraum. Der Wächter griff vor dem eigentlichen High-Limit ein; weder
eine tatsächliche OOM-Grenze noch erfolgreiche vollständige Suiteparallelität
werden behauptet.

Der erste Erfolgspeak liegt bereits bei 92,2 % von `memory.high`; nur rund
159 MiB bleiben darunter. Die bestehende konservative Policy reserviert
512 MiB und kalkuliert 2 GiB pro Testprozess. Sie lässt im vorhandenen Budget
weiterhin einen Prozess zu. Die Versuche qualifizieren keine Kombination aller
313 Dateien: darunter befinden sich gemeinsame individuelle Ausgabepfade und
weitere Worker-/Compilerpeaks. Ein allgemeiner Parallelstandard würde deshalb
weiterhin eine Ressourcen-/Ausgabeisolation benötigen. Der konkrete Engpass sind
diese gemessene knappe Speicherspanne und die unter Konkurrenz zunehmende
Compilerzeit. Die Speichergrenzen und der normale serielle Standard bleiben
unverändert; ein einzelner Erfolg wurde nicht zum Default erhoben.

## Fehlerwirkungen des aktuellen Terrain-/Wasserumfangs

Dies ist die Fortsetzung des einmaligen historischen Wirkungsvergleichs, keine
zweite Capabilityliste und kein Zählen vermeintlich ersetzter Altassertions.
416 konkrete historische Zuordnungen und 1315 offene Stellen bleiben unverändert.
Die aktuellen Dateilinks werden ausschließlich im gemeinsamen Capabilitykatalog
gepflegt. „Automatisch“ benennt nur die konkreten Assertions; natives Aussehen,
Paketstand, Zielgerät und Ownerabnahme bleiben andere Aussagen.

| Relevante Fehlerwirkung | Heutiger Schutz / ausdrückliche Grenze |
| --- | --- |
| Verlorene oder doppelte Folgezüge; falsche Historie nach Unknown | Automatisch: `terrain-stroke-queue.test.mjs` und `atlas-terrain-edits.test.mjs` halten Reihenfolge, Kennung und bestätigten Präfix; `terrain-live-history.test.mjs` prüft echte SQLitewrites, Undo/Redo, Replay, Reiseguard und Neustart. |
| Veralteter Quellenread bestätigt fremden Stand oder schickt gehaltene Arbeit nach Wiederöffnung los | Zwei neue automatische Fälle in `atlas-terrain-edits.test.mjs`: verzögerter Erfolg **und** Fehler nach Hide/Open lassen Bestätigungen, Meldungen, Projektion, Dispatch und gehaltenen Folgezug unverändert. Erst ein frischer Read setzt einmal fort. Zwei gezielte Guardentfernungen machen jeweils den passenden Fall rot; Originalquellen danach bytegleich restauriert. |
| Passende Kennung verschleiert falsche Kampagne, fehlenden Fence oder ungültige Revision | Automatisch: echte Worker-/IPC-/Preload-/Authorgrenze in `desktop-atlas-commit-recovery.test.mjs`; keine Savedwirkung, kein zweiter Dispatch, SQLitebytes unverändert. Nicht allein ein Queue-Dummy. |
| Alter Scope-/Objekt-/Regionsread erhält nach A–B–A oder Hide/Open wieder Auswahlhoheit | Automatisch: `atlas-ownership-boundaries.test.mjs` und `atlas-controller-lifecycle.test.mjs` behalten aktuelle Auswahl, Geschoss, Scope und Quellgeneration. Eine verweigerte Entwurfsgrenze liest den neuen Zielkontext nicht. |
| Kampagnenwechsel verwirft noch angenommene Writes oder spätere Eingabe im Drain | Automatisch: `editor-session.test.mjs` prüft registrierte echte Abschlussverpflichtung und erneuten Drain; `desktop-editor-activation.test.mjs` verweigert Wechsel ohne Detach und behält fehlgeschlagenes Laden schreibgeschützt. `desktop-preparation-owner.test.mjs` prüft den konkreten SQLite-Entwurfsbesitzer einschließlich verspäteter Receiptantwort. Diese Belege ersetzen keine beliebige besondere UI-Unterfläche. |
| Neue Terrainhöhe/Meer, Cacheinvalidierung, Archiv oder Reopen verliert Details | Automatisch: `terrain-height.test.mjs`, `terrain-live-history.test.mjs`, `atlas-material-tiles.test.mjs` sowie Reise-/Referenzweltprüfungen führen Persistenz, Archive, unabhängige Kopie und Neustart wirklich aus. Materialtopologie und Wassertiefe können nicht nur wegen gleicher gerasterter Abdeckung veraltet wiederverwendet werden. |
| Grund-/Spezialpinsel verbinden Züge numerisch falsch oder überschreiben feine Daten | Automatisch: `terrain-brush-draft.test.mjs` und `terrain-form-brush.test.mjs` prüfen gemeinsame Knoten, negative Kachelgrenzen, überlappende Züge und erhaltene feine Höhendaten. Sichtbare Strichnähte, überzeugende Rücken/Hänge und Canyonformen bleiben visuelle Produktprüfungen (TW-G3/4). |
| Fluss ignoriert Pflichtpunkte/Bettbudget, überbrückt trocken einen schmalen Rücken oder schreibt nur eine Teilwirkung | Automatisch: `terrain-route.test.mjs` prüft Zwischenproben, Mund-/Bettbudget, lösbare/unlösbare Senke, atomare Ablehnung, gekoppelte History und frischen unabhängigen Read. Der vollständige native Planerablauf ist ein vorhandener, hier nicht neu ausgeführter Prüfweg. |
| Pointerabbruch, Fokusverlust, Escape oder Textfokus löst den falschen nativen Eingabeeffekt aus | Queue-/Gestenlogik und Kamerageometrie besitzen automatische Teilbelege. Der vollständige reale Ereignispfad samt laufendem Zug, Textfeld, Nachladen und Wiederöffnung ist in dieser Fortsetzung **nicht nativ ausgeführt**. Vorhandene native Terrain-/Kameraskripte und 100-%-Vorgabe bleiben Prüfwege; die produktseitige Abdeckung ist offen. |
| Einheitenwechsel rundet unberührte Flusspunktkoordinaten oder schreibt eine ungewollte Vorschau | Die nachfolgende Fortsetzung ergänzt `terrain-route-units.test.mjs` am öffentlichen UI-Einstieg und schließt diese eng benannte automatische Lücke: exakte kanonische Werte, unabhängige Achsen, passive Einheitenwechsel, Abbruch und einmalige Übernahme. Die historische Datei bleibt Anforderungsbeleg. Native Gesamtbedienung und die übrigen Detailwirkungen bleiben getrennt. |
| Besondere Notizmappen-/Packet-/geborgte Quellenkontexte übernehmen alte Parent-/Entwurfsantworten | Gemeinsamer Sessionkern und die oben benannten Besitzer schützen ihre geprüften Grenzen. Die historischen besonderen Flächen, etwa „nested map navigation protects composing input“, „a late parent reread“ und „a delayed packet-source opening“, haben weiterhin **fehlende spezifische automatische Abdeckung**. Die Terrainfokussierung macht diese Daten-/Entwurfsregeln nicht überholt. Sie werden nicht als durch einen ähnlichen Atlasfall ersetzt gezählt. |
| Küstenlöcher/LOD-Flimmern, subjektive Formqualität, komplette Zielgerätebedienung und p95-Reaktion | Ausschließlich zusätzliche native/visuelle bzw. statistische Produktqualifikation am Paketstand. Kein Unit-, Cache-, Gruppentiming- oder eingefrorener Bildoracle schließt TW-G4/5/6. Das Laufzeitziel der Testsuite ist eine andere Messgröße. |

Damit sind die wichtigen benannten Fehlerwirkungen dieses Lieferfokus entweder
konkret automatisch belegt oder ausdrücklich als spezifische Automationslücke,
fehlender neuer nativer Lauf oder visuelle/statistische Produktprüfung eingeordnet.
Das ist kein vollständiger Wiederaufbau der 1315 Altassertions und keine
Terrain-/Wasserabnahme. Insbesondere bleiben die genannten konkreten UI-Lücken
sichtbar; die zwei ergänzten Fälle schließen ausschließlich die entwerteten
Terrain-Quellenantworten.

## Neuer vollständiger Normalweg und offener Abschluss

Die Fortsetzung endet mit einem neuen tatsächlichen `npm test`: **313 Dateien,
2619 Fälle, 2618 bestanden, null Fehler, ein optionaler SRD-PDF-Skip**. Der
äußere Lauf dauert **715,855 s**. Die Auswahl ist mit dem übernommenen
722,901-s-Lauf identisch; die zwei neuen Quellenfälle erklären den Fallzuwachs.
Alle ausführbaren Quellen sind während dieses Vollaufs bytegleich geblieben.
Gegenüber dem übernommenen Vollauf unterscheiden sich vier Testdateien: die zwei
schon dokumentierten Plattformkorrekturen und die zwei Dateien dieser
Fortsetzung. Produktions- und Desktopquellen sind identisch.

| Größe | Übernommener Vollauf | Neuer Vollauf |
| --- | ---: | ---: |
| Äußerer Gesamtlauf | 722,901 s | 715,855 s |
| Parallelität / tatsächliche Grenzen | 1 Prozess / 2–3 GiB | 1 Prozess / 2–3 GiB |
| Runner-Katalogvorbereitung | 28,295 ms | 31,817 ms |
| Tests einschließlich eigener Vorbereitung | 722,555 s | 714,927 s |
| Root-Assets / Builds / Treffer | 6,091 s / 0 / 91 | 6,136 s / 0 / 91 |
| User-/System-CPU | 762,66 / 58,68 s | 753,94 / 59,15 s |
| Größter Prozess-RSS | 1.344.816 KiB | 1.113.012 KiB |
| Gemeinsamer Cgroup-Peak | 1.414.582.272 Bytes | 1.418.145.792 Bytes |

Beide Rootcaches sind warm; Betriebssystem-Dateicaches wurden nicht geleert. Die
sieben weiteren Cache-Misses gehören wieder zu isolierten Cachegegenfällen.
Eigene schwere Prüfungen liefen nacheinander. Die Fünf-Sekunden-Fremdlastprobe
während des neuen Vollaufs zeigt weiter rund 91 % eines CPU-Kerns beim
Benutzermanager, 22,8 % bei uresourced und 6,6 % beim Appschutz. Diese Dienste
wurden nicht verändert. Vollständige Quellenbindung, Cacheereignisse, Druckwerte,
Ressourcen und Prozessstichproben stehen in `.build/round8-rest/final-full/`.

Der Gesamtunterschied ist **−7,046 s / −0,97 %**. Er passt zum begrenzten
Compilergewinn, ist aber kein isolierter allgemeiner Suite-Speedup und kein
hinreichender Abschluss. **Das Ziel unter 300 s bleibt offen.** Verbleibende
Treiber sind die fünf vollständigen Compilerumgebungen, echte Terrain-/Material-
Rasterarbeit und Geometrie, kanonische Reise-/Kopier-/Neustartprüfungen sowie das
vollständige Lesen/Prüfen der Referenzwelt. Der Vier-Thread-/Zwei-Kern-Host trägt
zusätzlich die gemessene Fremdlast. Eine grobe Erhöhung der Prozesszahl würde
angesichts der ausgerichteten Speicherspitzen keinen zuverlässigen Normalweg
belegen. Die engen Parallelversuche werden daher nicht als Gesamtgewinn oder
neuer Standard verkauft.

Der getrennte Vendor-Selektor besteht auch ohne vorherigen Renderer-Test:
ein ausgewählter Fall, null Fehler; er erzeugt seine Rendererdiagnostik selbst.
Repositoryprüfung, Formatprüfung beider geänderter Testdateien, deren
Syntaxprüfung und `git diff --check` bestehen. Die fünf vollen produktiven
Compilerprüfungen sind Teil des neuen Gesamtaufs. Es werden keine zusätzlichen
Produktbuild-, Paket-, Installations-, nativen UI-, Candidate- oder Ownerabnahmen
behauptet. Native Prüfwege bleiben ausschließlich bei 100 Prozent Appzoom.

Die beiden Mutationstests sind gezielt rot, danach sind die Originalquellen
bytegleich restauriert. Der ausführbare Stand nach allen Abschlusschecks stimmt
mit dem Vollauf überein. Alle eigenen Probe-PIDs sind beendet und alle eigenen
Cgroups entfernt. Die niedrige Abbruchschwelle erforderte tatsächlich das
Aufräumen eigener Nachkommen (`reapedDescendants: true`); die ausgerichtete Probe
und die erfolgreichen Läufe endeten ohne übrige Nachkommen. Dieselben fünf schon
vorher wartenden fremden Stopjobs sind weiterhin unverändert vorhanden.

Im gemeinsamen Capabilitykatalog wurden die tatsächlichen Dateien nachgeführt
und die Prüfungen mit `--geprueft` vermerkt. Drei bereits fehlende Dateilinks der
geprüften Abläufe wurden ausdrücklich mit `--entferne-tests` entfernt; keine
Testdatei wurde dadurch gelöscht. Die historische Zahl bleibt 416 exakt
zugeordnet / 1315 offen. Neue Quellschutzfälle und die explizite
Wirkungsklassifikation sind begrenzte Fortschritte. Punkt 4 ist hinsichtlich des
Laufzeitziels und der benannten spezifischen UI-Lücken weiterhin offen; eine
vollständige Terrain-/Wasserabnahme folgt daraus nicht.

## Nächster Beitrag: öffentliche Flussplanerabdeckung und restliche Kosten

`tests/atlas/terrain-route-units.test.mjs` ergänzt drei kleine Fälle über den
öffentlichen `openTerrainRoute()`-Einstieg. Der Planer erzeugt sein tatsächliches
Markup; die gemeinsamen Einheitenfunktionen laufen unverändert. Kontrolliert
sind Browserplattform, Host und Preloadantworten. Die Fälle öffnen einen
bestätigten Fluss mit absichtlich mehr als zwölf signifikanten Stellen und
prüfen Metrisch → DnD → Metrisch ohne neue Vorschau, Write oder Entwurfsmutation.
Eine spätere ausdrücklich angeforderte Vorschau erhält dieselben exakten Anker,
Breiten und Planungsgrenzen. Y-Eingabe erhält X, X-Eingabe erhält Y. Abbruch stellt
die bestätigten Anker wieder her, lässt den bestätigten Verlauf unverändert und
sendet keinen Historienauftrag. Bewusste DnD-Eingaben werden zu −152,4 m,
12,192 m Breite und 9,144 m Abtrag; die anschließende Übernahme trägt genau einen
Auftrag mit Quell- und Objektrevision. Der doppelte Klick während des Saves
verursacht keinen zweiten Write. Weitere passive Wechsel bleiben schreibfrei.

Der entfernte historische UI-Test wurde als Anforderungsbeleg gelesen; sein
privater Zustand und seine technische Konstruktion wurden nicht übernommen.
Es wurde kein Fehler am produktiven Einheitenanschluss nachgewiesen und keine
Produktionsquelle geändert. Die gezielte Gegenprobe berechnet kanonische Werte
ausschließlich beim Einheitenwechsel absichtlich aus den gerundeten
Anzeigefeldern neu; normale Reads bleiben unverändert: Alle drei neuen Fälle
werden rot. Die Units-Quelle ist danach bytegleich wiederhergestellt. Kontrollierte
Vorschauantworten beweisen die UI-Übergabewerte; reale Solver-/SQLitewirkung bleibt
bei `terrain-route.test.mjs` und den nativen Proben. Diese Unterscheidung ist keine
Aussage über Vollabdeckung.

Die historische automatische Lücke „Einheitenwechsel rundet unberührte
Flusspunktkoordinaten oder schreibt eine ungewollte Vorschau“ ist damit eng
belegt. Verschachtelte Notizmappen, weitere Quellen-/Zeit-/Archivkontexte,
vollständiger Flussabschluss, TW-G1–6 am selben Paketstand, Bildqualität/LOD,
Textfokus, Zielgerät-p95 und Ownerabnahme bleiben offen. Die Zahl der 416 exakt
zugeordneten historischen Assertions wird nicht ohne Einzelnachweis erhöht.
Der gemeinsame Capabilitykatalog besitzt die tatsächlichen neuen Dateilinks und
die Prüfung mit `--geprueft`; er bleibt der einzige aktuelle Ablaufkatalog.

Die Kostenauswertung verwendet den vorhandenen vollständigen 715,855-s-Lauf,
keinen neuen Gesamtbenchmark. [Restkosten und vollständige Dateigruppen](remaining-costs.json)
binden dessen Quelldigest. Alle 2618 obersten TAP-Ergebnisse ergeben zusammen
587,214 s. Verschachtelte Dauern sind darin bereits enthalten und werden nicht
noch einmal addiert. Der TAP-Text enthält keine Dateinamen; seine Fallnamen
werden nicht nachträglich zu scheinbar exakten Dateizeitwerten umgedeutet.

Die Prozessstichprobe enthält 224 tatsächliche Einzeldateikinder. Der Runner mit
313 Dateiargumenten wird ausdrücklich ausgeschlossen. Die Summe der beobachteten
Intervalle beträgt mindestens 480,018 s; kurze oder an den Rändern verpasste
Prozesse erklären einen Teil des Restes. Bis zum äußeren Lauf bleiben höchstens
235,837 s ohne direkte Dateizeitzuordnung. Die nachfolgende Gruppierung ist
überschneidungsfrei: zuerst die fünf bereits untersuchten Dateien, dann anhand
des Testinhalts direkte `CampaignStore`-/`new Store`-/`new HostIpc`-Anschlüsse,
danach die übrigen Dateien nach Bereich. Das ist eine Kostenklassifikation,
keine zusätzliche Coveragezuordnung. Fehlende Stichproben bedeuten unbekannte
Dauer und ausdrücklich keine kostenlose Datei.

| Gruppe | Dateien / beobachtet | Summe beobachteter Dateiintervalle, Untergrenze |
| --- | ---: | ---: |
| Direkte Store-/Hostintegration | 148 / 135 | 288,637 s |
| Bereits untersuchte fünf Dateien | 5 / 5 | 123,387 s |
| Weiterer Atlas | 90 / 49 | 35,568 s |
| Weitere gemeinsame Werkzeuge/Prozessproben | 27 / 14 | 18,220 s |
| Weitere Workspace-/Architekturprüfungen | 12 / 8 | 13,192 s |
| Weitere Runtime | 12 / 6 | 1,014 s |
| Weitere Kampagne | 10 / 4 | unbekannt; Intervalle nur in einer Stichprobe |
| Weiterer Katalog | 9 / 3 | unbekannt; Intervalle nur in einer Stichprobe |

Die Store-/Hostgruppe ist selbst unter dieser groben Beobachtung die größte
bislang ungeklärte Gruppe: Auch 35,568 s für den nächsten Restblock plus der
gesamte nicht zugeordnete Rest von 235,837 s bleiben unter ihrer gemessenen
Untergrenze. Die Summe vieler mittlerer Dateien ist hier entscheidend. Genau
diese Gruppe wird deshalb als nächster Diagnoseblock untersucht. Die bekannten
fünf Dateien werden nicht noch einmal als Erklärung der übrigen Suite verkauft.

Die erneuten nativen Proben verwenden ausschließlich Appzoom 1. Im bestehenden
Prüfwerkzeug wurde eine nachweislich veraltete 200-Prozent-Annahme korrigiert:
`setSize(1440)` plus Zoom 1 konnte die anschließende Bedingung `innerWidth <= 720`
nicht erfüllen. Der Test setzt nun echte 720 Pixel Inhaltsbreite und stellt
anschließend 1440 Pixel wieder her. Keine Anwendungslogik wurde dafür geändert.
Danach bestanden die nativen Einheitenwechsel, schreibfreie Vorschau,
720-Pixel-Seitenleiste, Übernahme und Undo/Redo der Straße. Der anschließende
Flussstart in derselben Folge blieb am noch sichtbaren Straßeneditor hängen;
das vollständige Straßen-/Flussskript ist **nicht bestanden**.

Die getrennte frische `--river-only`-Probe bestätigte drei echte Mausanker,
Pflichtpunkte, schreibfreie Vorschau, fallende Profilkanten, Meerpegel,
verbundenes Bett innerhalb des Abtragsbudgets, einen atomaren Historyeintrag,
unveränderte Terrainbytes, Undo/Redo einschließlich abgeleiteter Bett-/Wasserhöhen
und dieselben Daten nach einem frischen Prozess. Sie endete regulär als
fehlgeschlagene Qualifikation beim fixen Kameravergleich nach dem Neustart:
Frame, Neigung und Rotation stimmen überein, `focusM` beträgt jedoch
27,999999523 statt 18,4375 m. Die Bildparität nach Neustart bleibt deshalb offen.
Die fachlichen Datenassertions ersetzen diesen fehlgeschlagenen Darstellungsbeleg
nicht. Der Diagnoseversuch brauchte keinen Fristabbruch; Prozesse und eigene
Cgroup waren vor dem nächsten schweren Lauf entfernt. Belege und Bilder liegen
unter `.build/round8-river/native*`; beide Fehlbefunde bleiben erhalten.

Die vollständige Diagnose dieser einen Store-/Hostgruppe besteht mit **148
Dateien und 1460 Fällen**, null Fehlern und unveränderten Quellen während des
Laufs. Alle ausgewählten Testdateien sind bytegleich zum 715,855-s-Ausgangslauf.
Der äußere Diagnoseaufruf dauert 626,690 s, der Runner 623,803 s. Das ist wegen
zusätzlicher Runtime-Hooks, AST-Lader und ihrer Initialisierung auch in
Hilfsthreads **kein Vergleichsbenchmark** und kein Suite-Speedup. Ein erster
Diagnosestart wurde wegen einer fehlerhaften Textumschreibung des Messhelfers
abgebrochen; seine Fehlbelege bleiben separat erhalten. Der erfolgreiche Lauf
verwendet für alle 148 Dateien vorab syntaxgeprüfte AST-Call-Umschreibungen.
Originaldateien wurden für diese Instrumentierung nicht umgeschrieben.

| Exklusive synchron gemessene Phase im Dateiprozess | Diagnosezeit |
| --- | ---: |
| Store-Fachaufrufe | 142,941 s |
| Buildaufrufe einschließlich vorhandener Cachetreffer | 80,207 s |
| DBöffnen, Bootstrap und Schema ohne die separat gemessenen Katalogteile | 33,692 s |
| Kataloginstallation und Validierung aktueller Definitionen | 27,194 s |
| Bundleladen ohne separat gemessene statische Katalogprojektion | 18,788 s |
| Statische Gegenstandskatalogprojektion | 3,747 s |
| Assertions einschließlich tatsächlicher Bytelesearbeit | 2,603 s |
| Synchroner Worker-Konstruktor | 0,120 s |
| Nicht einzeln instrumentierter Rest innerhalb der Dateiprozesse | 235,973 s |

Die gemessenen synchronen Selbstzeiten ergeben 309,291 s; mit dem Rest sind es
545,264 s innerhalb der erfassten Dateilebenszeiten. Die weiteren 81,425 s bis zum
äußeren Diagnoseende enthalten unter anderem Prozess-/Messladerinitialisierung
und Runnerarbeit; sie werden nicht als Fach- oder Datenbankarbeit etikettiert.
Der Rest innerhalb der Dateien enthält auch direkte Raster-/Geometriearbeit,
asynchrone Aufträge und Wartezeiten auf reale Worker. 34 Threads liefern eigene
Exitprofile; das ist keine vollständige Qualifikation aller gestarteten Threads.
Auch workerinterne Traces bleiben separat. Die überlappenden
`online`-/Erstantwort-Beobachtungen werden weder zu den
Dateizeitwerten addiert noch als isolierte Threadstartkosten ausgegeben.
Unterschiedliche Prozessuhren werden nicht voneinander subtrahiert.

Ein konkreter großer Block ist tatsächlich erforderliche Kopier-/Importarbeit:
149 `acceptCampaignSnapshot`-Aufrufe benötigen 49,369 s exklusive Selbstzeit.
`desktop-campaign-shared-definitions.test.mjs` prüft zum Beispiel wiederholte
unabhängige Importe, ausdrücklich verschiedene Keep-Entscheidungen und nach
Reopen unveränderte alte Kampagnen und kopierte Referenzen; `desktop-dungeon-travel-copy.test.mjs`
prüft fünf eigenständige Reise-/Kampfzustände nach Kopie und erneutem Öffnen.
Das sind die geprüften Nutzerwirkungen, keine durch ein gemeinsam veränderliches
Storeobjekt ersetzbare Vorbereitung. 1114 `applyAtlas`-Aufrufe benötigen weitere
26,767 s Selbstzeit, 24 echte `atlasSpatialScene`-Aufrufe 9,263 s. Die zugehörigen
Anker-, Terrain-, Quellwechsel-, Rollback- und Historyassertions bleiben erhalten.

Die zusätzliche Optimierungsentscheidung bleibt deshalb begrenzt: Es wurde
**kein weiterer nennenswerter vermeidbarer Aufbau mit belastbarem Gesamtbeitrag**
nachgewiesen. Statische Katalogprojektion erklärt selbst in der instrumentierten
Gesamtgruppe nur 3,747 s; daraus lässt sich kein großer Suitegewinn gewinnen.
DB-/Kataloginitialisierung wird zwar oft wiederholt, umfasst aber auch bewusst
frische Datenbanken, Validierung beschädigter Bestände und echte Wiederöffnung.
Die bereits vorhandene `fixtureStore`-Wiederverwendung kopiert geschlossene
Schemafixtures in unabhängige SQLite-Dateien. Sie wird nicht auf fachlich
abweichende Init-/Reopenfälle ausgedehnt. Die 80,207 s Buildphase enthält sowohl
89 vorhandene Shared-Assettreffer (zusammen 6,351 s) als auch unterschiedliche
Bundles und den Instrumentierungsaufschlag ihrer Hilfsthreads. Sie beweist keine
80 Sekunden vermeidbare Kompilierung. Weder Assertions noch unabhängige
veränderliche Fixtures wurden reduziert oder zusammengelegt.

Damit gibt es keine weitere Optimierungsänderung und keinen neuen vollständigen
Suite-Lauf auf Verdacht. Standardsuite, Parallelität, Speichergrenzen und
Candidate bleiben unverändert. **Unter 300 s bleibt offen.** Die größte zuvor
ungeklärte Dateigruppe ist jetzt vollständig als Gruppe diagnostiziert; ihre
Restzeiten und die anderen Gruppen werden nicht als abschließend erklärt
behauptet. Punkt 4 bleibt ein offener Gesamtauftrag.

Die abschließende Auswahl aus Flussplaner-UI, Terrainrouten, metrischer Kamera und
bestehenden Pinsel-/Einheitencontrols besteht mit **39 Fällen**. Die spezifische
Unitswitch-Gegenprobe macht alle drei neuen Fälle rot und restauriert die
Produktionsquelle bytegleich. `npm run check` einschließlich aller fünf
Produktionsumgebungen, `check:desktop`, `build`, `build:desktop`, `check:repo`,
Format-/Syntaxprüfung der beiden geänderten JS-Dateien und `git diff --check`
bestehen. Alle produktiven `src/`-/`desktop/`-Dateien stimmen mit dem benutzten
715,855-s-Vollbenchmark überein; neu sind die UI-Testdatei, der korrigierte native
Prüfweg und dieser begrenzte Kosten-/Abdeckungsbericht. Die vorbestehenden
Beiträge bleiben erhalten. Paketbau, Installation, Candidate-CI, Integration
und Ownerabnahme werden nicht behauptet. Sämtliche Details einschließlich
Quellbindung und der fehlgeschlagenen nativen Proben stehen im neuen Abschnitt
`riverPlannerAndRemainingCosts` von [measurements.json](measurements.json).

## Abschluss der beiden nativen Straßen-/Flussbefunde

Der nächste Beitrag behebt und prüft beide vorstehend offenen nativen Befunde.
Die alten Fehlbelege bleiben erhalten. Alle neuen Läufe verwenden denselben
Dirty-Quellstand und dieselben Desktopartefakte; die Produktions-, Desktop-,
Test-, Tool- und Konfigurationshashes sind vor/nach beiden vollständigen nativen
Läufen identisch. Die Bindung, Befunde und Prüfpfade stehen unter
`nativeRoadRiverCompletion` in [measurements.json](measurements.json), die
Detailbelege unter `.build/round8-native-completion/`.

Die Straßenprobe wartete nach Redo nur 100 ms und auf eine fertige Kartenfläche.
Der Planer konnte dabei noch Schreiben, Aktualisierung oder Quellrücklesung
bearbeiten. „Entwurf verwerfen“ durfte diesen laufenden Auftrag bisher entwerten;
„Planung schließen“ wurde während `saving` verweigert. Der alte Straßeneditor
blieb stehen und verdeckte den neuen Planungseinstieg. Die isolierten
Übergangsprotokolle unterscheiden jetzt Verwerfen, tatsächliches Entfernen des
Editors, gewähltes Flusswerkzeug und den neuen Planer. Ein automatischer
Gegenfall hält jede der drei Auftragsphasen einzeln an. Der Besitzer setzt
`aria-busy` und `inert` bis zum vollständigen Abschluss; Verwerfen greift während
speichernder Aufträge nicht ein. Die Probe wartet auf den tatsächlichen
Historycursor und den freigegebenen Planer. Sie verlangt einen neuen leeren
Flussplaner, echte Klicks nur auf dessen Anker, schreibfreie Vorschau,
unveränderte Straße und genau einen Historyschritt je ausdrücklicher Übernahme.
Es gibt keinen internen Zustandsreset durch den Test.

Der erneute alte Flusslauf reproduziert die ursprüngliche Abweichung exakt:
`fresh-top` besitzt denselben Frame, aber 27,999999523162842 statt 18,4375 m Fokus.
Die Diagnose findet zwei getrennte Ursachen. Die Probe setzte bei jedem Start
wieder ihren anfänglichen `localStorage`-Ausschnitt und entfernte damit schon vor
`activate` die gespeicherte Pose; die View-Fixture wird jetzt nur einmal gesetzt.
Unabhängig davon überschrieb die erste Terrainlieferung eine gültig
wiederhergestellte Pose bei noch nicht fertiger Darstellung. Diese vollständige
Pose besitzt ihren Fokus jetzt bereits vor der ersten Übersicht und behält ihn
bei späteren Detailstufen. Ohne gespeicherte Pose wird der anfängliche Fokus
weiter aus dem Terrain bestimmt. Navigation darf weiter bewusst refokussieren;
die Sicherheitskorrektur gegen ein Durchtauchen bleibt erhalten.

Die read-only-Debuggertimeline erfasst `remember`, `restoreCameraPose`,
Navigationsabschluss, Poseänderungen, erste Terrainlieferung und folgende LODs.
Zusätzliche Checkpoints trennen Vorschau, gespeicherte Darstellung, Undo/Redo,
Stand vor normalem Schließen und erste wiederhergestellte Darstellung samt
`localStorage`. Vor dem Schließen stimmen lebende und gespeicherte Pose überein;
Fokus 13,499999999999478 m und 45° Neigung bleiben bei Wiederherstellung,
erster Übersicht und deren Verfeinerung erhalten. Der logische Ausschnitt passt
seine Höhe beim Öffnen gemäß dem bestehenden `resizeViewport`-Vertrag an die
CSS-Fläche an; Weltzentrum, Breite/Skala, Winkel und Fokus bleiben erhalten.
Nach denselben sichtbaren Kameraaktionen betragen die Draufsichtfokusse
28,00000000000013 / 28,00000000000013 / 28,000000000000135 m für Save/Redo/Fresh;
die geneigten Ansichten besitzen jeweils 13,499999999999478 m. Kamera- und
Bildtoleranzen bleiben unverändert. Alle vier Redo-/Fresh-Vergleiche haben
**null abweichende Pixel** bei jeweils 1.521.024 Kartenpixeln. Die historische
18,4375-m-Aufnahme wird damit nicht umgeschrieben oder als Sollwert verworfen.

Der vollständige Straßen→Fluss-Lauf besteht einschließlich Einheitenwechsel,
720-Pixel-Seitenleiste bei 100 Prozent, Schutzwechsel, Löschen/Undo, tatsächlichem
Schutzpinsel samt Undo und frischem Prozess. Ein zusätzlicher alter Pinselschritt
hatte unmittelbar vor bereiter Bearbeitungsquelle geklickt; sein Fehlbeleg bleibt
als `road-brush-before` erhalten. Die Probe passt den Verlauf jetzt über den
sichtbaren Editor ein, wartet nach Hover auf die öffentliche vollständige
Bearbeitungsquelle mit aktueller Revision/35-m-Radius und prüft den bestätigten
Historyschritt. Der getrennte `--river-only`-Lauf besteht mit drei echten Ankern,
2353 Zwischenproben im Abstand 0,25 m, schreibfreier Vorschau, unveränderten
Terrainbytes, einer atomaren Übernahme, Undo/Redo, frischem Read und den genannten
Kamera-/Bildvergleichen. Alle vier qualifizierten Starts laufen mit Zoom 1,
enden regulär mit Exit 0 und verschwundenen PIDs, ohne Rendererfehler oder
gezwungene Bereinigung.

Die gezielte Auswahl besteht mit **55 Fällen**, darunter drei neue Gegenfälle.
Zwei gezielte Mutationen entfernen jeweils den Schutz der restaurierten Pose
oder die Eingabesperre des Historybesitzers; beide zugehörigen Assertions
scheitern. Alle Quellen wurden danach bytegenau restauriert. Repositoryprüfung,
vollständige Typ-/Umgebungsprüfung, Desktop-Typprüfung und beide Builds bestehen.
Die tatsächlichen Testdateilinks und der Prüfzeitpunkt sind im gemeinsamen
Capability-Katalog nachgeführt. Diese begrenzte native Qualifikation ersetzt
weder alle übrigen UI-/LOD-Lücken noch TW-G1–6-, Paket-, Zielgeräte- oder
Ownerabnahme; Verpackung, Installation und Integration wurden nicht ausgeführt.

**Laufzeit bleibt separat offen:** 715,855 s ist weiterhin der letzte
Vollbenchmark. Für diesen Fehlerbeitrag wurde keine neue Vollsuite als
Geschwindigkeitsmessung gestartet. Die instrumentierte 80-s-Buildphase bleibt
kein belegter Optimierungskandidat. Notwendige Import-, Neustart- und
Integritätsprüfungen sowie Suite, Speichergrenzen und Parallelität bleiben
erhalten; das 300-s-Ziel und die übrigen UI-Lücken sind unverändert offen.
