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

## Notes

### 2026-07-09 M3.1 worldplanner-harness-closure

Die World-Planner-Harness-Pruefung ist fuer M3.1 geschlossen. Der
`worldPlannerEncounterHarness` nutzt keine statische World-Snapshot-Fixture
und kein manuell verdrahtetes Encounter-Repository mehr: World Planner wird
ueber Service und Persistenz gesaet, Encounter laeuft ueber die registrierten
Services, und das Ergebnis wird aus dem veroeffentlichten `EncounterStateModel`
gelesen. Backend-, Encounter-, Raw-Input- und UI-Harnesses sind gruen; der
alte P1-Gap fuer die World-Planner-zu-Encounter-Route ist aus dem Gap-Register
entfernt. Naechster Schritt ist M3.2 mit Baseline-Metriken fuer `worldplanner`.

### 2026-07-09 M3.2 worldplanner-baseline-metrics

Die Worldplanner-Baseline ist in
`docs/project/architecture/architecture-migration-worldplanner-baseline.md`
festgehalten. Der reproduzierbare Roadmap-Schnitt umfasst 82 Java-Dateien mit
5.440 physischen LOC; die normale M3-Produktstruktur ohne Data-Layer umfasst
68 Dateien mit 4.667 LOC. Die dominanten Worldplanner-eigenen
User-Action-Ketten liegen bei 5 Hops bis zur ersten Domain-Mutation und bei 7
Hops, wenn die immutable Replacement- und Save-Tails separat mitgezaehlt
werden. Forwarding-Kandidaten, Seam-Proxies und String-Roundtrips sind konkret
mit Repo-Pfaden und Zeilen belegt. Naechster Schritt ist M3.3 mit
judge-geprueftem Worldplanner-Target-Design; es wurde noch keine Wiring- oder
Implementierungsarbeit begonnen.

### 2026-07-09 M3.3 worldplanner-target-design

Das Worldplanner-Target-Design ist in
`docs/project/architecture/architecture-migration-worldplanner-target-design.md`
genehmigt. Phase 1 fand zunaechst eine fehlende UI-Proof-Grenze fuer
`Zum Encounter` und eine missverstaendliche Refresh-Formulierung; der Rework
schliesst den sichtbaren Button gegen die alte Struktur im
`worldPlannerUiHarness` und haelt `Aktualisieren` weiter als eingefrorenes
Verhalten fest. Retained Harness-, Focused-Handoff- und Dokumentationslogs sind
gruen; Phase 1 Re-Review und der unabhaengige Judge haben M3.3 freigegeben.
Naechster Schritt ist M3.4: ein reiner Wiring-Port auf die
`WorldPlannerViewModel`-Kompatibilitaetsgrenze, ohne Loeschliste und ohne
Szenario- oder Assertion-Aenderung.

### 2026-07-09 M3.4 worldplanner-wiring-port

Der Worldplanner-Wiring-Port ist abgeschlossen. `WorldPlannerViewModel` ist
jetzt die Kompatibilitaetsfassade ueber den alten Content- und
Contribution-Modellen; Binder, IntentHandler und Raw-Input-Harness laufen ueber
diese Grenze, waehrend Start-Refresh und Command-Konstruktion unveraendert im
`WorldPlannerIntentHandler` bleiben. Der Backend-Harness nutzt fuer die
Foreign-Reference-Pruefung die Service-Registry- und Reference-Port-Seam statt
`WorldPlannerUseCaseServiceAssembly` direkt zu instanziieren. Phase 1 fand
zunaechst eine zu weit verschobene Start-Refresh-Verantwortung; der Rework hat
das Orakel auf den IntentHandler zurueckgestellt. Finale Harness-, PMD-,
Dead-Code- und `production-handoff`-Logs sind gruen, Phase 1 und Phase 2 haben
den finalen Stand freigegeben. Naechster Schritt ist M3.5: Umsetzung des
genehmigten Target-Designs inklusive 28-Datei-Loeschliste und
Metric-/Parity-Proof vor der Conformance Review.

### 2026-07-09 M3.7 worldplanner-close-out

Der Worldplanner ist mit Referenzcommit `f499d321d` abgeschlossen; alte Usecases, Content-Models, Input-Events und `WorldPlannerIntentHandler` sind geloescht, Harnesses und `production-handoff` sind gruen, Phase 1/2 akzeptieren die 43-Dateien-/3.709-LOC-Ausnahme, und M3.1 `creatures` startet mit Harness-Check/Closure.

### 2026-07-09 M3.1 creatures-harness-closure

Der neue `creatureCatalogHarness` schliesst den Creature-Katalog-Gap gegen die alte Struktur: Create/Edit sind nur Harness-Fixture-Aufbau und -Update, die Produktgrenze bleibt ein read-only Referenzkatalog, und die Orakel laufen ueber `CreaturesApplicationService` plus publizierte Catalog-, Detail-, Filter- und Encounter-Candidate-Models. Harness, Harness-Map/Topology, Focused-Handoff, Dokumentationsgate und Phase 1 sind gruen. Naechster Schritt ist M3.2 Baseline-Metriken fuer `creatures`.

### 2026-07-09 M3.2 creatures-baseline-metrics

Die Creature-Baseline ist in
`docs/project/architecture/architecture-migration-creatures-baseline.md`
festgehalten. Der reproduzierbare Roadmap-Schnitt umfasst 90 Java-Dateien mit
4.587 physischen LOC; die normale M3-Produktstruktur ohne Data-Layer umfasst
35 Dateien mit 2.060 LOC. Weil `creatures` ein read-only Referenzkatalog ohne
autorisierte Produkt-Schreibfluesse ist, misst die Baseline die laengsten
Ketten bis zur publizierten Catalog-/Detail-/Filter-/Encounter-Candidate-
Publication: maximal 7 Hops bis zur ersten Creature-Publikation. Forwarding-/
Proxy-Kandidaten und vier String-Grenzfamilien sind konkret belegt. Das
Dokumentationsgate, Phase 1 nach Rework und der unabhaengige Judge sind gruen.
Naechster Schritt ist M3.3 mit judge-geprueftem Creature-Target-Design; es
wurde noch keine Wiring- oder Implementierungsarbeit begonnen.

### 2026-07-09 M3.3 creatures-target-design

Das Creature-Target-Design ist in
`docs/project/architecture/architecture-migration-creatures-target-design.md`
genehmigt. Die Zielstruktur behaelt `CreaturesApplicationService`, die
Service-Registry-Grenze, `CreatureCatalogPort`, `CreatureCatalogData` und alle
publizierten Records/Enums byte-kompatibel, waehrend die spaetere Umsetzung die
Usecase-, interne Repository- und Publication-Assembly-Schicht loeschen muss.
Phase 1 fand zunaechst eine fehlende Inventur fuer den adjacent
`encounterStateTabHarness`; der Rework friert dessen zwei sichtbare
State-Tab-Orakel fuer den Wiring-Port ein, ohne den bestehenden Encounter-Gap
zu schliessen. Dokumentationsgate, Phase 1 Re-Review und der unabhaengige
Judge sind gruen. Naechster Schritt ist M3.4: ein reiner Harness-Wiring-Port
fuer die genehmigte Deletion-List, ohne Szenario- oder Assertion-Aenderung.

### 2026-07-09 M3.4 creatures-wiring-port

Der Creature-Wiring-Port ist abgeschlossen. Der adjacent
`encounterStateTabHarness` baut die Creature-Seite nicht mehr aus den vier
alten Usecases und dem internen Published-State-Repository zusammen, sondern
registriert einen Noop-`CreatureCatalogPort` und nutzt danach die normale
`CreaturesServiceContribution`-Grenze. Der `creatureCatalogHarness` brauchte
keine Aenderung. Proof-IDs, Fixture-Werte, sichtbare Texte und Assertions im
Encounter-State-Tab sind unveraendert eingefroren; `creatureCatalogHarness`
und `encounterStateTabHarness` sind gruen, der Focused-Handoff ist nach dem
bekannten Gradle-Wildcard-IP-Startfehler mit `CODEX_THREAD_ID` unset gruen, und
Phase 1 sowie der unabhaengige Judge haben den Wiring-Port freigegeben.
Naechster Schritt ist M3.5: Umsetzung des genehmigten Creature-Target-Designs
inklusive 9-Datei-Loeschliste, byte-kompatiblen Published-Seams und
anschliessendem Parity-/Metric-Proof.

### 2026-07-09 M3.5 creatures-implementation

Die Creature-Implementierung ist abgeschlossen. Die genehmigte
9-Datei-Loeschliste ist ausgefuehrt; die alte Usecase-, interne Repository-
und Publication-Assembly-Schicht ist weg. `CreaturesApplicationService`
besitzt jetzt Query-Normalisierung, CR-zu-XP-Pruefung, Lookup-Aufrufe,
Statusauswahl und Publication direkt; `CreatureCatalogProjection` mappt die
Lookup-Daten in die byte-kompatiblen Published Records, und die vier
Published Models halten ihren Zustand selbst. Die einzige Data-Layer-Aenderung
ist die genehmigte typed-sort-field Gateway-Anpassung im Creature-Mapper.
`compileJava compileTestJava`, PMD/Dead-Code, `creatureCatalogHarness`,
`encounterStateTabHarness` und `production-handoff` sind gruen. Phase 1 und
der unabhaengige Judge haben die Umsetzung freigegeben und die
27-Dateien-/1.749-LOC-Ausnahme unter der genehmigten 1.750-LOC-Grenze
akzeptiert. Naechster Schritt ist M3.6: Conformance Review mit finalem
Design-, Parity-, Seam- und Metric-Nachweis vor dem Close-out.

### 2026-07-09 M3.6 creatures-conformance-review

Die Creature-Conformance-Review ist abgeschlossen. Phase 1 und der
unabhaengige Judge bestaetigen, dass das genehmigte Target-Design umgesetzt
ist: die 9-Datei-Loeschliste ist vollstaendig ausgefuehrt, es gibt keine
Source- oder Test-Referenzen auf die geloeschten Klassen, die
`CreaturesServiceContribution`- und Published-Seams bleiben kompatibel, und
die einzige Data-Layer-Beruehrung bleibt die genehmigte
typed-sort-field-Gateway-Anpassung. Die eingefrorenen Harnesses sind gruen,
`production-handoff` ist gruen, und die 27-Dateien-/1.749-LOC-Ausnahme liegt
unter der genehmigten 1.750-LOC-Grenze. Naechster Schritt ist M3.7:
Creature-Close-out mit Owner-Smoke-Checklist-Referenz, finalem Proof-Set und
Ledger-Uebergang zum naechsten M3-Bereich.

### 2026-07-09 M3.7 creatures-close-out

Der Creature-Bereich ist abgeschlossen. Referenzcommit fuer den migrierten
Creature-Zielzustand ist `246d39267`; der Close-out verweist auf die
Owner-Smoke-Checklist in
`docs/project/architecture/architecture-migration-owner-smoke-checklists.md`.
Das finale Proof-Set ist gruen: `compileJava compileTestJava`,
PMD/Dead-Code, `creatureCatalogHarness`, der adjacent
`encounterStateTabHarness`, Dokumentationsgate und `production-handoff`. Die
genehmigte 27-Dateien-/1.749-LOC-Ausnahme bleibt dokumentiert und unter der
1.750-LOC-Grenze. Auffaelligkeiten aus dem Owner-Smoke laufen wie im Roadmap-
Protokoll als normale R2-Anomalien oder, bei schwerer Drift, ueber den
Revert-Pfad. Naechster M3-Bereich ist `party` mit Harness-Check/Closure.

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
