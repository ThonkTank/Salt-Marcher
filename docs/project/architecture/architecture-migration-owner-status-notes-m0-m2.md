Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: Archived German owner-facing status notes for architecture
migration milestones M0 through M2.

# Architecture Migration Owner Status Notes M0-M2

## Purpose

This file archives the German owner-facing status notes for completed
architecture migration milestones M0 through M2. Current notes continue in
`docs/project/architecture/architecture-migration-owner-status-notes.md`.

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
