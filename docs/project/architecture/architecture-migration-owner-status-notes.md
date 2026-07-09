Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: German owner-facing status notes for the architecture
migration governed by `architecture-migration-roadmap.md` and
`migration-ledger.md`.

# Architecture Migration Owner Status Notes

## Purpose

This file records short German owner-facing status notes for architecture
migration state changes. The active machine-readable state remains in
`docs/project/architecture/migration-ledger.md`.

## Notes

### 2026-07-09 M0.1 charter

Die Migrations-Roadmap ist als aktives Architektur-Dokument im Repo
eingetragen. Es gab keine Produktionscode-Aenderung; das Dokumentationsgate
war gruen.

### 2026-07-09 M0.2 agent-guide

`AGENTS.md` routet die Migration jetzt auf die Roadmap: Outcome-Gates bleiben
bindend, alte Form-Checks werden im M0-Pfad entfernt, und R3c blockiert die
Roadmap-Migration nicht.

### 2026-07-09 M0.3 ledger-start

Der Ledger ist angelegt und setzt M0.4 als naechsten In-Flight-Schritt. Noch
ist keine Produkt-Area gestartet; alle Area-Zeilen bleiben pending bis zur
M1/M2-Zyklusarbeit.

### 2026-07-09 M0.4 form-enforcement-removal

Die alten Form-Enforcement-Gates sind aus Build-Logic, Build-Harness,
Error-Prone, architecture-policy und jQAssistant entfernt. Die behaltenen
Outcome-Gates bleiben aktiv: Package-Zyklen, Layer-Dependency-Direction,
Dokumentationsgrundregeln und Behavior-Harness-Gates sind gruen; der
unabhaengige Judge hat die Nachpruefung ohne Must-Fix geschlossen.

### 2026-07-09 M0.5 doctrine-removal

Die alten Domain/View/Feature-Runtime-Doktrin-Dokumente, die
Architecture-Enforcement-Inventare und die zugehoerigen Lehr-Skills sind aus
dem Repo entfernt. Lebende Router zeigen jetzt auf Roadmap, Ledger, echte
Outcome-Gates und die oeffentlichen Proof-Routen; der Fresh-Agent-Check hat
keine alte Rule-3/Formdoktrin mehr reproduziert, und der unabhaengige Judge hat
M0.5 nach Rework freigegeben.

### 2026-07-09 M1.1 harness-inventory

Der Ledger listet jetzt fuer jede Migrations-Area die vorhandenen Harnesses,
importierten Boundary-Surfaces, Szenarioabdeckung und bekannten Gaps. Die
Dokumentationspruefung ist gruen; der unabhaengige Judge hat die Inventur nach
Rework freigegeben. Naechster Schritt ist M1.2, das Einfrieren des
Parity-Protokolls.

### 2026-07-09 M1.2 parity-protocol

Die Roadmap enthaelt jetzt das verbindliche Parity-Protokoll: Szenarien und
Assertions werden im per-area Design-Artefakt materialisiert und vor dem ersten
Wiring-Port eingefroren; Wiring-Ports bleiben eigene Vorab-Commits, und
nichtdeterministisches Altverhalten wird nur als deterministische Envelope plus
R2-Issue dokumentiert. Phase 1 und der unabhaengige Judge haben den Schritt
freigegeben. Naechster Schritt ist M1.3 Hex-Harness-Haertung.

### 2026-07-09 M1.3 hex-harness-hardening

Die beiden offenen Hex-Produktionsrouten sind gegen die alte Struktur
abgedeckt: `hexMapEditorBehaviorHarness` bindet `HexMapContribution` durch die
Shell-Slots und prueft Erstellen, Bearbeiten, Malen, Auswaehlen, Marker,
Reisegruppe und Reload; `hexTravelStateBehaviorHarness` treibt Hex- und
Party-Services bis in das kompakte `Reise`-State-Tab. Der kombinierte
Hex-Harness, das Dokumentationsgate, Phase 1 und der unabhaengige Judge sind
gruen. Naechster Schritt ist M1.4 mit deutschen Owner-Smoke-Checklisten.

### 2026-07-09 M1.4 owner-smoke-checklists

Die deutschen Owner-Smoke-Checklisten liegen jetzt neben Roadmap und Ledger in
`docs/project/architecture/architecture-migration-owner-smoke-checklists.md`.
Alle 13 aktuellen Ledger-Areas haben je zehn kurze, sichtbare Pruefschritte;
die Checklisten definieren kein neues Produktverhalten und blockieren die
Pipeline nicht. Dokumentationsgate, Phase 1 und der unabhaengige Judge sind
gruen. Naechster Schritt ist M1.5 mit Render-Snapshot-Parity.

### 2026-07-09 M1.5 render-parity-net

Der neue `dungeonMapRenderParityHarness` erzeugt Bild-Snapshots fuer die
Dungeon-Karte und vergleicht echte Canvas-Pixel paarweise: Editor-Projektion,
Editor-Wandpreview und Dungeon-Travel-Projektion rendern denselben Frame
zweimal mit `changedPixels=0`; die Editor-Kontrollvergleiche beweisen
zusaetzlich, dass der Diff-Orakel sichtbare Aenderungen erkennt. PNG-Belege
liegen nur unter `build/dungeon-map-render-parity-results/`. Die alte
Dungeon-Travel-Auffaelligkeit, dass `z=0` und `z=1` aktuell pixelgleich bleiben
koennen, ist als separater R2-Eintrag journalisiert und in der Migration nicht
repariert. M1 ist damit auf dem Branch abgeschlossen; naechster Schritt ist
M2.1 Hex-Harness-Check.

### 2026-07-09 M2.1 hex-harness-closure

Die M2.1-Harness-Pruefung hat die verbleibende Hex-Save-Failure-Luecke gegen
die alte Struktur geschlossen: `HEX-EDITOR-013` treibt das State-Panel
`Speichern` durch `HexMapStateView`, `HexMapIntentHandler`, Domain-Use-Case und
SQLite-Update und erzwingt dort einen Speicherfehler. Der Fehler erscheint
sichtbar im State-Panel, und der persistierte Kartenname bleibt unveraendert.
Der kombinierte Hex-Harness, das Dokumentationsgate, `git diff --check`, Phase
1 und der unabhaengige Judge sind gruen. Naechster Schritt ist M2.2 mit
Baseline-Metriken fuer die Hex-Pilotflaeche.

### 2026-07-09 M2.2 hex-baseline-metrics

Die Hex-Baseline ist in
`docs/project/architecture/architecture-migration-hex-baseline.md`
festgehalten. Der reproduzierbare Roadmap-Schnitt umfasst 87 Java-Dateien mit
5.564 physischen LOC; die normale M2-Produktstruktur ohne Data-Layer umfasst
70 Dateien mit 4.560 LOC. Die laengsten Hex-eigenen User-Action-Ketten liegen
bei 5 Hops bis zur ersten Mutation; der Reisegruppen-Pfad ist als laengerer
Cross-Area-Seam fuer das Target-Design markiert. Forwarding-Kandidaten und
String-Roundtrips sind konkret mit Repo-Pfaden und Zeilen belegt.
Dokumentationsgate, `git diff --check`, Phase 1 und der unabhaengige Judge sind
gruen. Naechster Schritt ist M2.3 mit judge-geprueftem Hex-Target-Design; es
wurde noch keine Wiring- oder Implementierungsarbeit begonnen.

### 2026-07-09 M2.3 hex-target-design

Das Hex-Target-Design ist in
`docs/project/architecture/architecture-migration-hex-target-design.md`
genehmigt. Es legt die Zielklassen, Repraesentativketten, Loeschliste,
byte-kompatiblen Seams, eingefrorene Parity-Inventur, Wiring-Port-Grenze und
Metrik-Ausnahmen konkret fest. Nach Rework war Phase 1 sauber; der
unabhaengige Judge hat M2.3 freigegeben. Dokumentationsgate und
`git diff --check` sind gruen. Naechster Schritt ist M2.4: ein reiner
Wiring-Port auf die `HexMapViewModel`-Kompatibilitaetsgrenze, ohne Szenario-
oder Assertion-Aenderung und ohne Implementierung.

### 2026-07-09 M2.4 hex-wiring-port

Der Hex-Wiring-Port ist als eigener Commit abgeschlossen. `HexMapViewModel`
buendelt vorlaeufig die alten Content- und Contribution-Modelle; Binder,
IntentHandler, Views und Hex-Harness nutzen diese Kompatibilitaetsgrenze,
ohne Szenarien, Assertion-Texte oder sichtbares Verhalten zu aendern. Die
alten Content-Models, Input-Event-Records und `HexMapIntentHandler` bleiben
fuer M2.5 noch vorhanden. Hex-Harnesses, Produktions-Handoff, Phase 1 und der
unabhaengige Judge sind gruen. Naechster Schritt ist M2.5: Umsetzung des
genehmigten Designs mit ausgefuehrter Loeschliste und weiter eingefrorenen
Harness-Orakeln.

### 2026-07-09 M2.5 hex-implementation

Die Hex-Implementierung ersetzt den vorlaeufigen Facade-Inhalt durch das
genehmigte Zielmodell: Editor- und Reise-Services besitzen jetzt die alten
Use-Case-Pfade direkt, `HexMapViewModel` und `HexMapVocabulary` tragen die
getypte View-Projektion, und die Loeschliste fuer Usecases, Ports,
Published-State-Adapter, Content-Models, Input-Events und `HexMapIntentHandler`
ist ausgefuehrt. Die Produktflaeche liegt bei 41 Dateien und 3.701 LOC; diese
Abweichung ist durch das M2.5-Design-Amendment begrenzt und von Phase 1 sowie
dem unabhaengigen Judge akzeptiert. Produktions-Handoff und die direkten
Hex-Harnesses sind gruen; retained Harness-Logs scheitern nur vor Task-Start
an der dokumentierten Gradle-Wildcard-IP-Umgebung. Naechster Schritt ist M2.6:
Conformance-Evidence final bestaetigen und dann den Hex-Close-out vorbereiten.

### 2026-07-09 M2.7 hex-close-out

Der Hex-Pilot ist auf dem Branch abgeschlossen. Referenz fuer weitere
migrierte Areas ist Commit `3679a19e2`: dort sind die alten Hex-Usecases,
Ports, Published-State-Adapter, View-Content-Models, Input-Events und
`HexMapIntentHandler` geloescht, waehrend die sichtbaren Hex-Editor-,
Reisegruppen- und Reise-State-Verhalten durch die eingefrorenen Harnesses
erhalten bleiben. Die Owner-Smoke-Checkliste fuer `hex` steht in
`docs/project/architecture/architecture-migration-owner-smoke-checklists.md`.
Die akzeptierte Metrik-Ausnahme gilt nur fuer diesen Pilotstand; M3 startet mit
`worldplanner` im Schritt Harness-Check/Closure.

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
