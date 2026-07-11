Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-11
Source of Truth: German owner-facing status notes for the architecture
migration governed by `architecture-migration-roadmap.md` and
`migration-ledger.md`.

# Architecture Migration Owner Status Notes

## Purpose

This file records short German owner-facing status notes for architecture
migration state changes. The active machine-readable state remains in
`docs/project/architecture/migration-ledger.md`.

## Archive

- M0-M2 notes:
  `docs/project/architecture/architecture-migration-owner-status-notes-m0-m2.md`
- Archived early M3 notes:
  `docs/project/architecture/architecture-migration-owner-status-notes-m3-2026-07-09.md`

## Notes

### 2026-07-10 M3.1 sessionplanner-harness-closure

Die Session-Planner-Harness-Pruefung ist geschlossen. Eine unabhaengige
Vorpruefung fand eine echte Luecke: Teile der bisherigen Timeline-, Loot- und
Draft-Oracles waren direkte Model/View-Fixtures statt Produktionsroute. Der
Harness wurde deshalb gegen die alte Struktur erweitert. `sessionPlannerCatalogHarness`
bindet jetzt die echte `SessionPlannerContribution`, feuert gerenderte
Controls fuer Participant add/remove, Saved-Encounter-Attach,
Scene-Save/Select/Move/Allocation/Remove, Rast set/clear, Loot add/remove,
Encounter-Days und Catalog-CRUD, und liest danach die Session-Planner
Published Models zurueck. Stabile Testdaten liegen nur an fremden Encounter
Published-Seams; Party und World Planner werden ueber ihre echten
Application-Services vorbereitet. `compileTestJava`, die beiden
Session-Planner-Harnesses, Harness-Map/Topology, Focused-Handoff und
`git diff --check` sind gruen. Phase 1 und der unabhaengige Judge haben die
Closure freigegeben. Naechster Schritt ist M3.2:
Session-Planner-Baseline-Metriken.

### 2026-07-10 M3.2 sessionplanner-baseline-metrics

Die Session-Planner-Baseline ist in
`docs/project/architecture/architecture-migration-sessionplanner-baseline.md`
festgehalten. Der reproduzierbare Roadmap-Schnitt umfasst 121 Java-Dateien mit
7.831 physischen LOC; die normale M3-Produktstruktur ohne Data-Layer umfasst
103 Dateien mit 6.664 LOC. Die dominanten Timeline-Ketten liegen bei 6 Hops
bis zur ersten `SessionPlan`-Mutation; Create-Session mit Active-Party-Facts
und Scene-Save mit nonzero World-Planner-Location-Validierung erreichen je 7
Hops vor dem Save-/Publication-Tail. 30 Produkt-/Published-Forwarding-
Kandidaten, zwei Data-Kandidaten und drei produktive String-Grenzfamilien sind
konkret belegt. Phase 1 fand zunaechst eine zu enge Forwarding-Zaehlung und
einen fehlenden Active-Party-Facts-Hop; nach Rework sind Dokumentationsgate,
`git diff --check`, `git diff --cached --check`, Phase 1 und der
unabhaengige Judge gruen. Naechster Schritt ist M3.3 mit judge-geprueftem
Session-Planner-Target-Design; es wurde noch keine Wiring- oder
Implementierungsarbeit begonnen.

### 2026-07-10 M3.3 sessionplanner-target-design

Das Session-Planner-Target-Design ist in
`docs/project/architecture/architecture-migration-sessionplanner-target-design.md`
genehmigt. Es legt den Produkt-Schnitt auf 103 Java-Dateien / 6.664 LOC fest
und benennt die Zielstruktur konkret: ein Root-`SessionPlannerApplicationService`,
eine echte `SessionPlannerServiceAssembly`, neue `SessionPlannerPublishedState`-,
`SessionPlannerProjection`-, `SessionPlannerForeignFacts`-, `SessionPlannerViewModel`-
und `SessionPlannerVocabulary`-Klassen sowie stateful Published Models auf Basis
des gemeinsamen `PublishedState`-Helpers. Die Deletionsliste umfasst 57
konkrete Dateien; darunter die Split-ApplicationServices, die Usecase-/Port-/
Repository-Zeremonie, die Projection-/Readback-Assemblies sowie die alten
View-ContentModels, InputEvents und der IntentHandler. Phase 1 und der
unabhaengige Judge haben das Design freigegeben. Akzeptierte Ausnahmen sind nur
die Data-Layer-Zaehlausnahme, die Registry-Kompositionsseams, fremde
Party/Encounter/World-Planner-Readbacks und die Shared-Catalog-String-ID-Seam.
Kein Produkt-LOC-Miss ist vorab akzeptiert. Naechster Schritt ist M3.4:
separater Wiring-Port auf `SessionPlannerViewModel`/Callback-Grenze, ohne
Szenario-, Assertion-, Text- oder Orakel-Aenderung.

### 2026-07-10 M3.4 sessionplanner-wiring-port

Der Session-Planner-Wiring-Port ist abgeschlossen. `SessionPlannerViewModel`
ist jetzt die Kompatibilitaetsfassade ueber den bestehenden Content- und
Contribution-Modellen; Binder, Controls-, Timeline- und State-Views sowie der
`SessionPlannerIntentHandler` laufen ueber diese VM-/Callback-Grenze. Die
direkten Zusatzpruefungen im `sessionPlannerCatalogHarness` nutzen ebenfalls
die VM-Grenze, waehrend Szenarien, Assertions, Fixture-Werte und sichtbare
Texte unveraendert bleiben. Die alten ContentModels, InputEvents, der
IntentHandler, Split-ApplicationServices, Usecases, Ports und
Projection-/Readback-Assemblies bleiben absichtlich bis M3.5 erhalten. Ein
zwischenzeitlicher CPD-Fund durch doppelte Scene-Projection-Struktur wurde
durch echte Konsolidierung geloest: Die VM delegiert auf die bestehende
Timeline-Projection statt den Block umzuschreiben. Der retained
Selected-Proof, `production-handoff`, CPD, Phase 1 nach Re-Proof und der
unabhaengige Judge sind gruen. Naechster Schritt ist M3.5: Umsetzung des
genehmigten Target-Designs inklusive 57-Datei-Loeschliste, gemeinsamem
`PublishedState`-Reuse und finalem Parity-/Metric-Proof.

### 2026-07-10 M3.5 sessionplanner-implementation

Die Session-Planner-Implementierung ist abgeschlossen. Das LOC-Amendment
`cc5c78478` begrenzt die akzeptierte Ausnahme auf 51 Java-Dateien / 5.170 LOC
unter einer 5.200-LOC-Grenze; die Begruendung liegt nicht in Check-Kosmetik,
sondern in erhaltenen behavior-tragenden und byte-kompatiblen Seams. Der
Implementierungscommit `e289234cb` fuehrt die 57-Datei-Loeschliste aus: die
Split-ApplicationServices, Usecases, Ports, Publication-/Readback-Assemblies,
alten ContentModels, InputEvents und der `SessionPlannerIntentHandler` sind
weg. Der Root-`SessionPlannerApplicationService`, `SessionPlannerForeignFacts`,
`SessionPlannerProjection`, `SessionPlannerPublishedState` und direkte
VM-/Binder-Callbacks tragen die genehmigte Zielstruktur. Die CPD-relevante
Published-State-Mechanik ist echte gemeinsame Nutzung von `PublishedState`,
nicht umformulierter Duplikatcode. `compileJava compileTestJava`, der retained
Selected-Proof mit Dead-Code/PMD/CPD und den beiden Session-Planner-Harnesses,
`production-handoff` und das Dokumentationsgate sind gruen. Phase 1 und der
unabhaengige Judge haben die Umsetzung nach Doku-/Proof-Nachkorrektur
freigegeben. Naechster Schritt ist M3.6: Conformance Review mit finalem
Design-, Parity-, Seam- und Metric-Nachweis.

### 2026-07-10 M3.6 sessionplanner-conformance-review

Die Session-Planner-Conformance-Review ist abgeschlossen. Phase 2 fand
zunaechst zwei echte Close-out-Blocker: `SessionPlannerCatalogModel` fehlte in
zwei Owner-Dokumenten als fuenftes exportiertes Read-Model, und fuer den
nachtraeglichen LOC-Amendment-Split fehlte ein retained Dokumentationsgate.
Beides ist geschlossen: Feature-Architektur und Domain-Vertrag nennen jetzt
alle fuenf Published Models, und
`build/gradle-run-logs/20260710T134620516069849-pid343632-checkDocumentationEnforcement.log`
ist gruen. Phase 1 und der unabhaengige Judge bestaetigen danach: die
57-Datei-Loeschliste ist ausgefuehrt, geloeschte Split-/Content-/Input-/
Intent-Klassen haben keine Referenzen mehr, die fuenf Published-Seams bleiben
byte-kompatibel, Rest-Kind laeuft typed statt ueber `.name()`-Stringrouten,
und die gemeinsame `PublishedState`-Nutzung ist echte Duplikatsentfernung
statt Check-Gaming. Die 51-Dateien-/5.170-LOC-Ausnahme ist unter der
5.200-LOC-Grenze akzeptiert. Naechster Schritt ist M3.7:
Session-Planner-Close-out mit Owner-Smoke-Checklist-Referenz und
Ledger-Uebergang zu `encountertable`.

### 2026-07-10 M3.7 sessionplanner-close-out

Der Session-Planner-Bereich ist abgeschlossen. Referenzcommit fuer den
migrierten Session-Planner-Zielzustand ist `e289234cb`; der Close-out verweist
auf die Owner-Smoke-Checklist in
`docs/project/architecture/architecture-migration-owner-smoke-checklists.md`.
Das finale Proof-Set ist gruen: `compileJava compileTestJava`, Dead-Code/PMD/
CPD mit `sessionPlannerCatalogHarness` und `sessionPlannerShellLayoutHarness`,
Dokumentationsgate, `production-handoff`, `git diff --check` und die Phase-1-/
Phase-2-Re-Reviews. Die akzeptierte 51-Dateien-/5.170-LOC-Ausnahme bleibt
unter der 5.200-LOC-Grenze und ist im Amendment dokumentiert. Auffaelligkeiten
aus dem Owner-Smoke laufen wie im Roadmap-Protokoll als normale R2-Anomalien
oder, bei schwerer Drift, ueber den Revert-Pfad. Naechster M3-Bereich ist
`encountertable` mit Harness-Check/Closure gegen die alte Struktur.

### 2026-07-10 M3.1 encountertable-harness-closure

Der Encounter-Table-Harness-Gap ist geschlossen. Der neue
`encounterTableReadbackHarness` laeuft gegen die alte Struktur: Er seedet
autorisierte Encounter-Table- und Creature-Zeilen in einem isolierten SQLite-
`XDG_DATA_HOME`, registriert die echte Data- und Domain-
`EncounterTableServiceContribution`, treibt `EncounterTableApplicationService`
und liest danach `EncounterTableCatalogModel` und `EncounterTableCandidatesModel`
zurueck. Die eingefrorenen Proof-Items decken authored summary lookup,
weighted candidate lookup, leere Auswahl, XP-Ceiling inklusive `maximumXp <= 0`
und Storage-Error-Publication ab. Harness-Topology, Harness-Map, Focused-
Handoff fuer `src/domain/encountertable`, Dokumentationsgate, Phase 1 nach
Ledger-Wording-Rework und Phase 2 sind gruen. Naechster Schritt ist M3.2:
Encounter-Table-Baseline-Metriken vor dem Target-Design.

### 2026-07-10 M3.2 encountertable-baseline-metrics

Die Encounter-Table-Baseline ist in
`docs/project/architecture/architecture-migration-encountertable-baseline.md`
festgehalten. Der voll reproduzierbare Java-Schnitt umfasst 28 Dateien mit
954 physischen LOC; die normale M3-Produktstruktur ohne Data-Layer umfasst
18 Dateien mit 558 LOC. Der Bereich ist ein read-only Referenzkatalog ohne
eigene Table-Entry-Mutation; deshalb misst die Baseline Publication- und
Readback-Ketten. Die dominanten Encounter-Table-Ketten liegen bei 5 Hops bis
zur ersten Published-State-Ersetzung und bei 7 Hops inklusive fremdem
Catalog-, Worldplanner- oder Encounter-Readback. Vier Produkt-/Published-
Forwarding-Kandidaten, zwei Data-Kandidaten und eine produktive
String-Grenzfamilie sind konkret belegt. Dokumentationsgate, `git diff
--check`, Phase 1 und der unabhaengige Judge sind gruen. Naechster Schritt ist
M3.3 mit judge-geprueftem Encounter-Table-Target-Design; es wurde noch keine
Wiring- oder Implementierungsarbeit begonnen.

### 2026-07-10 M3.3 encountertable-target-design

Das Encounter-Table-Target-Design ist in
`docs/project/architecture/architecture-migration-encountertable-target-design.md`
genehmigt. Es legt die Zielstruktur konkret fest: `EncounterTableApplicationService`
uebernimmt Lookup, Storage-Error-Fallback, Null-Command-Verhalten,
XP-Ceiling-Normalisierung und Publication direkt; `EncounterTableServiceAssembly`
bleibt nur Composition Root; `EncounterTableCatalogProjection` mappt Lookup-
Daten in byte-kompatible Published Records; `EncounterTableCatalogModel` und
`EncounterTableCandidatesModel` werden stateful ueber den gemeinsamen
`PublishedState`-Helper. Die Loeschliste umfasst die zwei Usecases und das
interne String-Status-Repository. Published Records, Commands, Data-Port,
Data-Layer, Catalog, Worldplanner, Encounter und Harness-Orakel bleiben
kompatibel. Dokumentationsgate, `git diff --check`, Phase 1 und der
unabhaengige Judge sind gruen. Naechster Schritt ist M3.4 als erwarteter
No-code-Wiring-Port-Nachweis; es wurde noch keine Implementierung begonnen.

### 2026-07-10 M3.4 encountertable-wiring-port

Der Encounter-Table-Wiring-Port ist als No-code-Schritt abgeschlossen.
`encounterTableReadbackHarness` verwendet bereits die erhaltenen Data- und
Domain-`EncounterTableServiceContribution`-Seams, `EncounterTableApplicationService`,
`EncounterTableCatalogModel`, `EncounterTableCandidatesModel`, Commands,
Records und Statuswerte. Der Harness und die geprueften aktuellen Consumer
enthalten keine Referenzen auf die genehmigte 3-Datei-Loeschliste aus
Usecases und internem Published-State-Repository. Die eingefrorenen Szenarien
und Assertions wurden nicht geaendert. `encounterTableReadbackHarness`,
Harness-Map/Topology und der Focused-Handoff fuer `src/domain/encountertable`
sind gruen. Naechster Schritt ist M3.5: Umsetzung des genehmigten
Encounter-Table-Target-Designs mit vollstaendiger Loeschliste,
byte-kompatiblen Seams und unveraendertem Harness-Orakel.

### 2026-07-10 M3.5 encountertable-implementation

Die Encounter-Table-Implementierung ist auf dem Branch abgeschlossen.
Commit `be5b77c8a` setzt das genehmigte Target-Design um: die beiden Usecases
und das interne String-Status-Repository sind geloescht, der
`EncounterTableApplicationService` veroeffentlicht direkt ueber die bestehenden
Catalog- und Candidates-Modelle, und `EncounterTableCatalogProjection` bildet
die Lookup-Daten in die byte-kompatiblen Published Records ab. Die Published
Models nutzen den gemeinsamen `PublishedState`-Helper; das ist eine echte
strukturelle Entdopplung und keine Umformulierung, um CPD zu umgehen.
Die eingefrorenen Harness-Szenarien und Assertions wurden nicht geaendert.
Der selektive Static/Harness-Proof inklusive CPD, PMD, Dead-Code-Check und
`encounterTableReadbackHarness` ist gruen, der Production-Handoff ist gruen,
und Phase 1 sowie der unabhaengige Judge haben die Umsetzung freigegeben.
Die gepruefte Ausnahme fuer 16 Dateien / 433 LOC bleibt unter der
Design-Obergrenze von 460 LOC und ist durch byte-kompatible Records,
Data-Carrier, Registry-Seams und Compatibility-Konstruktoren begruendet.
Naechster Schritt ist M3.6: Conformance Review gegen den committeten Stand.

### 2026-07-10 M3.6 encountertable-conformance-review

Der Encounter-Table-Conformance-Review ist gruen. Phase 1 und der
unabhaengige Judge haben den committeten Implementierungsstand `be5b77c8a`
gegen das genehmigte Target-Design, die eingefrorenen Harness-Orakel, die
Loeschliste und die Metrikziele geprueft. Die drei Altdateien fuer
Usecases und internes Published-State-Repository sind entfernt, es gibt keine
stalen Source- oder Test-Referenzen darauf, und interne Statuswerte laufen
nicht mehr als Strings durch das Product-Code-Protokoll. Die
`PublishedState`-Nutzung wurde als echte strukturelle Entdopplung bestaetigt,
nicht als CPD-Umformulierung. Der akzeptierte Stand hat 16 Java-Dateien und
433 LOC; die Ausnahme liegt unter der Design-Grenze von 460 LOC und ist
durch byte-kompatible Published Records, Data-Carrier, Registry-Seams und
Compatibility-Konstruktoren begruendet. Der selektive Static/Harness-Proof,
der Production-Handoff und der saubere Dokumentationsnachweis fuer den
committeten Stand sind gruen. Naechster Schritt ist M3.7 Close-out.

### 2026-07-10 M3.7 encountertable-close-out

Der Encounter-Table-Zyklus ist auf dem Branch abgeschlossen. Der finale
Stand haelt die eingefrorenen `encounterTableReadbackHarness`-Szenarien fuer
Summary-Lookup, gewichtete Kandidaten, leere Auswahl, XP-Grenze und
Storage-Error-Publication gruen. Die finale Proof-Kette umfasst den
selektiven Static/Harness-Run mit CPD, PMD, Dead-Code-Check,
Harness-Map/Topology und 5 Harness-Proof-Items, den gruenen
Production-Handoff, den sauberen Dokumentationsnachweis fuer den committeten
Docs-Stand, `git diff --check` sowie Phase-1- und Phase-2-Freigaben. Die
16-Datei-/433-LOC-Ausnahme bleibt akzeptiert und begruendet; die
`PublishedState`-Entdopplung ist strukturell und die alte Usecase/
Repository-Schicht ist geloescht. Der Owner-Smoke-Checklist-Eintrag steht in
`docs/project/architecture/architecture-migration-owner-smoke-checklists.md`.
Naechster Bereich ist `encounter`, beginnend mit M3.1 Harness
Check/Closure fuer die verbleibende State-Tab-Produktionsroute.

### 2026-07-10 M3.1 encounter-harness-check-closure

Der Encounter-Harness-Check ist abgeschlossen. Commit `1fae38dda` ersetzt im
`encounterStateTabHarness` den harness-eigenen `MutableEncounterStateFeed` und
die No-op-Services durch die alte Produktionsroute: isolierte Party- und
Encounter-Persistenz, reales `EncounterApplicationService.applyState` fuer das
Oeffnen eines gespeicherten Plans und Readback ueber das veroeffentlichte
`EncounterStateModel` in der echten State-Tab-Bindung. Die
`100 XP`-Assertion ist die alte Produktionsprojektion fuer zwei Goblins mit je
50 XP und keine Orakelabschwaechung. Static/Harness-Proof, der gemappte
Encounter-Harnesssatz mit `worldPlannerEncounterHarness`, Production-Handoff,
Phase 1 und unabhaengiger Judge sind gruen. Die P1-Gap-Zeile ist aus
`docs/project/verification/harness-gaps.md` entfernt. Naechster Schritt ist
M3.2: Encounter-Baseline-Metriken.

### 2026-07-10 M3.2 encounter-baseline-metrics

Die Encounter-Baseline ist in Commit `203e46438` dokumentiert. Das
Artefakt `docs/project/architecture/architecture-migration-encounter-baseline.md`
trennt den breiten `*encounter*`-Suchraum sauber vom bereits migrierten
Encounter-Table-Bereich und misst fuer Encounter 202 Java-Dateien mit
13.216 physischen LOC; der normale Produktzuschnitt fuer das Design sind
191 Dateien mit 12.737 LOC. Die dominanten Generate- und Saved-Plan-Ketten
liegen bei 13 Hops bis zur ersten Encounter-Publication, Combat bei 8 Hops
und Plan-Budget-Refresh bei 6 Hops. Nach Phase-1-Rework zaehlt die Baseline
10 Produkt-/Published-Forwarding-Kandidaten plus 2 Data-Kandidaten und
3 Produkt-String-Boundary-Familien; enthalten sind dabei die aktive
State-Tab-Mode-Bruecke und `EncounterPublishedStateServiceAssembly`. Der
Dokumentations-Gate, Phase 1 und der unabhaengige Judge sind gruen. Naechster
Schritt ist M3.3: ein konkretes, judge-geprueftes Encounter-Target-Design;
es wurde noch keine Produktionsverdrahtung oder Implementierung gestartet.

### 2026-07-10 M3.3 encounter-target-design

Das Encounter-Target-Design ist in Commit `1563da9b3` genehmigt. Es legt die
Zielstruktur konkret fest: `EncounterApplicationService` wird die Root-
Service-Grenze fuer Command-Normalisierung, Session-Mutation und Publication;
`EncounterSessionRuntimeAccess`, `EncounterForeignFacts`, `EncounterPlanGateway`,
`EncounterProjection`, `EncounterPublishedState` und `EncounterGenerator`
ersetzen die alte Usecase-/Repository-/Assembly-Kette; im State-Tab fuehren
`EncounterStateViewModel` und `EncounterStateVocabulary` die heutige
ContentModel-/InputEvent-/IntentHandler-Schicht zusammen. Die byte-kompatiblen
Published-Seams, `EncounterPlanRepository`, State-Tab-Contribution,
State-Tab-Views, Party/Creature/Encounter-Table/Worldplanner/Session-Planner-
Konsumenten und alle eingefrorenen Harness-Szenarien bleiben geschuetzt. Das
Design nennt eine 61-Datei-Loeschliste, Zielketten, String-Boundary-Ziele,
ein 140-Dateien-Ziel und eine maximal judge-pflichtige LOC-Ausnahme bis
9.500 LOC, falls die 7.642-LOC-Roadmap-Zielmarke wegen Published Records,
JavaFX-Views, Session-Aggregat und Generation-Logik nicht erreichbar ist.
Dokumentations-Gate, Phase 1 und unabhaengiger Judge sind gruen. Naechster
Schritt ist M3.4: nur Harness-/Wiring-Port, besonders der Session-Planner-
Harness-Fake-Encounter-Seam und die State-Tab-ViewModel-Grenze; es wurde noch
keine Produktionsimplementierung der Loeschliste gestartet.

### 2026-07-10 M3.4 encounter-harness-wiring-port

Der Encounter-Wiring-Port ist in Commit `a6a63cc2e` abgeschlossen.
`EncounterStateViewModel` ist eine reine Kompatibilitaets-Fassade ueber die
bisherigen State-Tab-Content-Modelle und den `EncounterStateIntentHandler`;
`EncounterStateBinder` fuehrt Subscriptions und View-Callbacks jetzt durch
diese Grenze. Der `SessionPlannerCatalogHarness` importiert die genehmigten
Loeschlisten-Kandidaten aus Encounter-Usecases und Published-State-
Repository-Interfaces nicht mehr, sondern verwendet einen test-only Fake an
der erhaltenen `EncounterApplicationService`-Command-Seam. Die Harness-
Szenarien, Fixture-Werte, Proof-Labels, Assertions und sichtbaren Texte sind
unveraendert. Der selektive Static/Harness-Proof inklusive Dead-Code-Check,
PMD, CPD, `encounterStateTabHarness`, `worldPlannerEncounterHarness`,
`sessionPlannerCatalogHarness` und Harness-Topologie ist gruen; der
Production-Handoff ist gruen; Phase 1 und der unabhaengige Judge haben den
Wiring-Port freigegeben. Es wurde kein CPD-Treffer durch Umformulierung
umgangen und keine Produktions-Loeschliste vorgezogen. Naechster Schritt ist
M3.5: Umsetzung des genehmigten Encounter-Target-Designs mit vollstaendiger
Loeschliste, byte-kompatiblen Seams und eingefrorenen Harness-Orakeln.

### 2026-07-10 M3.7 encounter-close-out

Der Encounter-Zyklus ist abgeschlossen. Referenzstand ist `7ec1f25e3`; die
61-Datei-Loeschliste ist ausgefuehrt, `PublishedState` wird strukturell geteilt, und `CombatantId` laeuft intern typed statt als umformulierter String-Check. Der retained Static/Harness-Proof, `production-handoff`, Phase 1 und Phase 2 sind gruen; die Metrik liegt bei 140 Dateien / 11.340 LOC unter der genehmigten 11.400-Grenze. Der Owner-Smoke steht in `docs/project/architecture/architecture-migration-owner-smoke-checklists.md`. Naechster Schritt ist M4.1 `dungeon-authored-core` Harness Check/Closure.

### 2026-07-10 M4.1 dungeon-authored-wiring-port

Der Dungeon-Authored-Core-Wiring-Port ist in Commit `bfa974809`
abgeschlossen. `DungeonAuthoredApplicationService`, `DungeonAuthoredPublication`
und `DungeonAuthoredPublishedState` bilden jetzt die Kompatibilitaetsgrenze;
Feature-Runtime, Shell-Binding, Travel/Readback-Helfer und die direkten
Invariant-Harnesses laufen ueber diese neue Grenze. Die eingefrorenen
Harness-Szenarien, Proof-Labels, sichtbaren Texte, Fixtures und Assertions
bleiben unveraendert. Alte Usecase-Dateien bleiben fuer M4.1 Step 5 erhalten;
nur die nicht-Usecase Legacy-State-Assembly wurde entfernt, weil der neue
State-Owner sie strukturell ersetzt. Static-Proof, CPD, Dead-Code, alle
retained Dungeon-Harness-Gruppen, Render-Parity, focused handoff, Phase 1 und
der unabhaengige Judge sind gruen. Naechster Schritt ist M4.1 Implementation:
die genehmigte Loeschliste ausfuehren und die Facade intern von den alten
Wrappern auf direkte authored-core Service-Logik umstellen.

### 2026-07-10 M4.1 dungeon-authored-core-close-out

Der Dungeon-Authored-Core-Zyklus ist abgeschlossen. Referenzstand ist
`bdb15a2fc`; die Design-Amendment wurde vorher in `f6f5e3b95` festgehalten.
Die 50-Datei-Loeschliste ist ausgefuehrt, `model/core/usecase` ist leer/gone,
und alte Runtime-Wrapper sowie die authored Inspector-Projektionshelfer sind
ohne Stale-References aus `src` und `test` entfernt. Die neue
`DungeonAuthoredApplicationService`-Grenze traegt Katalog-, Lade-, Preview-,
Mutation- und Publication-Verhalten direkt; Published-Seams bleiben
byte-kompatibel. Die Treppenform-/Richtungs-Strings werden an der
Application-Service-Kante normalisiert und erst danach als typed Core-Specs
weitergegeben. Static-Proof, eingefrorene Dungeon-Harness-Gruppen,
Render-Parity, focused handoff, Phase 1 und der unabhaengige Judge sind gruen.
Die akzeptierte Metrik liegt bei 202 Core-Dateien / 18.260 LOC und 279
design-sichtbaren Dateien. Der Owner-Smoke steht in
`docs/project/architecture/architecture-migration-owner-smoke-checklists.md`
unter `dungeon-authored-core`. Naechster Schritt ist M4.2
`dungeon-editor-session-runtime` Harness Check/Closure.

### 2026-07-11 M4.2 dungeon-editor-session-runtime-close-out

Der Dungeon-Editor-Session-Runtime-Zyklus ist abgeschlossen. Referenzstand ist
`30f822765`; die 37-Datei-Loeschliste ist ausgefuehrt und die verschachtelte
`DungeonAuthoredApplicationService.RuntimeCommands`-Bruecke ist entfernt.
`DungeonEditorRuntimeApplicationService`, `DungeonEditorRuntimeCommands`,
`DungeonEditorRuntimeContext` und `DungeonEditorPointerWorkflow` tragen die
Runtime-Befehle jetzt direkt, ohne neue Forwarding-/Proxy-Schicht. Die
Editor-Publication laeuft ueber `DungeonEditorPublishedState` und die geteilte
`PublishedState.retainingDuplicateSubscribers`-Hilfe; der CPD-Treffer wurde
damit strukturell beseitigt, nicht durch Umformulierung. Static-Proof,
Architecture-Proof, Focused-Handoff, eingefrorene Dungeon-Harness-Gruppen,
Production-Handoff, Phase 1 und der unabhaengige Judge sind gruen. Die Metrik
liegt bei 175 Primaerdateien / 19.236 LOC und 234 design-sichtbaren Dateien /
24.712 LOC, also unter den genehmigten Grenzen. Der Owner-Smoke steht in
`docs/project/architecture/architecture-migration-owner-smoke-checklists.md`
unter `dungeon-editor-session-runtime`. Naechster Schritt ist M4.3
`dungeon-travel` Harness Check/Closure.

### 2026-07-11 M4.3 dungeon-travel-close-out

Der Dungeon-Travel-Zyklus ist abgeschlossen. Finaler Referenzstand ist
`540706edd`; die 20-Datei-Loeschliste ist ausgefuehrt, der alte
`ApplyTravelDungeonSessionCommand`-Pfad ist weg, und geloeschte Travel-
Usecases, Repositories und Service-Assemblies haben keine Stale-References in
`src` oder `test`. `DungeonTravelRuntimeApplicationService`,
`DungeonTravelSurfaceLoader`, `DungeonTravelNavigator`,
`DungeonTravelPartyGateway`, `DungeonTravelPublishedState` und
`DungeonTravelPublishedProjection` tragen die direkte Zielstruktur.
Overlay-Modus, Heading und Action-Kind laufen intern typed; String-Konvertierung
bleibt nur an der Service-/Published-Seam. Der CPD-/Design-Duplikatfund in der
Travel-Map-Publication wurde strukturell geschlossen, indem der neue
Travel-spezifische Projection-Helper geloescht und die Map-Publication direkt
in `DungeonTravelPublishedProjection` uebernommen wurde, nicht durch
Umformulierung. Compile, Static inklusive CPD, Architecture-Proof,
eingefrorene Travel/Core/Render-Harnesses, Focused-Handoff,
Production-Handoff, Phase 1 und der unabhaengige Judge sind gruen. Die Metrik
liegt bei 27 Primaerdateien / 2.371 LOC und 54 Produkt-Route-Dateien / 4.902
LOC, also unter den genehmigten Grenzen. Der Owner-Smoke steht in
`docs/project/architecture/architecture-migration-owner-smoke-checklists.md`
unter `dungeon-travel`. Naechster Schritt ist M4.4
`dungeon-rendering-pipeline` Harness Check/Closure.

### 2026-07-11 M4.4 dungeon-rendering-pipeline-harness-closure

Die Harness-Pruefung fuer die Dungeon-Rendering-Pipeline ist geschlossen. Die
alte Render-Struktur bleibt noch unveraendert; geprueft wurde nur, ob die
sichtbaren Render-Routen vor Baseline und Design ausreichend eingefroren sind.
Die retained Harness-Batches sind gruen: Core 72, Editor-Aggregate 206,
Route 187, Door 58, Wall 33, Room 64, Cluster 84, Corridor 68, Stair 63,
Transition 62, Feature 59, Travel 5 sowie Render-Parity 3 mit `DE-IMG-001`,
`DE-IMG-002` und `DT-IMG-001`. Harness-Topology, Harness-Map und der
Focused-Handoff fuer `src/view/slotcontent/main/dungeonmap` sind ebenfalls
gruen. Ein echter Project-Health-Blocker wurde nicht ignoriert: Der zu breite
PH-20260709-002-Eintrag fuer ContentModel plus Runtime-Hit-Ref-Protokoll ist
aufgeteilt. M4.4 traegt die Render-ContentModel-Migration jetzt direkt ueber
Roadmap und Ledger; der verbleibende Runtime-/Editor-Hit-Ref-Protokollrest ist
als PH-20260711-001 an der Runtime-Auswahlstelle markiert. Phase 1 bestaetigt
nach Rework: keine offene Render-Harness-Luecke, PH-20260711-001 ist kein
M4.4-Render-Handoff-Blocker. Naechster Schritt ist M4.4 Baseline-Metriken;
es wurde noch keine Render-Implementierung begonnen.
