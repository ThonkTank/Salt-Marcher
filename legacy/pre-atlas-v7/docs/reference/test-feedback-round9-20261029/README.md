# Tägliche Testauswahl und konkrete UI-Schutzgrenzen — Runde 9, Plan 4

Status: Lokale Qualifikation; Candidate, E2E-Gesamtabschluss und Ownerabnahme separat.
Owner: project
Last Reviewed: 2026-10-29
Source of Truth: [Messwerte](measurements.json), normale Runnerberichte und die benannten Assertions. Workflow-Dateilinks besitzt ausschließlich der gemeinsame Capability-Katalog.

Die normale erste Rückmeldung liefern die [kleinen Arbeitsauswahlen](../../project/verification/test-selections.md).
Der vollständige Candidate bleibt unverändert. Der bestehende Launcher, die
2/3-GiB-Grenze, ein lokaler Testprozess, der inhaltsgebundene Assetcache und die
Plan-3-Besitzer werden übernommen. Die frühere Zwölf-Minuten-Messung ist ein
historischer Vergleich, kein Beschleunigungsbeleg für den heute geänderten Bestand.

Die engeren Schutzfälle gehören zu SMR-AC-02 (Kampagnen-/Besitzerlebenszyklus)
und SMR-AC-03 (Definitionen, Verweise und Worldinhalte). Beide Gesamtfälle
bleiben im Abnahmeregister offen. Die TN-15–19-Ziele für Dauerhaftigkeit und
Wiederaufnahme sowie TN-20–23 für Rückmeldung/Last werden durch diese
lokalen Tests nicht vollständig qualifiziert; Quellenbindungen bleiben erhalten.

## Übernommene Belege und Kosten

Die Runde-8-Berichte trennen Compilerprüfung, unveränderte Fachberechnung,
Fixture-/Datenbankinitialisierung und tatsächliche Assertions. Bereits geliefert
sind die Wiederverwendung identischer Store-/Regionsworker-Builds, isolierte
SQLite-Schemafixtures und prozesslokale Digestwiederverwendung für unveränderte
Quellen. DB-Verbindungen, Worker und Editorzustände bleiben getrennt.

Plan 3 qualifiziert die produktiven Preparation-/Combat-/Live-Besitzer. Die
abschließenden 71 Fälle einschließlich angewandter und nicht angewandter
Live-Verschiebeaufträge sowie die nativen 100-Prozent-Teilproben werden
übernommen. Sie werden durch Plan 4 weder als Vollabnahme umgedeutet noch ohne
neuen Anlass erneut analysiert. Der historische Wissenssplit-Prüfweg bleibt
wegen seines alten Dungeon-Einstiegs offen. Die E2E-02-Teilproben führen
weiterhin `complete=false`.

Plan 4 entfernt keine Datei, Fachfixture oder Assertion und erhöht die
Parallelität nicht. Zusätzliche Schutzfälle und vermiedene Arbeit werden
getrennt bilanziert; eine kürzere gemischte Gesamtdauer allein isoliert keinen
Speedup. Der aktuelle Vergleich und seine Quellenbindung stehen in
`measurements.json`.

## Drei konkrete Risiken

Die direkten Fälle verwenden die echte `createPreparation`-Komposition,
`NoteThreadDialog`, den registrierten Packet-Originalzugang, den ausgeliehenen
DOM-Editor und einen eigenen SQLite-Store pro Fall. Verzögert wird die
ursprüngliche produktive Anfrage, anschließend wird Eingabe oder Kontext
geändert und erst dann die alte Antwort zugestellt. Sichtbare Rohtexte und
kanonische Daten besitzen voneinander unabhängige Assertions.

Ergebnisse, Gegenproben und Laufbelege sind im Messregister gebunden.
Allgemeine Atlasfälle und bloße Dateizuordnungen
ersetzen diese drei Nachweise nicht.

| Risiko | Direkte Assertions und gezielte Gegenprobe |
| --- | --- |
| Verschachtelte Mappe während weiterer Eingabe | Die Originalbestätigung des Kindwrites wird gehalten. Währenddessen wird weiterer CRLF-/Verweisrohtext eingegeben. Erst nach dem Drain öffnet die Kindmappe; kanonisch steht genau der spätere Text mit Revisionsfolge 1 → 2, Blatt und Ausgangsnotiz bleiben unverändert. Ohne erneuten Flush nach dem ersten Ack scheitert die neue kanonische Textassertion. |
| Verspäteter Parent-Reread | A → Kindmappe → Blatt verwendet die echten Quellkarten. Während der durch „Zur Mappe“ begonnenen Elternleseantwort kommt weitere Blatteingabe hinzu. Der Elternread darf weder Titel, Rohtext noch sichtbaren Originaleditor ersetzen; SQLitebytes bleiben unverändert. Der ursprüngliche Code scheitert direkt (`A` statt `Blatt`). `openPreparedNote` bindet jetzt den Read nach dem Flush zusätzlich an Auswahl, Editorgeneration und Eingabeversion. Entfernen genau dieser Bindung lässt denselben neuen Fall wieder scheitern. |
| Packet-Original nach Kontextwechsel | Die produktive Vorbereitungsmappe und ihr registrierter Originalzugang starten den alten Read. Danach wird Kampagne B aktiviert und ein neuer Rohentwurf eingegeben. Zustellung der alten A-Antwort verändert weder Titel/Rohtext noch Meldungen, gibt den alten Packeteditor nicht frei und verändert keine SQLitebytes oder kanonische Notiz. Entfernen des Read-Kontextschutzes lässt die neue Titelassertion scheitern. |

Die drei Fälle ergänzen `tests/campaign/desktop-preparation-owner.test.mjs`;
alle bisherigen elf Fälle bleiben bestehen. Die Dialogfixture erhält den
vorhandenen leeren Entwurfsspeicher auch über `window.localStorage`, damit der
produktive Pending-Check die Quellkarten tatsächlich freigibt. Testende
retiriert ausgeliehene Controls und Packetkontext vor dem Entfernen des Stores.
Es werden keine Controls künstlich entsperrt und keine Besitzer nachgebildet.

Jede Gegenprobe führt genau den betreffenden neuen Fall aus und verlangt
dessen Fehler. Die Originaldateien werden im `finally` bytegenau restauriert;
Vorher-/Mutanten-/Wiederherstellungs-SHA-256 und Exit 1 stehen in
`.build/round9-plan4-counterprobes/results.json`. Die Gegenproben sind lokale
Sensitivitätsnachweise, kein zusätzlicher Produktionsmodus.

## Kleine Auswahl, zusätzlicher Schutz und Kosten

Node 22.19.0, npm, ein Testprozess, tatsächliche 2/3-GiB-Cgroups und derselbe
Dirty-Checkout auf `7a3ea5cd07c3fa09e8cbed4dbfdb3f19ecb6c22e`. Der Wrapper bindet
Dateien und Quellen vor/nach jedem Lauf per SHA-256. Der vollständige
Ausgangslauf umfasst 317 Dateien und 2646 Fälle: 2645 bestanden, kein Fehler,
ein optionaler SRD-PDF-Skip, 721,810 s außen / 721,466 s Runner. Prozess-RSS
maximal 1123124 KiB, Cgroup-Peak 1255137280 Bytes; 2071 Quellhashes stimmen
vor/nach dem Lauf überein.

Der Ausgangsbestand enthält bereits die Plan-3-Beiträge. Der vollständige
Hashabgleich gegen den neuen Stand findet Änderungen nur in
`src/app/campaign/preparation.ts` und
`tests/campaign/desktop-preparation-owner.test.mjs`; die übrigen gemessenen
Produktions-, Test- und Toolquellen bleiben erhalten. Die Prüfdokumentation
ist bewusst kein Bestandteil des Compiler-/Testquellenfingerprints.

| Identische Dateiauswahl | Vorher warm | Nachher warm | Fälle vorher / nachher |
| --- | ---: | ---: | ---: |
| Preparation-/Combat-/Live-/Weltbesitzer, vier Dateien | 6,138 s Runner | 6,523 s Runner | 44 / 47 |
| Preparation-/Live-Priority, zwei Dateien | 11,990 s Runner | 12,049 s Runner | 73 / 73 |

Der erste Besitzer-Nachherlauf braucht 6,924 s Runner und enthält einen
neuen Store-Assetaufbau; die zusätzlichen warmen Läufe trennen diesen Cacheeffekt.
Der abschließende warme Lauf enthält auch das verschärfte Sichtbarkeitsorakel
des Packetfalls: Die alte Mappe ist geschlossen, die Controls sind außerhalb
des Packetcontents sichtbar zurückgegeben und zeigen den neuen B-Rohentwurf.
Die drei neuen Fälle kosten in diesem warmen TAP zusammen 294,264 ms. Die rund 0,38 s
Mehrzeit der Besitzerauswahl sind zusätzliche Schutzarbeit, keine Einsparung.
Die unveränderte Priorityauswahl zeigt keinen belastbaren Zeitgewinn.

Plan 4 liefert deshalb keine neue Leistungsoptimierung und behauptet keinen
Suite-Speedup. Die bekannten Compiler-/Fixture-/DB-/Fachkosten werden ohne
neuen Befund nicht erneut profiliert; unveränderliche Daten und identische
Vorbereitung werden bereits wie oben beschrieben wiederverwendet. Kleine
Auswahlen liefern frühe Rückmeldung mit ausdrücklich begrenztem Schutzumfang.

Eigene schwere Prüfungen laufen nacheinander. Die Desktopumgebung bleibt
aktiv; der OS-Dateicache wird nicht geleert. Eine Fünf-Sekunden-Stichprobe
während des Ausgangslaufs misst beim fremden Benutzermanager 91 %, bei
`uresourced` 21 % und beim D-Bus-Broker 9 % eines CPU-Kerns. Last- und
Druckwerte stehen im jeweiligen `host.json`; dieser Host ist nicht lastfrei.

Ein nach 116,872 s geordnet gestoppter Abschlussanlauf bleibt separat unter
`.build/round9-plan4-final-superseded` erhalten. Er wurde vor jeder weiteren
Quelländerung beendet, um das oben genannte Sichtbarkeitsorakel zu verschärfen,
und ist ausdrücklich kein vollständiges Suiteergebnis. Die endgültige
Besitzerauswahl und alle drei Gegenproben wurden danach erneut ausgeführt.

## Vollständiger Abschluss

| Maß | Ausgang | Abschluss |
| --- | ---: | ---: |
| Aktive Dateien | 317 | dieselben 317 |
| Fälle / bestanden / Fehler / Skips | 2646 / 2645 / 0 / 1 | 2649 / 2648 / 0 / 1 |
| Außenzeit einschließlich npm/Wrapper | 721,810 s | 720,546 s |
| Runnerzeit | 721,466 s | 719,385 s |
| User-CPU / System-CPU | 760,05 / 59,76 s | 760,13 / 59,63 s |
| Größter Prozess-RSS | 1123124 KiB | 975796 KiB |
| Cgroup-Peak | 1255137280 Bytes | 1419755520 Bytes |
| Shared-Builds / Cachetreffer | 8 / 91 | 7 / 92 |

Beide vollständigen Läufe sind grün und binden unveränderte Quellen vor/nach
dem jeweiligen Lauf. Der Abschlussdigest lautet
`1e6a39a97eda7764b9e50777c0331d3bb65307ceb4f612e89e1a923ac02cb0f5`.
Die Dateiauswahl ist identisch, die drei Fälle kommen hinzu, keine bestehende
Assertion oder Fachfixture wurde entfernt. Der einzige Skip bleibt der
optionale SRD-PDF-Fall ohne bereitgestellte Quelldatei. Die eigenen Cgroups
sind nach Prozessende entfernt.

Die Differenz von rund 1,3 s außen ist bei dieser Last, unterschiedlicher
Cachevorbereitung und zusätzlichen Fällen kein isolierter Leistungsgewinn.
Der Prozess-RSS und der Speicherhöchststand der ganzen Cgroup sind verschiedene
Messgrößen; aus dem niedrigeren Einzelprozess-RSS folgt hier keine geringere
Gesamtspitze. Das Ziel unter 300 s bleibt verfehlt und offen. Der vollständige
Abschluss liegt unter `.build/round9-plan4-final/`, einschließlich TAP,
Quellmanifest, Ressourcen- und Lastprotokoll.

## Typen, Build und native Bedienung

`npm run check` einschließlich aller Umgebungsprüfungen, `npm run check:repo`
und `npm run build:desktop` bestehen über den normalen begrenzten Launcher.
Die native Hierarchieprobe und Packet-Originalprobe bestehen am neu gebauten
Renderer bei 100 Prozent Appzoom. Beide verwenden X11 und jeweils zwei
regulär beendete Starts einschließlich frischer Wiederöffnung. Alle zwanzig
Runtimeartefakte bleiben je Probe unverändert; Rendererfehler und überlebende
Prozesse werden nicht als Erfolg akzeptiert. Neue Fensteraufnahmen vor Close
sind Teil des nativen Unterbaus. Der Hashabgleich nach der vollständigen Suite
bestätigt dieselben zwanzig Runtimeartefakte für beide Proben und den aktuellen
Build.

Die Hierarchieprobe erhält Elternauswahl und Zielbesuch und bestätigt nur die
beabsichtigten Original-/Besuchsänderungen. Die Packetprobe erhält Suche,
Besuch und Leseposition, bearbeitet die Originalquelle mit dem bisherigen
Writer und prüft die Rohbytes nach frischem Start. Dies sind automatisierte
native Proben; die absichtlich verzögerten Antwortfälle oben werden separat
an den echten DOM-/SQLitebesitzern geprüft. Keine physische Eingabe- oder
Terrain-Gesamtabnahme wird daraus abgeleitet.

Belege: `.build/round9-plan4-check.log`, `round9-plan4-check-repo.log`,
`round9-plan4-build-desktop.log` sowie
`.build/round9-plan4-hierarchy-native/result.json` und
`.build/round9-plan4-packet-native/result.json`. Die tatsächlichen
Workflow-Dateilinks wurden im gemeinsamen Capability-Katalog ergänzt und
die beiden geprüften Abläufe mit `--geprueft` markiert.

## Offene Restziele

Das Ziel einer gesamten Suite unter 300 Sekunden bleibt offen, solange die
aktuelle vollständige Messung es nicht belegt. Mehr Parallelität, vollständige
historische UI-Matrizen und sämtliche alten Assertionzuordnungen sind kein
abgeleiteter Erfolg. Historische Unzuordnung bleibt ein offener Abgleich und
ist keine Anzahl von Produktfehlern.

Gemeinsame E2E-Gates, visuelle Terrain-/Wasserabnahme, Leistungsqualifikation
am festgelegten Zielgerät, Paket/Installation und Ownerabnahme bleiben eigene
Lieferpflichten. Der fehlende Snapshotstart aus Plan 2 und die offenen
E2E-02-Pflichtfälle werden durch diese Besitzer- und Testarbeit nicht geliefert.
Die lokale DOM-/SQLitequalifikation schließt sie nicht.
