Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
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
