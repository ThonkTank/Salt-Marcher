# Runde 9: gemeinsame Spielkette und offene E2E-Gates

Status: Current; Teilnachweis, kein E2E-02–04-Gesamt-PASS.
Owner: project
Last Reviewed: 2026-10-29 (Pflichtfallzuordnung und lokaler nativer Teilablauf)
Source of Truth: Die [gemeinsamen E2E-Kriterien](../../project/verification/end-to-end.md) bestimmen die Gates; dieser Beleg dokumentiert die tatsächlich ausgeführte Teilmenge und fehlende Eingänge.

## Erreichter Umfang

Die neue native Probe [test-desktop-e2e02.mjs](../../../tools/test-desktop-e2e02.mjs)
führt **eine gemeinsame Kampagne** von vorbereiteten Orts-/Katalogreferenzen über
ausdrückliches Initialize, Besuchsübernahme, Split/Fokus/Rejoin, Chase, Combat,
XP, Loot-Ledger und Sitzungsabschluss bis in einen echten neuen Electronprozess.
Sie verbindet sichtbare UI-Schritte mit einem unabhängigen SQLite-Leser. Es
handelt sich um einen technischen Teilnachweis. Fehlende Pflichtfälle stehen
im Ergebnis ausdrücklich offen; `complete` bleibt false.

Die bislang vorhandenen Fachproben werden dadurch nicht rückwirkend zu einem
gemeinsamen Lauf. Der integrierte technische E2E-01-Nachweis auf `5c679da3`
bleibt wie [dort beschrieben](../../project/verification/end-to-end.md#integrierter-technischer-e2e-01-nachweis)
übernommen; Zielgerät, Paket/Installation und Owner sind weiterhin eigene offene
Stufen. Runde 9 führt keine Integration oder Veröffentlichung aus.

## Fixture und unabhängige Orakel

[live-e2e02-fixture.mjs](../../../tools/live-e2e02-fixture.mjs), Version
`e2e02-desktop-v1`, erweitert die bestehende `e2e01-desktop-v2` über produktive
Writer. Das Rezept bindet drei Figuren (Mira/Borin/Siv), bekannte Anfangs-XP 0,
zwei gruppierte Guards und einen individuellen Wolf sowie unveränderte
Vorbereitungsprosa mit CRLF und Rand-Leerzeichen. Die Vorbereitung besitzt
SessionPlan-/Visit-/Location-IDs, der Encounter stabile Creature-/Itemreferenzen.
Alle konkreten zufälligen IDs werden vor dem ersten nativen Start in
`fixture.json` eingefroren; dies ist kein nachträglich aus einem Import gewonnenes
Sollinventar. Der Fixturetest pinnt das Rezept mit SHA-256
`f7dd20bba583462898afc2fd0b166303fceff7afe59cf97fc161d36850b6662a`.

| Übergang | Erwartetes unabhängiges Datenorakel |
| --- | --- |
| Vor Initialize | Drei aktive Roster-IDs, keine Scene, kein Focus, keine SceneClock. SessionPlan, Visit, Encounter und Location unverändert gespeichert. |
| Initialize und Besuch | Eine neue PrimaryScene, alle drei IDs genau einmal zugeordnet. Besuchs-Preview/Cancel schreibt nichts; bestätigte Übernahme speichert Herkunft und exakte Prosa. Der aktuelle Initialize ist **kein** PreparationSnapshot-Start. |
| Split/Fokus/Rejoin | Borin erhält dieselbe eigene ID in neuer Scene; expliziter Fokuswechsel; Rejoin erhält alle drei IDs, retired die leere SplitScene und fokussiert Primary. |
| Chase | Dieselben drei CharacterIds werden ausdrücklich übernommen; eine bestätigte Runde erhöht Scenezeit um sechs Sekunden; eigener Chase-Abschluss. |
| Combat | Neue Combat-/Participant-IDs, zwei Guards mit gemeinsamer GroupId und individuellen HP, Wolf mit individueller Gruppe. PlanOrigin bindet ID/Revision. Initiative 15, Guard-HP 11→9, Zustand „Liegend“, Kampf bis Runde 2. |
| 2014-Bewertung | Festes Goldenorakel: 2×25 + 50 = 100 Basis-XP; drei Gegner ×2 = 200 angepasste XP; drei Level-1-PCs, Schwellen 75/150/225/300, „Mittel“. Keine Neuberechnung der Erwartung aus Produktionsformeln. |
| Reward und Ledger | Ein Kampfaward, 99 XP = 33 je CharacterId, ein Schatz, ein zugewiesener Salzschlüssel. Originale Finish-/Allocate-CommandIds werden am echten Mainhandler mit dem ursprünglichen Sender erneut zugestellt: identische Antworten und vollständig unveränderte inventarisierte Daten. Dies ist ein Protokollreplay, kein nativer Antwortverlustfall. |
| Sitzungsabschluss und neuer Prozess | Bestätigter Rückblick; regulärer Exit mit abwesender PID; neuer Electronprozess auf demselben Profil. Domain-, Identitäts-, Revisions-, Clock-, Combat-, Chase-, Award- und Ledgerzeilen bleiben exakt; vorherige Receipts bleiben bytegleich vorhanden. |

Jeder Checkpoint vergleicht Plan, Visit, Sessionvorbereitung, Encounter und Location
byte- und revisionsgleich mit dem Ausgangsbestand. `snapshots.json` enthält die
Rohzeilen und Hashes, `commands.json` die tatsächlich vom Mainhandler bearbeiteten
Befehle und Antworten. `receipt-trace.json` bindet jeden beobachteten erfolgreichen
Auftrag an genau ein unabhängig gelesenes Receipt und prüft dessen Payload gegen
die tatsächliche Mainantwort; `reward-replay.json` hält die beiden Duplikate fest.
Maininstrumentierung ergänzt keine Rendererrechte. Die native Probe schreibt
keine kanonischen Daten über CDP oder SQL.

## E2E-02: Pflichtfälle, ausführbare Belege und verbleibende Arbeit

Der [maschinenlesbare Katalog](../../../tools/live-e2e02-scenarios.mjs) verlangt alle
14 Fälle mit derselben Source-/Build-/Fixturebindung sowie sichtbaren und
unabhängigen Speicherassertionen. Ein fehlender, doppelter, nur teilweiser,
übersprungener oder falsch gebundener Fall verhindert technischen Gesamt-PASS.
Der [Reporttest](../../../tests/shared/desktop-e2e02-report.test.mjs) prüft diese
Grenze; der [Fixturetest](../../../tests/campaign/desktop-e2e02-fixture.test.mjs)
prüft Quellenbindung, echtes Initialize, ablehnenden Roster-Guard und Original-ID-Replay.

| Pflichtfall | Aktueller gemeinsamer Nachweis / echte Lücke |
| --- | --- |
| E02-01 Vorbereitung/Katalog | Teilweise: produktiv aufgebaute Fixture, native Auswahl/Anzeige gespeicherter Vorlagen und Referenzen. Das individuelle native Anlegen von Ort, Party, Creature und Item ist noch nicht Bestandteil der Probe. |
| E02-02 immutable Initialize | **Fehlender Produkteingang:** `LiveAction.initialize` in `src/app/runtime/live-contracts.ts` nimmt ausschließlich `expectedRosterRevision`. `src/app/storage/live-commands.ts` erzeugt Scene/Clock/Focus ohne versionierten PreparationSnapshot, PreparationId/Revision oder immutable SourceProvenance. Nachträgliche Visit-Adoption ersetzt diesen Eingang nicht. |
| E02-03 unabhängige Runtime | **Fehlender Produkteingang:** eigene LiveSession-ID und neuer ausdrücklich bestätigter unabhängiger Snapshotstart. Wiederholtes Initialize öffnet dieselbe Runtime; es ist kein zweiter Start. |
| E02-04 Split/Move/Rejoin | Neue gemeinsame native Kette plus unabhängige IDs/Retirement/Fokus-Orakel; `tests/runtime/desktop-mask-integration.test.mjs` bleibt ergänzender Fachtest zu mehreren Masken und fehlgeschlagener Reconciliation. |
| E02-05 Focus fail-closed | Nur active/echter Splitfokus gemeinsam geprüft. None, pending, unavailable, missing, invalid, foreign, stale, inactive/retired und damaged benötigen unabhängige negative Fixtures und sichtbare Consumerassertionen. Kein Gesamt-PASS dieser Matrix. |
| E02-06 DMG-2014 und Teilnehmer | Gemeinsame native Gruppe/Individuum-Kette samt gepinntem Goldenorakel. |
| E02-07 Encounter/Chase/Combat | Eigene Chase- und Combat-IDs, sichtbare unterschiedliche Eingänge und derselbe Scene-/Characterbezug in der neuen Kette. |
| E02-08 Kampffortschritt | Initiative, Runde, HP und Zustand gemeinsam bestätigt und nach Restart erhalten. |
| E02-09 Loot/Reward genau einmal | Gemeinsamer Award/Schatz/Ledger plus unverändertes kanonisches Inventar beim Original-CommandId-Replay am Mainhandler. |
| E02-10 frischer Prozess | Zwei normale Starts/Exits; Domainzeilen und vorhandene Receipts unabhängig verglichen. |
| E02-11 ungültige Katalogreferenzen | Noch kein gemeinsamer nativer Fehlerlauf. `tools/atlas-e2e01-countercases.mjs` N06 und `tests/campaign/desktop-e2e01-fixture.test.mjs` bleiben Fachbelege zu Quellenfehlern, ersetzen den Encounter-/Runtime-Gegenfall nicht. |
| E02-12 fehlgeschlagenes Publish | `tools/live-e2e02-countercases.mjs` startet aus eigener byte-identischer Seedkopie. Ein vor Start injizierter SQLite-Trigger lehnt den Clock-Write nach erfolgter Scene-Insertion in derselben Transaktion ab. Der echte native Initialize scheitert sichtbar; vollständiges inventarisiertes Vorher/Nachher einschließlich Campaign, Preparation und Receipts bleibt identisch. Native Statusklärung bestätigt `not-applied`. Der Fixture-Roster-Guard bleibt ein davon getrennter Validatefall. |
| E02-13 Antwortverlust/Retry | Zweite eigene Seedkopie: der echte Mainhandler committet Initialize, danach wird nur seine Antwort verloren. UI bleibt sichtbar ungeklärt. Dieselbe originale CommandId wird am echten Mainhandler wiederholt: identische Antwort, keine zusätzliche Zeile/Revision/Wirkung. Sichtbare native Statusklärung trägt denselben Originalbefehl und liefert exakt das unabhängig gelesene Receipt (`applied`). `tools/test-desktop-catalog-combat.mjs` bleibt ein zusätzlicher separater Schadensfall. |
| E02-14 durchgehender Trace | Jeder beobachtete Mainbefehl der gemeinsamen positiven Kette korreliert mit genau einem unabhängig gelesenen Receipt; Command-/Scene-/Participant-/Award-/Ledgeridentitäten in Rohsnapshots und Replaydatei. Offene Fehlerfälle sind keine behaupteten Trace-Erfolge. |

Die beiden neuen Fehlerversuche starten jeweils aus einer **eigenen byte-identischen
Kopie desselben eingefrorenen Seeds** in einem eigenen Profil und Prozess.
`publish-failure/result.json` und `reply-loss/result.json` binden Ausgangshash,
injizierten Datenbankhash, Faultdefinition, tatsächliche Befehle und Statusantworten
sowie vollständige Vorher-/Nachherzeilen; eigene Aufnahmen zeigen unbestätigten
und geklärten Zustand. Nur der Prüfaufbau installiert vor dem nativen Start den
Fehlertrigger, die Produkttransaktion besitzt weiterhin sämtliche Datenwrites.

Auch die noch nachzuholenden Fehlerfälle müssen ihr Vorherinventar einfrieren und nach
Fehler/Klärung vollständige Daten-/Receiptgleichheit beziehungsweise genau eine
bestätigte Wirkung prüfen. Der Hauptlauf darf nicht durch ad-hoc-Reparaturen
einer vorherigen Fehlervariante vorbereitet werden.

## E2E-03: konkrete Teilbelege und gemeinsamer fehlender Lauf

Die folgenden Dateien sind ausführbare vorhandene Fachproben, keine in Runde 9
neu ausgeführten PASSe. Historische Erfolge behalten die Source-/Hostgrenzen aus
dem [End-to-end-Dokument](../../project/verification/end-to-end.md#wiederverwendete-fachbelege).
E2E-03 ist entsprechend der Lieferreihenfolge noch kein neuer Abschluss.

| Pflicht | Ausführbare Teilbelege | Gemeinsame Restprüfung |
| --- | --- | --- |
| Reise Preview/Cancel/Confirm, Unterbrechung, Resume, Undo/Redo, Fresh | `tools/test-desktop-travel-checkpoints.mjs`, `tests/runtime/desktop-travel.test.mjs` | Dieselbe E2E-02-Campaign fortführen und alle Verbraucher vor/nach jedem Checkpoint vergleichen. |
| Kalender/Clock und Ereignisbindung | `tests/runtime/desktop-restock-journey.test.mjs` (Kalenderrevision, mehrere Clocks, Wiederholung) | Ein gemeinsamer Kalendertermin mit tatsächlicher Reise und nativer sichtbarer Folge. |
| Shoprestock genau einmal | `tests/runtime/desktop-restock-journey.test.mjs` (Retry, Restart, unabhängige Kopie, Undo, später Segmentfehler) | Derselbe Stock-/Ereignis-/Receiptbestand in der gemeinsamen nativen Reise. |
| Wetter und manuelle Priorität | `tools/test-desktop-weather-override.mjs`, `tests/runtime/desktop-weather-integrity.test.mjs` | ManualDecision-ID/Revision/Ende im gemeinsamen Fixture pinnen; Source-/Targetwechsel und Consumergrenzen prüfen. |
| Lokale Musik/Ambience mit Bytehash | `tools/test-desktop-scene-music-navigation.mjs` erzeugt reale WAV-Dateien | Beide AudioSourceIds und Metadaten pinnen; eigene fehlende und beschädigte Varianten in unabhängigen Kopien. |
| Kein verspätetes Audio nach Cancel/Retirement/Providerfehler | `tools/test-desktop-music-stop.mjs`, `tests/runtime/desktop-audio-layer-recovery.test.mjs` | Echte Audiodateien, Journeycancel und Scene-Retirement im selben Lauf, kein Overrideübertrag. Modellprovider allein qualifiziert kein natives Audio. |
| Offline/Crash/Retry, komplette Zeit-/Ortskonsistenz | Native Reiseprobe und Restock-/Weather-Fachtests sind Teilbelege | Bestätigtes Autosave-Crashprotokoll aus `native-session.mjs`, eigener neuer Prozess und derselbe Command-/Receipttrace über alle Verbraucher. |

## E2E-04: eigene Recoverywege und offene Hostqualifikation

| Pflicht | Ausführbarer Teilbeleg | Offene gemeinsame Qualifikation |
| --- | --- | --- |
| CompleteExport und unabhängigerImport | `tools/test-desktop-e2e01.mjs`, `tools/atlas-e2e01-fixture.mjs` | Den fortgeschriebenen Spielzustand samt Award/Ledger/Chase/Combat vollständig exportieren; unabhängige Remap-Closure vor Import einfrieren. |
| BackupRestore mit ID-Erhalt | `tests/shared/desktop-backup-worker.test.mjs`, `tests/campaign/desktop-key-discovery.test.mjs` | Eigener nativer Backup-/Restoreweg auf demselben Spielzustand; keine Gleichsetzung mit Import/Copy. |
| ausdrücklich gewähltes Salvage | `tests/campaign/desktop-archive-transfer.test.mjs`, `tests/campaign/desktop-archive-error.test.mjs` sind Archiv-/Fehlerteilbelege | Eigener sichtbarer Salvageauftrag mit Identität und Auswirkung jeder Auslassung; unvollständige Medien müssen Complete blockieren. |
| Discovery, Charges und Countdown | `tests/campaign/desktop-key-discovery.test.mjs` deckt Discovery/unerlaubte Identitäten/Backup ab | Charges und Countdown in dieselbe Spielfixture aufnehmen, kausale Fortschreibung und jeden Recoveryweg vergleichen. Der E2E-02-Seed deckt sie noch nicht ab. |
| Medien, Referenzclosure, Trash und unknown-retained | E2E-01-Transferinventar und Archive-Fachtests | Vollständige fortgeschriebene Closure einschließlich dieser zusätzlichen Bestände vor/nach jedem Recoveryweg; kein PASS allein aus einem Manifest. |
| echtes passives Spielerfenster und Geheimnisse | `tools/test-desktop-player-scene-privacy.mjs`, `tools/test-desktop-player-blank.mjs`, `tools/test-desktop-player-focus.mjs` | Das tatsächliche separate Fenster während desselben Spielabends prüfen: DOM, Pixel, Accessibility, Speicher, Logs, Netz; keine internen Scenequellen oder GM-/Knowledge-/Fog-/Camera-/Assetlecks. |
| Tastatur, kleines Fenster, 100 % | Vorhandene native Fachproben, `tools/test-desktop-style-ownership.mjs` | Durchgehende konkrete Aufgaben per Tastatur und im kleinen Fenster. Die neue 1400er E2E-02-Probe ist dafür kein Beleg. |
| unabhängiger Host und Zielplattformen | Kein neuer Nachweis | Zweites Profil auf demselben Linuxhost ist **kein** unabhängiger Host; Windows/macOS, Paket/Installation, physische Eingabe, Accessibility und Owner bleiben offen. |

## Reproduktion und lokale Artefakte

Mit Node 22 und npm, vorbereitetem `build:desktop` desselben HEAD:

```sh
node tools/run-local-check.mjs npm run build:desktop
node tools/run-local-check.mjs node build.mjs --test
node tools/run-local-check.mjs node --test tests/shared/desktop-e2e02-report.test.mjs tests/campaign/desktop-e2e02-fixture.test.mjs
node tools/run-local-check.mjs node tools/test-desktop-e2e02.mjs --software-gpu
```

`--software-gpu` benennt den tatsächlichen ANGLE/SwiftShaderlauf; er ist keine
Zielgerätequalifikation. Ohne Option wird der normale native Backendweg benutzt.
Immer 100 Prozent Appzoom. Die Probe verwirft alte Erfolgsdateien vor dem Setup;
Build-SHA muss HEAD entsprechen, Runtimehashes dürfen sich während des Laufs
nicht ändern, jeder neue Prozess besitzt denselben exklusiven Testprofilpfad.
Fehler erzeugen `failure.json` samt aktueller Aufnahme. Ein erfolgreicher
Teildurchlauf erzeugt `result.json` mit `workflowSubset: passed`, `complete: false`
und `qualification.technicalGate: open`.

Lokaler Standardpfad ist `.build/e2e02-native/` mit `result.json`,
`fixture.json`, `snapshots.json`, `commands.json`, `receipt-trace.json`,
`reward-replay.json`, `seed.sqlite`, `seed-player-images/`, den unabhängigen
Gegenfällen `publish-failure/` und `reply-loss/` und benannten PNGs. Diese ignorierten Rohartefakte sind
keine portablen Repositorylinks. Die konkrete Laufbindung steht unten;
unverändert vorhandene Einzel-PASSe werden nicht
erneut als heutige gemeinsame E2E-03-/04-Prüfung ausgegeben.

### Tatsächlicher finaler Lauf vom 28./29.10.2026

Der finale lokale Lauf endete am **28.10.2026, 23:00:12 UTC** (29.10., 00:00 Uhr Berlin).
Er bindet Quellbasis `7a3ea5cd07c3fa09e8cbed4dbfdb3f19ecb6c22e`,
**dirty: true**, Buildmetadaten `0.193.1`, Produkt `saltmarcher-workbench`,
Schema 55. Der normale Entwicklungseinstieg meldet über Electron `app.getVersion()`
`0.0`; dies wird nicht als installierte Paketversion ausgegeben. Die ausführenden
Nodebefehle benutzen Node 22.19.0; Electron 44.7.0 enthält Node 24.21.0 und
Chromium 152.0.7977.130. Host: Linux x64, Kernel
`7.2.11-200.fc44.x86_64`, X11, ausdrücklich ANGLE/SwiftShader, 100 Prozent
Appzoom, aufgenommene Frames 1400 × 980. Alle vier tatsächlichen Starts/Exits
beenden regulär mit Code 0 und nachgewiesen abwesenden PIDs; Mainlauf und beide
unabhängigen Gegenfälle tragen ihre eigenen nativen Prozessbelege.

Der SHA allein beschreibt den Dirtylauf nicht. Sechs Probe-/Fixture-/Helferhashes,
zwanzig tatsächliche Runtimehashes, Rezept und gespeicherte Datenbank binden den
ausgeführten Stand. Die Probe vergleicht ihre Quellhashes zusätzlich vor und
nach dem Lauf. Seed-Datenbank-SHA256:
`2f9dc05c8a92c7a8bee2210afae1d0b24cbe6a0a0646644f2107d4248388dd63`.

| Rohbericht | SHA-256 |
| --- | --- |
| `.build/e2e02-native/result.json` | `82342e53f885503aa19cf4e6c077ab88c75876d36df94e5f26b466bdc428de12` |
| `.build/e2e02-native/publish-failure/result.json` | `46f239fc75b4bbe1f63a0f6ca669dde65f89ffc6b6806acbcf56344a3f0afb95` |
| `.build/e2e02-native/reply-loss/result.json` | `19a1484c71e2f20dd87b7808c4c350098a772d5acda865a7c025e6753a1752e6` |

Ergebnis: **neun Pflichtfälle bestanden, E02-01 teilweise, vier offen**
(E02-02, E02-03, E02-05 und E02-11). Deshalb bleibt der technische E2E-02-Gate
ausdrücklich `open`; E2E-03 und E2E-04 sind nicht neu ausgeführt oder abgeschlossen.
Auch Candidate, integrierter Stand dieser Änderungen, Zielgerät,
Paket/Installation und Ownerabnahme werden damit nicht behauptet.

Nach `node build.mjs --test` bestehen beide neuen Report-/Fixturetests
(2/2, keine Skips). `npm run check:repo`, Formatprüfung der sechs neuen
JS-Test-/Hilfsdateien und `git diff --check` bestehen ebenfalls. Für diesen
Test-/Dokumentationsanschluss wurden keine Produkt-TypeScript-Dateien verändert;
der Desktop wurde vor dem nativen Lauf frisch gebaut. Ein neuer vollständiger
Repositorytestlauf wurde nicht ausgeführt. Die tatsächlichen Dateilinks wurden
im bestehenden Capability-Katalog bei den passenden Live-, Katalogreferenz- und
Beuteworkflows mit `--geprueft` ergänzt; die inverse Ansicht wurde gelesen.
