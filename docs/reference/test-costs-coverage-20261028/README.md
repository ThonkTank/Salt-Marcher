# Testkosten und gezielte Verhaltensabdeckung am 28.10.2026

Status: Lokaler Abschluss der priorisierten Schutzgruppen; übrige historische Detailmatrizen und Ownerabnahme separat.
Owner: project
Last Reviewed: 2026-10-28
Source of Truth: [Messwerte](measurements.json), die unveränderte Vollsuite über `tools/measure-test-suite.py`, ausführbare Tests und der gemeinsame Capability-Katalog.

Die geprüfte Vorbereitung identischer Store-/Regionsworker-Bundles ist günstiger.
Der ursprüngliche Teilabschluss ergänzte 18 Fachfälle und zwei Cachefälle; die
Fortsetzung ergänzt 97 priorisierte Verhaltensfälle. Keine aktive Datei und keine
bestehende Fachassertion wurde zur Beschleunigung entfernt. Die Vollsuite
bleibt `npm test`; Candidate-CI und Parallelitätsregeln bleiben unverändert.
Dieser Vergleich belegt kein allgemeines Zeitversprechen und keine vollständige
Wiederherstellung der in PR #1423 entfernten Abdeckung.

## Vollständiger Vergleich

Beide Läufe verwenden den aktuellen Dirty-Checkout auf `1e7512f74`, Node 22.19.0,
npm, einen Testprozess und eine eigene tatsächliche Linux-Cgroup mit 2 GiB
`memory.high` und 3 GiB `memory.max`. Der normale systemd-Scope-Start scheiterte
vor dem ersten Test nach 30 Sekunden; dieser Fehlstart liegt separat unter
`.build/test-costs-coverage-20261028-before`. Die Messbefehle und der Runner
wurden nicht umgeschrieben; nur der äußere Prüfprozess wurde vor seinem Start
in die dokumentierte Cgroup aufgenommen. Beide Gruppen endeten leer und wurden
entfernt. Während jeder Vollmessung liefen keine weiteren Tests, Builds oder
nativen Proben. Die Desktopumgebung blieb aktiv; der OS-Dateicache wurde nicht
geleert. Shared-Artefakte waren in beiden Vollmessungen warm; Regressionstests
erzeugen daneben ausdrücklich ihre eigenen isolierten Cache-Fixtures.

| Größe | Vorher | Nachher |
| --- | ---: | ---: |
| Ganze Messung, einschließlich npm/äußerem Start | 719,927 s | 709,054 s |
| Vorbereitung / Tests im Runner | 0,032 / 719,393 s | 0,022 / 708,494 s |
| Aktive Dateien | 301 | 305 |
| Laufzeitfälle / bestanden / Fehler / Skips | 2472 / 2468 / 3 / 1 | 2492 / 2491 / 0 / 1 |
| User-CPU / System-CPU | 775,06 / 56,18 s | 773,23 / 56,97 s |
| Größter Prozess-RSS, GNU time | 945480 KiB | 942144 KiB |
| Tatsächlicher Cgroup-Speicherhöchststand | 1077682176 Bytes | 1152000000 Bytes |

Der Vorherlauf fand drei bereits vorhandene Fehler: der Atlas-Antwortfixture
fehlte `geometry.runtime`; der Vorlagentest verwies auf die nicht angelegte
Notiz „Mara“; der Münztest erwartete eine Referenz ohne den inzwischen gebundenen
Katalogstand. Die Fixtures/Erwartungen wurden an diese bestehenden Verträge
angeschlossen. Der Münztest sendet weiterhin seine bisherige Eingabe und prüft
nun zusätzlich deren bestätigte Katalogbindung. Alle ursprünglichen
Assertions bleiben bestehen. Deshalb sind Reparaturen und 20 neue Fälle
zusätzliche ausgeführte Arbeit; der Vollvergleich isoliert keinen einzelnen
Speedup. Die Teilmessungen unten prüfen unveränderte produktive Quellen und
bestehende Fachfixtures. Die 26.-Oktober-Messungen gehören zu einem anderen
Testbestand und dienen nur als historischer Vergleich.

## Gemessene Kostentreiber und begrenzte Änderung

Die Prozessstichprobe der Baseline fand als größte Datei die vollständigen
TypeScript-Umgebungsprüfungen: mindestens 66,5 s Laufzeit und 102,0 s CPU.
Materialtiles lagen bei mindestens 21,3 s, Terrainrouten bei 20,3 s und die
vollständige Referenzwelt bei 17,3 s. Dies sind 1-Sekunden-Stichproben und keine
exakten einzelnen Datei-Timings. Diese Arbeit umfasst echte Daten-/Raster- und
Compilerprüfungen; sie wurde weder verkleinert noch aus der Suite genommen.
Eine zusätzliche Durchsicht desselben unveränderten TypeScript-Programms
kostete in der Einzelmessung 939/929 ms. Der Test verwendet nun dieselbe einmal
ermittelte Diagnoseliste für seine beiden bestehenden Assertions; der vollständige
Quellabschluss und alle fünf Umgebungen bleiben erhalten.

Die sechs wiederholten direkten Builds je Einstieg erzeugten bytegleiche
Bundles. Der vorhandene Testhelfer teilt jetzt zusätzlich die exakt gleiche
Regionsworker-Buildform. Fünf bisher direkt kompilierende Worker-/Service-Dateien
und der Vorlagentest verwenden den vorhandenen Helfer. Servicebundles, eigene
Einstiege, Plugins und andere Buildoptionen werden weiterhin regulär gebaut.

| 6 Builds je Einstieg | Direkt | Cache kalt, erster Miss + 5 Hits | Cache warm, 6 Hits |
| --- | ---: | ---: | ---: |
| Store | 1761,6 ms | 757,1 ms | 229,2 ms |
| Regionsworker | 1502,3 ms | 590,5 ms | 173,0 ms |

Die realen Bundle-SHA-256 sind in allen drei Modi identisch. Identität umfasst
Quellen unter `src/` und `desktop/`, Hinzufügen/Entfernen, Buildskripte, Helfer,
Konfiguration, Lockfile, Node, esbuild, Plattform und Architektur. Nur die
identischen unterstützten Optionen werden geteilt. Vor Wiederverwendung
werden die vollständige erwartete Ausgabeliste und sämtliche Ausgabehashes
geprüft. Auch ein gültiges, aber unvollständiges Manifest darf eine fehlende
Ausgabe nicht zertifizieren. Quelländerung während Erstellung, fehlgeschlagene
Erstellung, lebender/toter Lockbesitzer und konkurrierende Veröffentlichung
bleiben geprüft. Datenbanken und Editorzustände werden nicht geteilt.

Die [dokumentierte Worker-Auswahl](../../project/verification/test-selections.md)
läuft in beiden Modi mit sechs Dateien und denselben 24 Fällen:

| Gezielter normaler Runner | Kalt | Warm |
| --- | ---: | ---: |
| Gesamtdauer | 24,066 s | 22,979 s |
| Echte Shared-Builds / Cachetreffer | 2 / 9 | 0 / 11 |
| Fälle / Fehler / Skips | 24 / 0 / 0 | 24 / 0 / 0 |

„Kalt“ bedeutet kein Artefakt zum aktuellen Inhaltsschlüssel. Nur taskeigene
Cacheartefakte wurden zuvor beiseitegelegt; vorhandene andere Cacheeinträge und
der OS-Dateicache blieben erhalten. Die 1500-Raum-Geometrie, pigmentierte und
unpigmentierte Raster, großen Pinsel, eigene SQLite-Dateien, echte Worker,
Abbrüche, Quellenwechsel und Fresh-Vergleiche bleiben erhalten.

## Historische Assertions und gezielte Ergänzung

Aus `94fddd035^` wurden elf entfernte Live-/Preparation-/Autorenverweisdateien
mit 1731 statischen Assertaufrufen geprüft. Der einmalige Einzelabgleich unter
`.build/test-costs-coverage-history/assertion-inventory.json` ordnet jede Stelle
konkreten aktuellen Assertions beziehungsweise einem offenen Nachweis zu.
Im akzeptierten Teilabschluss hatten 108 Stellen einen benannten aktuellen Beleg;
1623 blieben damals im Einzelabgleich offen. Der nachfolgende priorisierte
Abgleich ergänzt diesen Stand, ohne das historische Inventar neu aufzubauen.
Das ist keine Coveragequote: offene Stellen können verwandte Belege
besitzen, ohne dass deren genaue alte Erwartung damit nachgewiesen wäre.
Insbesondere vorhandene Welt-Owner-, Aktivierungs-, Session-Owner- und native
E2E-Prüfungen wurden berücksichtigt; bloße Imports, Dateilinks und allgemeines
Testgrün schließen keine alte Erwartung.

Die neuen Fälle verwenden vollständige öffentliche Produktionsmodule:

- `desktop-preparation-owner.test.mjs`: A → B → A mit alter Antwort und
  unverändertem Datenbankzustand; späterer Text während Write-Drain; tatsächliche
  angewandte/nicht angewandte SQLite-Aufträge und ausdrücklicher Receiptcheck
  ohne automatisches Neusenden; echter Verweisconsumer bei Eingabe während
  Flush/Quellprüfung und erneuter Aktivierung mit gleichem Token und gleicher ID.
- `desktop-text-reference-picker-owner.test.mjs`: fehlende, gelöschte, geänderte
  und fremde Quelle; spätere Alias-Eingabe, einzelne Verifikation trotz Doppelklick
  und entwerteter alter Owner. Keine unverifizierte Quelle liefert einen Link.
- `desktop-text-reference-readers.test.mjs`: unbekannte Aliasquelle wird nicht
  als leeres Suchergebnis bestätigt; 250 Verweise bleiben als Text vollständig,
  während 200 Controls begrenzt sind; ein entwerteter Übergabecontrol schreibt
  und meldet nichts. Die öffentlichen Öffnungs-/Aktivierungsanschlüsse ersetzen
  die früher erfundenen Probeexports.
- Bestehender Live-Owner: Rücklesen einer verlorenen Bestätigung und Sicherung
  des späteren wörtlichen Rückblicktexts gegen die bestätigte Basis.
- `test-worker-build-asset.test.mjs`: tatsächlicher Compiler/Cache, transitive
  Quellen, Desktopquelle, Helferidentität, beschädigte Ausgabe, unvollständiges
  Manifest und weiterhin eigene Ergebnisse abweichender Buildoptionen.

Die drei fachlichen Gegenproben entfernten vorübergehend genau eine produktive
Schutzregel: Revisionsbindung des Verweises, Gültigkeit des Preparation-Reads
und Erhaltung späterer Rückblickeingabe. Die jeweils wichtige neue Assertion
scheiterte gezielt. Danach wurden die vollständigen Quelldateien einschließlich
bestehender fremder Änderungen bytegenau wiederhergestellt. Eine weitere Cache-Gegenprobe ließ ein unvollständiges Manifest wieder gelten; die neue Ausgabeprüfung scheiterte. Auch diese Toolquelle wurde bytegenau zurückgenommen.
Die neuen Verhaltenstests schneiden keine Quellen aus, fügen keine privaten
Probeexports hinzu und bilden keine zustandsabhängigen Testketten.

Aktuelle Ablaufzuordnungen stehen ausschließlich im gemeinsamen
`codex-dungeon-capability`-Katalog. Die neuen Dateien wurden anhand ihrer
Assertions zugeordnet und tatsächliche Prüfungen mit `--geprueft` vermerkt;
die inverse Ansicht wurde verwendet. Die kleinen Dateiauswahlen wurden mit
`--list` geprüft: 5/3/4/5/6 Dateien, sämtlich Teil der vollständigen aktiven
Auswahl. Kein zusätzlicher Runner und kein zweiter aktueller Coveragekatalog.

## Priorisierte Schutzgruppen nach dem Teilabschluss

Die Fortsetzung schließt gezielt Eingabeverlust, falsche Schreibziele,
Doppelwirkung und das Übernehmen veralteter oder privater Inhalte. Sie stellt
nicht pauschal alle 1623 offenen Altassertions wieder her. Der einmalige
historische Filter umfasst **384 Erwartungen in fünf Schutzgruppen**;
jede besitzt einen konkreten erfolgreichen heutigen Assertionbeleg.
Der Filter und seine einzelnen Zuordnungen stehen im bestehenden
`.build/test-costs-coverage-history/assertion-inventory.json`.
Der frühere Inventarstand bleibt daneben bytegenau erhalten.

| Schutzgruppe | Gefilterte alte Erwartungen | Geprüfte Grenze |
| --- | ---: | --- |
| Eingabe und Quellen | 63 | Laufende Komposition blockiert Flush/Übergabe; echte Notiz- und Ortsabschnittconsumer verwerfen frühere Auswahlen. Abgebrochene und überholte Quellantworten übertragen weder privaten Text noch Fehler in den neueren Kontext; Fehler/Retry erhalten Editor und Rohtext. |
| Optionales Live-Material | 39 | Kernszene bleibt bei ausstehendem oder fehlgeschlagenem Material nutzbar. Retry erhält Text, Ort und Controls; neuere Reads und Aktivierungen entwerten alte Ergebnisse. |
| Live-Gruppe und Teilnahme | 24 | Alte Live-Reads und Profilbestätigungen ersetzen keine neue Gruppe oder spätere Eingaben. Gruppenwechsel während Figurenerstellung erzeugt keine falsche Teilnahme; ausdrückliche Klärung und Teilnahme-Retry verwenden dieselbe einmal angelegte Figur. |
| Generierung, Plan und Übergabe | 199 | Flushabbruch und alte Controls/Antworten besitzen keine neuere Generierung. Bestätigt werden angezeigte Plan-/Vorschlagsrevisionen. Spätere Besuchstexte bleiben beim ursprünglichen Besuch; verlorene angewandte und nicht angewandte Antworten werden ohne automatisches Neusenden geklärt. Fehlende angeforderte Pläne und entfernte ausgewählte Besuche liefern kein Ersatzschreibziel. |
| Moment, Belohnung und Veröffentlichung | 59 | Gesendeter Wortlaut und spätere Entwürfe bleiben getrennt. Nur das aktuelle bestätigte Ergebnis besitzt Folgeaktionen; Rewardnavigation folgt der übernommenen Besuchsidentität. Fehlgeschlagener Ortssave und frühere Bild-/Wissensaktionen besitzen kein neues Ziel. |

**97 zusätzliche Laufzeitfälle in sechs aktiven Dateien** benutzen vollständige
öffentliche Produktionsmodule, echtes zusammengesetztes Quellmarkup und,
wo Schreibwirkung geprüft wird, eigene SQLite-Datenbanken. Angenommene
Store-/Receiptbelege werden weiterverwendet. Die gemeinsame gezielte Auswahl
mit diesen vorhandenen Belegen bestand mit **210 Fällen in 14 Dateien**
in 34,853 Sekunden im normalen Runner. Rohbytes, DOM-Identitäten,
fehlende Writes, Figurenanzahl, Mitgliedschaft und angewandte/nicht angewandte
Receipts sind tatsächliche Orakel. Zusätzliche Verweis-Alias-/Revisionsmatrizen
wurden nicht dupliziert.

Zwei rote Regressionen haben Produktfehler gezeigt:

- Die Live-Wissenscontrols konnten nach Gruppen-/Ortswechsel alten Text übernehmen.
  `live-knowledge-ui.ts` bindet Text-, Quell- und Porträtaktionen nun an ihre
  Rendergeneration, Gruppe, Fokus und Ortsidentität; Abmeldung entwertet sie ebenfalls.
  Ein bereits angenommener Quellen-/Porträtauftrag behält seine Kontextlease über
  den eigenen erfolgreichen Flush und eine Neudarstellung derselben Gruppe.
- Der Preparation-Refresh nach einer Kopierbestätigung verwarf später eingegebene
  Besuchsnotizen. Er übernimmt nun den bestätigten Plan über den bestehenden
  feldweisen Planabgleich und erhält den ursprünglichen Besuch, solange dort
  spätere lokale Eingabe vorliegt. Ein inzwischen fremd geänderter Text oder
  entfernter ursprünglicher Besuch hält die lokale Eingabe gesperrt und unverändert;
  es wird kein Ersatzbesuch beschrieben. Die Kopie bleibt genau einmal angehängt.

**18 gezielte Gegenproben** entfernten die jeweilige produktive Schutzregel und
brachten die zugehörige Assertion zum Scheitern. Quellen wurden jedes Mal als
vollständige Dateien einschließlich vorheriger fremder Änderungen bytegenau
wiederhergestellt; die abschließenden Quellhashes stimmen mit den gesicherten
Originalen überein. Erfasst sind Komposition, Quellread, abgetrennter Relationscontrol,
Materialgeneration, Gruppenread, Teilnahmeowner, Generierungsflush/-antwort,
Planrevision, Kopieowner/-text, Momentfolgeaktion, Rewardidentität,
Bildfreigabe, Wissensaktion, Ortsabschnittauswahl, verspäteter Ortsmappenread und
ein fremd entfernter Kopiezielbesuch.
Eine anfänglich noch grüne Relationsgegenprobe führte zur zusätzlichen Prüfung,
dass schon die abgetrennte Inspektionsaktion unterbleibt.
Belege: `.build/priority-counterprobes/report.json` und die einzelnen Logs.

Der ganze historische Einzelabgleich steht nun bei **409 konkret zugeordneten
und 1322 weiterhin offenen Assertions**. Alle 384 gefilterten Pflichterwartungen
sind erfolgreich belegt; die übrigen Altmatrizen bleiben fachlich abgegrenzt offen.
Aktuelle Ablauf-/Testdateilinks stehen ausschließlich im gemeinsamen
Capability-Katalog; neue Dateien sind zugeordnet, tatsächliche Prüfungen mit
`--geprueft` vermerkt und die inverse Ansicht geprüft.

## Native Nachweise und verbleibende Grenzen

Alle nativen Läufe verwenden ausschließlich 100 Prozent Appzoom und getrennte
Profile. Originalquellenprobe und Live-Archiv besitzen je zwei regulär beendete
Starts, verschwundene PIDs, keine Rendererfehler und unveränderte Runtimehashes.
Ein veralteter Selector auf die frühere Mappenüberschrift und ein nicht mehr
immer erforderlicher „Gruppe öffnen“-Schritt wurden dem aktuellen sichtbaren
Ablauf angepasst; Lesen, Fokus/Lesestelle, spätere Originalbearbeitung, Fehler,
Retry, Rückkehr, Datenvergleich und Neustart bleiben als Assertions erhalten.
Die zunächst fehlgeschlagenen Läufe liegen getrennt neben den Erfolgsbelegen.

Nach der Vollmessung wurde ausschließlich die native Archivprobe weiter
verschärft: Sie liest nun `#archive-mask-detail` statt der Auswahlliste, prüft
vorher tatsächlich vorhandene alte Notizen, den Ladezustand, deren Entfernung
und anschließend die neuen Notizen. Eine Gegenprobe ohne das produktive
Leeren des Detailbereichs scheiterte genau an der Erhaltung alter Notizen.
Die Produktionsquelle wurde bytegenau restauriert, der Desktop neu gebaut und
alle zwanzig Runtimehashes gegen den erfolgreichen E2E-Build verglichen. Die
abschließende native Probe und ihr betroffener Node-Quellguard sind grün.
Diese nachgelagerte Probe ist separat belegt; die 305 Node-Testquellen und
Produktionsquellen sind identisch zum vollständigen Messlauf.

Der vorhandene E2E-01-Katalog wurde vollständig auf demselben aktuellen Runtimebuild erneut ausgeführt: **22 Pflichtszenarien bestanden, 19 Starts bei Zoom 1, keine Rendererfehler**. Achtzehn Prozesse endeten regulär; einer endete nach sichtbarer Savedbestätigung und unabhängigem Inventarhash im vorgesehenen bestätigten Autosave-Crash mit SIGKILL und wurde erfolgreich wieder geöffnet. Alle PIDs sind verschwunden; alle drei damaligen nativen Qualifikationen besitzen exakt dieselben zwanzig Runtimehashes. Ausführung mit Software-GPU; das ist technische native Qualifikation, keine neue Hardware-/Zielgeräte- oder Ownerabnahme.

Repositoryprüfung, Desktop-Typprüfung und Desktopbuild bestanden. Verpackung,
Installation, Candidate-CI, integrierter Zielgerätestand und menschliche
Ownerabnahme werden dadurch nicht behauptet; es erfolgte keine Integration.

Die drei erweiterten nativen Proben der Fortsetzung verwenden den endgültigen
Build mit identischen 20 Runtimehashes: Eingabe/Komposition und Quellenrückweg,
Live-Gruppenwechsel mit Materialfehler und Retry sowie Bestätigung der tatsächlich
angezeigten Planrevision. Fünf Starts bei Zoom 1 endeten regulär; alle PIDs sind
verschwunden und es gab keine Rendererfehler. Die Live-Probe verwirft außerdem
einen tatsächlich früher gerenderten Wissenscontrol nach dem Gruppenwechsel
und prüft beide Gruppen erneut aus dem frischen Store. Der frühere vollständige
E2E-01-Lauf wurde als Beleg seines eigenen Buildstands erhalten; die Fortsetzung
behauptet keine erneute vollständige E2E-01-Abnahme.

Ein nativer Zwischenlauf begann seine neue Agendamessung vor Abschluss des
Gruppenreads; die Probe wartet jetzt vor dem nächsten Messabschnitt auf dessen
bestätigte Ruhe. Ein weiterer Zwischenlauf suchte den Wissensbutton im noch
zugeklappten Wissensbereich; die erfolgreiche Probe öffnet ihn über die sichtbare
Zusammenfassung. Beide Fehlbelege bleiben separat erhalten.

Repositoryprüfung, vollständige Typ-/Umgebungsprüfung, Desktop-Typprüfung und
beide Builds bestanden. Ein erster Typprüfprozess erreichte mit dem automatisch
gewählten 1-GiB-V8-Heap sein Heaplimit; derselbe Check bestand danach mit dem
bereits dokumentierten 2304-MiB-Heap innerhalb unveränderter echter 2/3-GiB-Cgroup.
Das ist kein aufgehobenes Speicherlimit. Eine anschließend gefundene
Nullability-Typstelle wurde vor dem endgültigen Stand korrigiert. Ein zuvor
begonnener Volltest wurde für den Quellenreview geordnet unterbrochen und bleibt
als ausdrücklich unvollständiger Lauf getrennt erhalten.

Der abschließende unveränderte `npm test` bestand: **311 Dateien, 2589 Fälle,
2588 bestanden, null Fehler, ein optionaler SRD-PDF-Fall übersprungen**. Alle
finalen Produktions-/Testhashes blieben über diesen Lauf unverändert; auch die
20 zuvor nativ qualifizierten Runtimeartefakte sind danach bytegleich.

| Fortsetzung gegenüber akzeptiertem Teilabschluss | Akzeptiert | Abschließend |
| --- | ---: | ---: |
| Aktive Dateien / Laufzeitfälle | 305 / 2492 | 311 / 2589 |
| Gesamte Messung | 709,054 s | 726,882 s |
| Vorbereitung / Tests im Runner | 0,022 / 708,494 s | 0,026 / 726,183 s |
| User-CPU / System-CPU | 773,23 / 56,97 s | 790,35 / 57,85 s |
| Größter Prozess-RSS | 942144 KiB | 962124 KiB |
| Tatsächlicher Cgroup-Speicherhöchststand | 1152000000 Bytes | 1082429440 Bytes |

Der gemessene Unterschied beträgt +17,827 Sekunden
(+2,51 Prozent) bei 97 zusätzlichen Fällen und zwei
produktiven Schutzkorrekturen. Node 22.19.0, ein Testprozess und tatsächliche
2/3-GiB-Grenzen bleiben gleich; OS-Dateicache und aktive Desktopumgebung wurden
nicht zurückgesetzt. Der Lauf hatte keine parallel ausgeführten Tests, Builds
oder nativen Proben. Die beiden Shared-Worker-Einträge mussten zum endgültigen
Quellfingerprint zuerst aufgebaut werden; ihre zwei Erstbuilds und 89 weiteren
Root-Cachetreffer sind enthalten. Die absichtlichen isolierten Cache-Gegenfälle
bleiben zusätzlich im Assetbericht sichtbar. Der Vergleich isoliert keinen
Speedup und ändert das weiterhin offene allgemeine Laufzeitziel nicht.

Offen bleiben erhebliche fachliche CPU-Kosten und die übrigen historischen
Detailmatrizen, etwa umfangreiche verschachtelte Notizmappen, einzelne
Archiv-/Zeitcontrolvarianten, unmaterialisierte Encounterdarstellung und
nicht gefilterte Sonderfälle entliehener Quellkontexte. Das sind keine neuen
Abnahmebehauptungen. Keine Testdatei wurde wegen fehlender Capabilityzuordnung
entfernt. Verpackung, Installation, Candidate-CI, Integration und menschliche
Ownerabnahme sind weiterhin nicht Gegenstand dieses lokalen Auftrags.

Fortsetzungsbelege: `.build/priority-final-verification/`, `.build/priority-verification/`,
`.build/priority-counterprobes/`, `.build/priority-final-full/` und das bestehende
historische Assertioninventar. Die Messwertdatei enthält die Quellen-/Testhashes,
Prüfbefehle, Gegenproben, native Buildbindung und den Vergleich zum akzeptierten
Teilabschluss; dessen ursprüngliche Vorher-/Nachhermessung bleibt unverändert.

Lokale Detailbelege: `.build/test-costs-coverage-20261028-before-full/`,
`.build/test-costs-coverage-20261028-after-full/`,
`.build/test-costs-coverage-counterprobes/`, `.build/test-costs-subset-final-cold/`,
`.build/test-costs-subset-final-warm/`, `.build/test-costs-native-packet-original-20261028-pass/`,
`.build/test-costs-native-live-archive-20261028-final/` und
`.build/test-costs-native-e2e01-20261028/`. Die Messwertdatei bindet die
Quellstände, Dateien, Cachekeys, neuen Testnamen und Ressourcenberichte.
