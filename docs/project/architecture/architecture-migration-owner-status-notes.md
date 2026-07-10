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
- M3 notes from 2026-07-09:
  `docs/project/architecture/architecture-migration-owner-status-notes-m3-2026-07-09.md`

## Notes

### 2026-07-10 M3.1 party-harness-closure

Der Party-Harness-Gap ist geschlossen. `partyDropdownHarness` laeuft jetzt
ueber die echte Shell-Route: `PartyTopBarContribution` bindet in
`ShellSlot.TOP_BAR`, der Harness oeffnet den JavaFX-Dropdown-Trigger und
bedient die gerenderten Controls fuer neuen Charakter, Entfernen und
Reserve-hinzufuegen. Die bestehenden Orakel bleiben erhalten: Party-Snapshot,
aktive Party, aktive Komposition und Trigger-Text werden weiter geprueft.
`compileTestJava`, `partyDropdownHarness`, Harness-Map/Topology und der
Focused-Handoff fuer `src/view/dropdowns/party` sind gruen; der erste
Focused-Handoff-Versuch scheiterte nur am bekannten Gradle-Wildcard-IP-Start
vor Task-Ausfuehrung und wurde mit `CODEX_THREAD_ID` unset gruen wiederholt.
Naechster Schritt ist M3.2: Party-Baseline-Metriken vor dem Target-Design.

### 2026-07-10 M3.2 party-baseline-metrics

Die Party-Baseline ist in
`docs/project/architecture/architecture-migration-party-baseline.md`
festgehalten. Der reproduzierbare Roadmap-Schnitt umfasst 141 Java-Dateien mit
7.998 physischen LOC; die normale M3-Produktstruktur ohne Data-Layer umfasst
119 Dateien mit 6.781 LOC. Die dominanten Dropdown-Ketten liegen bei 5 Hops
bis zur Roster-Mutation und bei 6 Hops, wenn die Character-Replacement-Schicht
separat mitgezaehlt wird. Zehn Produkt-/Published-Forwarding-Kandidaten, zwei
Data-Kandidaten und vier produktive String-Grenzfamilien sind konkret belegt.
Das Dokumentationsgate, Phase 1 nach Citation-Rework und der unabhaengige
Judge sind gruen. Naechster Schritt ist M3.3 mit judge-geprueftem
Party-Target-Design; es wurde noch keine Wiring- oder Implementierungsarbeit
begonnen.

### 2026-07-10 M3.3 party-target-design

Das Party-Target-Design ist in
`docs/project/architecture/architecture-migration-party-target-design.md`
genehmigt. Es legt die Zielklassen fest: `PartyApplicationService` uebernimmt
die direkten Mutations- und Publication-Routen, die sieben Published Models
werden zustandsfuehrend, `PartyPublishedProjection` kapselt Mapping, und die
Top-Bar bekommt `PartyTopBarViewModel` plus `PartyTopBarVocabulary`. Die
34-Datei-Loeschliste, byte-kompatiblen Published- und Top-Bar-Seams, das
eingefrorene `partyDropdownHarness`-Inventar und die Metric-Ziele sind konkret
benannt. `git diff --check`, `git diff --cached --check`,
`checkDocumentationEnforcement`, Phase 1 und der unabhaengige Judge sind
gruen. Naechster Schritt ist M3.4: Harness-Wiring-Port-Verifikation; nach
Designstand ist kein Harness-Code-Port erwartet, solange keine
Deletion-List-Importe im eingefrorenen Harness auftauchen.

### 2026-07-10 M3.4 party-wiring-port

Der Party-Wiring-Port ist als No-code-Schritt abgeschlossen.
`partyDropdownHarness` bindet bereits die echte `PartyTopBarContribution` ueber
`ShellRuntimeContext` und `ShellSlot.TOP_BAR`, verwendet die erhaltenen
Published Models und enthaelt keine Referenzen auf die 34
Deletion-List-Klassen. Die eingefrorenen Szenarien und Assertions wurden nicht
geaendert. `partyDropdownHarness`, Harness-Map/Topology und der
Focused-Handoff fuer `src/view/dropdowns/party` sind gruen; Phase 1 und der
unabhaengige Judge haben den No-code-Wiring-Port freigegeben. Naechster
Schritt ist M3.5: Umsetzung des genehmigten Party-Target-Designs mit
vollstaendiger Loeschliste, byte-kompatiblen Party-Seams und unveraendertem
Harness-Orakel.

### 2026-07-10 M3.5 party-implementation

Die Party-Implementierung ist abgeschlossen. Die genehmigte
34-Datei-Loeschliste ist ausgefuehrt; die alte Usecase-, Published-State-,
Readback- und Top-Bar-Intent-Schicht ist weg. `PartyApplicationService`
besitzt jetzt Mutations-, Readback- und Publication-Routen direkt,
`PartyPublishedProjection` mappt die Roster-Daten in die byte-kompatiblen
Published Records, die sieben Published Models halten ihren Zustand selbst,
und die Top-Bar laeuft ueber `PartyTopBarViewModel` plus
`PartyTopBarVocabulary`. Die doppelte Published-State-Mechanik wurde als
echter gemeinsamer Helper `PublishedState` extrahiert; der alte interne
String-Roundtrip fuer Dungeon-Reiseziele ist entfernt. `compileJava
compileTestJava`, Dead-Code/PMD/CPD/SpotBugs, `partyDropdownHarness`,
Harness-Map/Topology und `production-handoff` sind gruen. Phase 1 fand
zunaechst den String-Roundtrip, nach Rework haben Phase 1 und der
unabhaengige Judge die Umsetzung freigegeben und die 88-Dateien-/5.740-LOC-
Ausnahme unter der genehmigten 5.750-LOC-Grenze akzeptiert. Naechster Schritt
ist M3.6: Conformance Review mit finalem Design-, Parity-, Seam- und
Metric-Nachweis vor dem Close-out.

### 2026-07-10 M3.6 party-conformance-review

Die Party-Conformance-Review ist abgeschlossen. Phase 1 hat zunaechst den
alten internen String-Roundtrip fuer Reiseziele beanstandet; nach Rework nutzt
die Party-Route typed Mapping zwischen Published Enums und Domain-Werten, und
der alte String-basierte Dungeon-Reiseziel-Factory-Pfad ist geloescht. Phase 1
und der unabhaengige Judge bestaetigen jetzt, dass das genehmigte Target-Design
umgesetzt ist: die 34-Datei-Loeschliste ist vollstaendig ausgefuehrt, es gibt
keine Source- oder Test-Referenzen auf die geloeschten Klassen, die
Party-Service-, Published- und Top-Bar-Seams bleiben kompatibel, das
eingefrorene `partyDropdownHarness`-Orakel ist unveraendert, und die
Published-State-Extraktion ist echte Duplikatsentfernung statt Check-Gaming.
`production-handoff` ist gruen, und die 88-Dateien-/5.740-LOC-Ausnahme liegt
unter der genehmigten 5.750-LOC-Grenze. Naechster Schritt ist M3.7:
Party-Close-out mit Owner-Smoke-Checklist-Referenz, finalem Proof-Set und
Ledger-Uebergang zum naechsten M3-Bereich.

### 2026-07-10 M3.7 party-close-out

Der Party-Bereich ist abgeschlossen. Referenzcommit fuer den migrierten
Party-Zielzustand ist `8e67f2304`; der Close-out verweist auf die
Owner-Smoke-Checklist in
`docs/project/architecture/architecture-migration-owner-smoke-checklists.md`.
Das finale Proof-Set ist gruen: `compileJava compileTestJava`,
Dead-Code/PMD/CPD/SpotBugs, `partyDropdownHarness`, Harness-Map/Topology,
Dokumentationsgate und `production-handoff`. Die genehmigte
88-Dateien-/5.740-LOC-Ausnahme bleibt dokumentiert und unter der
5.750-LOC-Grenze. Die typed-travel-Rework-Entscheidung und die gemeinsame
`PublishedState`-Extraktion sind in Ledger und Review festgehalten.
Auffaelligkeiten aus dem Owner-Smoke laufen wie im Roadmap-Protokoll als
normale R2-Anomalien oder, bei schwerer Drift, ueber den Revert-Pfad.
Naechster M3-Bereich ist `sessionplanner` mit Harness-Check/Closure.

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
