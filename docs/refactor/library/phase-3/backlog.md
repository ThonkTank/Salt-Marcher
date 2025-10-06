# Phase 3 Backlog – Library Refactor

## Epic D: Test & Rollout Enablement

### Work Package WP-D1: Contract & Regression Harness

ID: LIB-TD-0001
Titel (imperativ): Richte portübergreifenden Vertragstest-Harness ein
Kategorie: Tests
Bezug (Trace): Debt: D-LIB-011; Risk: R-LIB-002; ADR: ADR-0002, ADR-0003; WP: WP-D1
Problem (Ist): Die aktuelle Vitest-Suite (`tests/library/view.test.ts`) mockt sämtliche Renderers und Speicheradapter, wodurch Import-, Serializer- und Watcher-Flüsse ungetestet bleiben.
Zielzustand (Soll/Contract): Zentraler Test-Harness führt Renderer-, Storage-, Serializer- und Event-Port-Verträge gegen gemeinsame Fixtures aus; Tests laufen determiniert und ohne Mocks der Kernpfade.
Scope & Out-of-Scope: In Scope sind Bibliotheks-Ports gemäß Contracts v2; out-of-scope sind UI-Screenshot-Tests und nicht-library Module.
Entwurfsleitlinien (Planung):
- Entwerfe `tests/contracts/library-harness.ts` als Einstiegspunkt mit konfigurierbaren Adaptern (Legacy vs. v2).
- Definiere Fixture-Struktur für Domain-Daten (Creatures, Items, Equipment, Terrains, Regions) mit klarer Ownership.
- Plane CI-Workflow-Integration (`npm run test:contracts`) inkl. Dokumentation in `BUILD.md`.
- Lege Telemetrie-Hooks als optionalen Adapter an, um spätere Paritätsprüfungen einzubinden.
Abhängigkeiten: Keine.
Risiken & Mitigation:
- Gefahr fragmentierter Tests → Review der Harness-API mit QA-Team vor Implementierung.
- Längere Build-Zeiten → Parallelisierungskonzept vorbereiten, Smoke-Subset für PRs definieren.
Test-Impact & Ankermuster:
- Vertragstests für Renderer-, Storage-, Serializer- und Event-Port.
- Regressionstest-Suite für kritische Pfade (Import, Preset-Laden, Debounced Saves) im Harness verankern.
Messgrößen (Erfolg):
- Neue Testsuite deckt ≥ 4 Ports ab.
- Baseline-Coverage in Hotspots steigt um ≥ 15 Prozentpunkte nach Integration.
Akzeptanzkriterien:
  DoR (Ready für Phase 4): Harness-API, Fixture-Design und CI-Integration sind beschrieben; Testdatenquellen abgestimmt.
  DoD (für Phase 4): Tests laufen grün, decken alle Ports ab und laufen automatisiert im CI.
Aufwand (T-Shirt): M
Priorität (Score): 35
Open Questions: Benötigt das Team dedizierte Mock-Stubs für Telemetrie im Harness?

ID: LIB-TD-0002
Titel (imperativ): Hinterlege Golden-Files für Serializer-Roundtrips
Kategorie: Tests
Bezug (Trace): Debt: D-LIB-004, D-LIB-006; Risk: R-LIB-002; ADR: ADR-0003; WP: WP-D1
Problem (Ist): Serializer-Ausgaben werden nirgends persistent verglichen, daher bleiben stillschweigende JSON-Parse-Fehler bei Items/Equipment unentdeckt.
Zielzustand (Soll/Contract): Golden-Dateien pro Domain (Creatures, Items, Equipment, Spells) dienen als Kanon; jede Serializer-Änderung löst diffbare Tests aus.
Scope & Out-of-Scope: In Scope ist das Anlegen und Versionieren der Golden-Files inkl. Dry-Run-Pipeline; Out-of-Scope sind neue Datenschemata.
Entwurfsleitlinien (Planung):
- Nutze Harness aus LIB-TD-0001 zur Erzeugung deterministischer Outputs.
- Plane Ordner `tests/golden/library/<domain>` mit YAML/Markdown-Files plus Metadaten (`.manifest.json`).
- Definiere Update-Workflow (`npm run golden:update`) samt Review-Checklist.
- Lege Diff-Regeln fest (Whitespace, Sortierung) um false positives zu vermeiden.
Abhängigkeiten: LIB-TD-0001.
Risiken & Mitigation:
- Golden-Files könnten zu groß werden → Sampling-Strategie (repräsentative Datensätze) dokumentieren.
- Unbeabsichtigte Updates → Require Review von Domain-Owner bei Golden-Updates.
Test-Impact & Ankermuster:
- Golden-Diff-Tests für alle Serializer-Domänen.
- Roundtrip-Tests (serialize→deserialize) gegen Golden-Basis.
Messgrößen (Erfolg):
- Mindestens 12 Golden-Beispiele (mind. 3 pro Hauptdomäne).
- Roundtrip-Fehlerquote sinkt auf 0 im Dry-Run.
Akzeptanzkriterien:
  DoR (Ready für Phase 4): Golden-Datensatzliste abgestimmt, Speicherort und Updateprozess beschrieben.
  DoD (für Phase 4): Golden-Dateien eingecheckt, Tests laufen grün, Update-Workflow dokumentiert.
Aufwand (T-Shirt): S
Priorität (Score): 56
Open Questions: Welche Legacy-Dateien dienen als autoritative Golden-Basis (Preset vs. Nutzerbeispiele)?

## Epic A: Dependency Cycle Removal

### Work Package WP-A1: Renderer ↔ Storage Decoupling

ID: LIB-TD-0003
Titel (imperativ): Definiere Application-Service-Port für Bibliotheksrendering
Kategorie: Architektur
Bezug (Trace): Debt: D-LIB-001; Risks: R-LIB-001, R-LIB-005; ADR: ADR-0001, ADR-0002; WP: WP-A1
Problem (Ist): Render-Views (`src/apps/library/view/*.ts`) lesen direkt aus Stores/IO und deklarieren teils `async render()`, was Schichten verletzt und Rennbedingungen erzeugt.
Zielzustand (Soll/Contract): Renderer kommunizieren ausschließlich über einen `LibraryModeServicePort`, der synchronisierte Query-, Import- und Persistenz-Operationen kapselt.
Scope & Out-of-Scope: Enthält Spezifikation von Service-Domain DTOs und Kill-Switch-Hooks; UI-Komponenten-Anpassungen bleiben aus.
Entwurfsleitlinien (Planung):
- Modellieren Port-Interface (Query-/Mutation-Methoden, Promise-Strategie) inkl. Error- und Telemetrie-Kontrakt.
- Plane Service-Komposition (RendererPort↔StoragePort↔SerializerTemplate) mit Sequenzdiagramm.
- Beschreibe Migrationspfad: Legacy-Renderer werden über Adapter auf Port geführt.
- Identifiziere benötigte Feature-Flags (`renderer.service.enabled`).
Abhängigkeiten: LIB-TD-0001.
Risiken & Mitigation:
- Fehlende DTO-Abdeckung → frühzeitige Reviews mit Domain-Ownern.
- Versehentliche Blockierung langer IOs → Timeout/Abort-Konzept im Port aufnehmen.
Test-Impact & Ankermuster:
- Vertragstests zwischen Renderer- und Service-Port.
- Chaos-Probe für parallele Queries (Search + Mode-Wechsel).
Messgrößen (Erfolg):
- 0 direkte IO-Imports mehr in Renderer-Dateien (Analyse via Dependency-Graph).
- Reduktion async `render()`-Signaturen auf 0.
Akzeptanzkriterien:
  DoR (Ready für Phase 4): Port-Signaturen, DTO-Liste und Feature-Flag-Plan stehen.
  DoD (für Phase 4): Alle Renderer rufen Service-Port statt IO direkt; Verträge grün.
Aufwand (T-Shirt): M
Priorität (Score): 35
Open Questions: Wie werden Langläufer (z. B. Preset-Scans) throttled, ohne UI zu blockieren?

ID: LIB-TD-0004
Titel (imperativ): Kapsle Persistenzadapter hinter StoragePort
Kategorie: Persistenz/IO
Bezug (Trace): Debts: D-LIB-004, D-LIB-006, D-LIB-010; Risk: R-LIB-002; ADR: ADR-0003; WP: WP-A1
Problem (Ist): Import-/Preset-Pfade parsen JSON/YAML manuell und schlucken Fehler; Marker-Datei-Handling ist inkonsistent.
Zielzustand (Soll/Contract): StoragePort verwaltet alle Dateizugriffe inkl. Fehlerpropagation, Marker-Verwaltung und Dry-Run-Unterstützung.
Scope & Out-of-Scope: In Scope liegt Port-Definition + Adapter-Planung für Filesystem/Obsidian-APIs; Out-of-Scope ist tatsächliche IO-Implementierung.
Entwurfsleitlinien (Planung):
- Spezifizierung von `readDomainFile`, `writeDomainFile`, `ensureMarker` inkl. Fehlercodes.
- Plane Migrationsstrategie: Legacy-Aufrufe wrappen, Dry-Run-Option für Tests und Preset-Diffs vorsehen.
- Dokumentiere Telemetrie-Events für fehlgeschlagene Marker- oder Parse-Operationen.
- Beschreibe Backups/Restore-Flows im Zusammenspiel mit Migration-Strategie.
Abhängigkeiten: LIB-TD-0003, LIB-TD-0001.
Risiken & Mitigation:
- Gefahr unvollständiger Abdeckung alter Pfade → Mapping-Tabelle alt→neu vorbereiten.
- Höhere Latenz durch zentrale Serialisierung → Cache-Konzept (read-through) planen.
Test-Impact & Ankermuster:
- Storage-Port-Vertragstests (Read/Write/Marker Fehlerszenarien).
- Golden-Dry-Run gegen Preset-Dateien.
Messgrößen (Erfolg):
- 100% der Library-IO-Aufrufe laufen über StoragePort.
- Fehlerfälle liefern strukturierte Codes statt Silent-Fails.
Akzeptanzkriterien:
  DoR (Ready für Phase 4): Methodenliste, Fehlerkatalog, Legacy-Mapping dokumentiert.
  DoD (für Phase 4): Adapter implementiert, Dry-Run unterstützt, Telemetrie feuert bei Fehlern.
Aufwand (T-Shirt): M
Priorität (Score): 31.5
Open Questions: Welche bestehenden Helper (z. B. `metadataCache`) bleiben externe Abhängigkeiten?

### Work Package WP-A2: Modal ↔ Watcher Isolation

ID: LIB-TD-0007
Titel (imperativ): Etabliere Event-Bus-Port für Watcher-Orchestrierung
Kategorie: Architektur
Bezug (Trace): Debts: D-LIB-008; Risks: R-LIB-004, R-LIB-007; ADR: ADR-0004; WP: WP-A2
Problem (Ist): Watcher und Debounce-Logik hängen direkt an Renderern/Modals; Listener werden pro Render neu angehängt und Timer leben über Lifecycle hinaus.
Zielzustand (Soll/Contract): Typsicherer Event-Bus-Port kapselt Watcher, Debounce- und Save-Events; Renderer registrieren nur Lifecycle-Subscriptions.
Scope & Out-of-Scope: Enthält Bus-API, Topic-Definitionen und Debounce-Policy; lässt Legacy-Store-Implementierung zunächst bestehen.
Entwurfsleitlinien (Planung):
- Definiere Topics (`terrain.updated`, `region.savePending`, etc.) samt Payload-Schema.
- Plane Lifecycle-Bindung (`connect`/`dispose`) im Renderer-Kernel (abhängig von LIB-TD-0005).
- Beschreibe Failover: Bus leitet Events wahlweise an Legacy-Callbacks weiter (Dual-Emit).
- Dokumentiere Telemetrie für Drop-Zähler und Duplicate-Detection.
Abhängigkeiten: LIB-TD-0005, LIB-TD-0003.
Risiken & Mitigation:
- Event-Verlust bei Kill-Switch → Replay-Puffer-Konzept vorsehen.
- Doppelverarbeitung → Idempotenz-Checklisten definieren.
Test-Impact & Ankermuster:
- Event-Bus-Vertragstests mit Watcher-Mock.
- Chaos-Proben: parallele Events, Bus-Reset, Kill-Switch.
Messgrößen (Erfolg):
- 0 direkte Watcher-Registrierungen mehr in Renderern/Modals.
- Debounce-Timer pro Topic zentralisiert (max. 1 aktiver Timer).
Akzeptanzkriterien:
  DoR (Ready für Phase 4): Topic-Matrix, Replay- und Dual-Emit-Konzept beschrieben.
  DoD (für Phase 4): Bus ersetzt direkte Listener, Tests decken Failure-Modes ab.
Aufwand (T-Shirt): M
Priorität (Score): 27
Open Questions: Welche Events benötigen garantierte Reihenfolge vs. eventual consistency?

ID: LIB-TD-0008
Titel (imperativ): Binde Create-Modals an Renderer-Lifecycle an
Kategorie: Contracts
Bezug (Trace): Debts: D-LIB-008; Risks: R-LIB-004, R-LIB-007; ADR: ADR-0002, ADR-0004; WP: WP-A2
Problem (Ist): Modals (`CreateCreatureModal`, `CreateItemModal`) werden direkt instanziiert, ohne über `destroy()` aufzuräumen; offene Modals überleben Mode-Wechsel.
Zielzustand (Soll/Contract): Modals registrieren sich über Renderer-Kernel-Hooks, erhalten Abort-/Dispose-Signale und geben Ressourcen (Watcher, Debounce) frei.
Scope & Out-of-Scope: In Scope sind Lifecycle-Kontrakte und Adapter-Strategie; UI-Layout-Änderungen bleiben außen vor.
Entwurfsleitlinien (Planung):
- Beschreibe `ModalLifecycleAdapter` mit `open`, `onResolve`, `onAbort` Hooks.
- Plane Migrationsschritte: Legacy `new Modal()` Aufrufe werden auf Adapter verlagert.
- Definiere Abort-Policy bei Mode-Wechsel (z. B. Cancel + Telemetrie-Eintrag).
- Dokumentiere Kill-Switch (`modal.lifecycle.enabled`) zur Rückkehr zu Legacy.
Abhängigkeiten: LIB-TD-0007, LIB-TD-0006.
Risiken & Mitigation:
- Vergessene Modalpfade → Inventarliste aller `new Create*Modal`-Stellen erstellen.
- Nutzer verliert ungespeicherte Daten → Auto-Draft/Prompt-Konzept prüfen.
Test-Impact & Ankermuster:
- Lifecycle-Kontrakt-Tests mit simulierten Mode-Wechseln.
- Regressionstests: Modal öffnen/schließen während Watcher-Events.
Messgrößen (Erfolg):
- 100% der Modals melden `dispose` beim Kernel.
- Keine offenen Debounce-Timer nach Mode-Wechsel (gemessen via Test-Harness).
Akzeptanzkriterien:
  DoR (Ready für Phase 4): Adapter-API, Inventarliste, Abort-Policy dokumentiert.
  DoD (für Phase 4): Alle Modals nutzen Adapter, Lifecycle-Tests grün, Kill-Switch verifiziert.
Aufwand (T-Shirt): M
Priorität (Score): 24
Open Questions: Wie gehen wir mit parallel geöffneten Modals (z. B. Item + Creature) um?

## Epic B: Shared Kernels & Templates

### Work Package WP-B1: Renderer Kernel Einführung

ID: LIB-TD-0005
Titel (imperativ): Baue Renderer-Kernel mit Lifecycle-Orchestrierung
Kategorie: Renderer
Bezug (Trace): Debts: D-LIB-001, D-LIB-008; Risks: R-LIB-001, R-LIB-007; ADR: ADR-0002; WP: WP-B1
Problem (Ist): Jeder Renderer implementiert Query-, Pagination- und Cleanup-Logik individuell; Lifecycle (render/setQuery/destroy) ist inkonsistent und teilweise asynchron.
Zielzustand (Soll/Contract): Gemeinsamer Kernel stellt synchronisierte Lifecycle-Hooks (`bootstrap`, `connect`, `handleQuery`, `handleEvent`, `dispose`) bereit und garantiert Cleanup + Kill-Switch-Handhabung.
Scope & Out-of-Scope: Enthält Kernel-API, Plugin-Schnittstellen und Error-Handling; UI-Templates bleiben unberührt.
Entwurfsleitlinien (Planung):
- Plane Modulstruktur (`src/apps/library/core/renderer-kernel`) mit generischen State-Maschinen.
- Definiere Plugin-Contracts pro View-Typ (Listen, Tabellen, Codeblocks).
- Beschreibe Integration in Application-Service-Port (LIB-TD-0003) und Event-Bus (LIB-TD-0007).
- Skizziere Kill-Switch/Telemetry-Einbindung (`renderer.v2.enabled`).
Abhängigkeiten: LIB-TD-0003, LIB-TD-0001.
Risiken & Mitigation:
- Übergeneralisierung → Proof-of-Concept mit CreaturesRenderer planen.
- Performance-Kosten → Profiling-Plan (before/after) definieren.
Test-Impact & Ankermuster:
- Kernel-Vertragstests (Lifecycle, Error-Handling, Kill-Switch).
- Regression: Vergleich Legacy vs. Kernel-Render-Ausgabe via Harness.
Messgrößen (Erfolg):
- Reduktion Renderer-spezifischer LOC um ≥ 25%.
- Keine `async render()` Implementierungen mehr.
Akzeptanzkriterien:
  DoR (Ready für Phase 4): Kernel-API, Plugin-Typen, Telemetrie-Konzept dokumentiert.
  DoD (für Phase 4): Kernel implementiert, CreaturesRenderer erfolgreich migriert, Tests grün.
Aufwand (T-Shirt): L
Priorität (Score): 20
Open Questions: Benötigen wir unterschiedliche Kernel-Pipelines für Listen vs. Codeblock-Renderer?

ID: LIB-TD-0006
Titel (imperativ): Migriere Bibliotheksrenderer auf Kernel-Plugins
Kategorie: Renderer
Bezug (Trace): Debts: D-LIB-001, D-LIB-002, D-LIB-008; Risks: R-LIB-001, R-LIB-005, R-LIB-007; ADR: ADR-0002; WP: WP-B1
Problem (Ist): Render-Implementierungen duplizieren Query-, Sortier- und Lifecycle-Logik, nutzen manuelle YAML-Pfade und hängen direkt an DOM/IO.
Zielzustand (Soll/Contract): Alle Renderer nutzen Kernel-Plugins mit klaren `supportsQuery`, `renderView`, `bindEvents` Policies und beziehen Daten ausschließlich über Application-Service-Port.
Scope & Out-of-Scope: Enthält Plugin-Mappings für Creatures, Items, Equipment, Terrains, Regions; ausgenommen sind Nicht-Library-Apps.
Entwurfsleitlinien (Planung):
- Erstelle Migrations-Backlog pro Renderer (Legacy-Analyse, Plugin-Schnittstellen, Tests).
- Plane Parallelbetrieb (Legacy vs. Kernel) via Feature-Flag & Telemetrie Paritätszähler.
- Definiere Mapping von Legacy Helpern auf neue Shared Components (Filter/Sort aus LIB-TD-0013).
- Dokumentiere Rollback-Prozedur (Rebind auf Legacy Factory).
Abhängigkeiten: LIB-TD-0005, LIB-TD-0003, LIB-TD-0004.
Risiken & Mitigation:
- Funktionale Regressionen → Golden/Contract-Tests als Gate.
- Schulungsbedarf im Team → Knowledge-Sharing-Session einplanen.
Test-Impact & Ankermuster:
- Renderer-Vertrags- und Regressionstests pro Plugin.
- Visual Diff Tests via Harness (DOM-Snapshot oder HTML-String).
Messgrößen (Erfolg):
- ≥ 30% Reduktion Renderer-spezifischer Dateien.
- Telemetrie: ≤ 1% Legacy-Fallback nach 2 Release-Zyklen.
Akzeptanzkriterien:
  DoR (Ready für Phase 4): Plugin-Migrationsplan je Renderer, Flag-Strategie, Testplan freigegeben.
  DoD (für Phase 4): Alle Renderer laufen über Kernel, Legacy deaktiviert, Paritätsmetriken stabil.
Aufwand (T-Shirt): L
Priorität (Score): 15
Open Questions: Welche Renderer benötigen dedizierte Offline-Modi (z. B. Preset-Lesen ohne Service)?

### Work Package WP-B2: Serializer Template & Validation DSL

ID: LIB-TD-0009
Titel (imperativ): Implementiere Serializer-Template-Policies
Kategorie: Serializer
Bezug (Trace): Debts: D-LIB-002, D-LIB-012; Risks: R-LIB-002, R-LIB-005; ADR: ADR-0003; WP: WP-B2
Problem (Ist): Serialisierer sind monolithische Dateien (z. B. `creature-files.ts`), Policy-Logik ist verstreut und schwer testbar.
Zielzustand (Soll/Contract): Serializer-Template bietet deklarative Policy-Liste (Defaults, Migration, Validation) je Domain, unterstützt Dry-Run und Versionierung.
Scope & Out-of-Scope: In Scope ist Template-Design inkl. Policy-Schema; Out-of-Scope ist tatsächliche Portierung einzelner Domains.
Entwurfsleitlinien (Planung):
- Definiere Policy-Schema (`field`, `required`, `defaultValue`, `migrate`, `validate`).
- Plane Template-Modulstruktur (`serializer-template/` + TypeScript-Typen).
- Beschreibe Integration mit StoragePort (Dry-Run, Versionierung) und Telemetrie (Migration-Logs).
- Dokumentiere Migrationsleitfaden für bestehende Serializer.
Abhängigkeiten: LIB-TD-0001, LIB-TD-0004.
Risiken & Mitigation:
- Zu starres Schema → Erweiterungspunkte (Custom Transformers) einplanen.
- Versionierungskonflikte → SemVer-Regeln klar definieren.
Test-Impact & Ankermuster:
- Template-Einheitstests inkl. Property-basierten Checks.
- Golden-Roundtrip-Tests (via LIB-TD-0002) zur Verifikation.
Messgrößen (Erfolg):
- Template deckt ≥ 5 Policy-Typen ab.
- Reduktion einzelner Serializer-Dateien um ≥ 30% nach Portierung.
Akzeptanzkriterien:
  DoR (Ready für Phase 4): Policy-Schema, Template-API, Migration-Guide abgestimmt.
  DoD (für Phase 4): Template implementiert, Tests grün, Dokumentation vorhanden.
Aufwand (T-Shirt): M
Priorität (Score): 27
Open Questions: Welche Sonderfelder (z. B. Spellcasting JSON) benötigen Custom-Transformer?

ID: LIB-TD-0010
Titel (imperativ): Portiere Creature/Item/Equipment-Serializer auf Template
Kategorie: Serializer
Bezug (Trace): Debts: D-LIB-002, D-LIB-004, D-LIB-005, D-LIB-006, D-LIB-007, D-LIB-012; Risks: R-LIB-002, R-LIB-005; ADR: ADR-0003; WP: WP-B2
Problem (Ist): Serializer nutzen individuelle Implementierungen, importieren dynamisch (`import()` in Items/Equipment) und werfen Parse-Fehler nicht durch.
Zielzustand (Soll/Contract): Alle Serializer nutzen Template-Policies, führen statische Imports aus und werfen strukturierte Fehler/Telemetry.
Scope & Out-of-Scope: Enthält Portierungsplan pro Domain inkl. Legacy-Bridge; Spell-Serializer optional.
Entwurfsleitlinien (Planung):
- Sequenziere Portierung (Creatures → Items → Equipment) mit Telemetrie-Dual-Writes.
- Plane Kill-Switch (`serializer.template.enabled`) je Domain.
- Beschreibe Umgang mit Legacy-Files (Migration-Scripts, Backup-Plan).
- Stelle sicher, dass Modal-Formen Template-Validierung verwenden (Schnittstelle zur Validation-DSL, LIB-TD-0011).
Abhängigkeiten: LIB-TD-0009, LIB-TD-0004, LIB-TD-0003.
Risiken & Mitigation:
- Datenverlust durch falsche Migration → Dry-Run & Golden-Diff Pflicht.
- Bundle-Aufblähung durch Duplikate → Review import-Pfade, Tree-Shaking-Konzept.
Test-Impact & Ankermuster:
- Golden-Roundtrip- und Property-Tests pro Domain.
- Regressionstests für Import/Export-UI-Flows via Harness.
Messgrößen (Erfolg):
- Entfernen aller dynamischen Serializer-Imports.
- Fehlerschleifen melden strukturierte Codes, keine Silent-Fails.
Akzeptanzkriterien:
  DoR (Ready für Phase 4): Portierungsplan, Kill-Switch-Konzept, Backup-Strategie dokumentiert.
  DoD (für Phase 4): Alle drei Domains laufen über Template, Legacy deaktiviert, Golden-Tests grün.
Aufwand (T-Shirt): L
Priorität (Score): 15
Open Questions: Wie behandeln wir benutzerdefinierte Markdown-Abschnitte, die nicht im Schema liegen?

ID: LIB-TD-0011
Titel (imperativ): Führe Validation-DSL für Domain-Daten ein
Kategorie: Validation
Bezug (Trace): Debts: D-LIB-009; Risks: R-LIB-002, R-LIB-006; ADR: ADR-0003; WP: WP-B2
Problem (Ist): Validierungen (z. B. Encounter Odds) sind manuell und liefern bei Fehlern `undefined` ohne Nutzerfeedback.
Zielzustand (Soll/Contract): Validation-DSL beschreibt Regeln deklarativ, liefert Fehlerobjekte `{ field, message, code }` und wird in Serializer-Template & UI-Modals geteilt.
Scope & Out-of-Scope: Enthält DSL-Design, Fehlerkatalog und Integrationsplan; Out-of-Scope sind UI-Textänderungen (nur bestehende Meldungen nutzen).
Entwurfsleitlinien (Planung):
- Definiere Regeltypen (NumericalRange, Enum, DependentFields, CustomPredicate).
- Plane Integration in Template (`policy.validate`) und Modal-Formen (`validateField`).
- Dokumentiere Mapping von Fehlercodes zu UI-Feedback.
- Beschreibe Property-Test-Strategie (fast-check) für kritische Regeln.
Abhängigkeiten: LIB-TD-0009, LIB-TD-0001.
Risiken & Mitigation:
- Fehlkonfiguration der Regeln → Peer-Review-Checkliste einplanen.
- UI-Noise durch zu viele Meldungen → Severity-Level & Debounce definieren.
Test-Impact & Ankermuster:
- Property-basierte Tests für Encounter-Odds, Terrain-Speed, Spell-Scaling.
- Contract-Tests sicherstellen einheitliche Fehlerobjekte.
Messgrößen (Erfolg):
- 100% der Domain-Validierungen laufen über DSL.
- Keine stillen `undefined` Werte mehr in Encounter Odds.
Akzeptanzkriterien:
  DoR (Ready für Phase 4): DSL-Schema, Fehlerkatalog, Integrationspunkte dokumentiert.
  DoD (für Phase 4): DSL implementiert, Tests grün, Renderer/Modals konsumieren DSL.
Aufwand (T-Shirt): M
Priorität (Score): 24
Open Questions: Welche bestehenden Validierungs-Meldungen müssen für Mehrsprachigkeit parametrisiert werden?

ID: LIB-TD-0012
Titel (imperativ): Härte Preset-Import über Storage-Service ab
Kategorie: Persistenz/IO
Bezug (Trace): Debts: D-LIB-010; Risks: R-LIB-003; ADR: ADR-0003; WP: WP-B2
Problem (Ist): `shouldImportPluginPresets` meldet Erfolg trotz Marker-Fehlern; wiederholte Importe erzeugen Duplikate.
Zielzustand (Soll/Contract): Preset-Import nutzt StoragePort mit atomaren Marker-Operationen, Telemetrie bei Fehlversuch und Dry-Run-Möglichkeit.
Scope & Out-of-Scope: Enthält Import-Workflow, Marker-Verwaltung, Telemetrie; keine neuen Preset-Typen.
Entwurfsleitlinien (Planung):
- Plane Marker-API (`createMarker`, `verifyMarker`) mit idempotenten Operationen.
- Beschreibe Dry-Run-Modus: Import führt nur Validierung + Telemetrie aus.
- Definiere Fehlerbehandlung (Retry-Strategien, Backoff) und Kill-Switch.
- Dokumentiere Backups vor Preset-Reimport.
Abhängigkeiten: LIB-TD-0004, LIB-TD-0009.
Risiken & Mitigation:
- Race-Conditions bei parallelen Imports → Locking-Konzept entwerfen.
- Marker-Dateien unzugänglich → Fallback auf in-memory Marker + Warnung.
Test-Impact & Ankermuster:
- Storage-Port-Tests für Marker-Operationen.
- Regressionstest: Import bei fehlgeschlagenem Marker erzeugt keine Duplikate.
Messgrößen (Erfolg):
- Marker-Fehler führen zu Telemetrie + Abbruch (0% Silent-Success).
- Wiederholte Starts erzeugen keine Preset-Duplikate im Dry-Run.
Akzeptanzkriterien:
  DoR (Ready für Phase 4): Marker-Workflow, Retry-Strategie, Telemetrie-Plan dokumentiert.
  DoD (für Phase 4): Import nutzt StoragePort, Telemetrie aktiv, Tests grün.
Aufwand (T-Shirt): M
Priorität (Score): 24
Open Questions: Müssen bestehende Marker-Dateien migriert oder nur validiert werden?

## Epic C: Konsolidierung & Cleanup

### Work Package WP-C1: Filter/Sort/Search Pipeline

ID: LIB-TD-0013
Titel (imperativ): Vereinheitliche Query- und Filter-Pipeline
Kategorie: Architektur
Bezug (Trace): Debts: D-LIB-001, D-LIB-002; Risks: R-LIB-001, R-LIB-005; ADR: ADR-0002; WP: WP-C1
Problem (Ist): Jede Renderer-Liste verwaltet eigene Filter-/Sortier-Utilities; Query-Verhalten unterscheidet sich und kopiert Codeblöcke.
Zielzustand (Soll/Contract): Gemeinsame Pipeline liefert deterministisches Filtering/Sorting/Search, wird vom Renderer-Kernel konsumiert und kann Domain-spezifische Plugins laden.
Scope & Out-of-Scope: In Scope ist Pipeline-Design inkl. Plugin-Hooks; Out-of-Scope sind UI-Änderungen (Filter-Widgets bleiben).
Entwurfsleitlinien (Planung):
- Modellieren Query-DSL (`term`, `tags`, `type`) mit Parser und Normalizer.
- Plane Domain-spezifische Filter-Plugins (Creatures Stats, Item Rarity etc.).
- Beschreibe Performance-Metriken und Caching-Strategie (Memoization, incremental updates).
- Dokumentiere Migration: Legacy Utils deprecaten, Kernel-Pipeline injizieren.
Abhängigkeiten: LIB-TD-0005, LIB-TD-0003.
Risiken & Mitigation:
- Edge-Cases (z. B. Regex) verlieren Support → Regression-Suite mit Golden-Queries.
- Performance-Einbruch bei großen Listen → Benchmark-Plan (1k Items) definieren.
Test-Impact & Ankermuster:
- Property-Tests (idempotente Filter, sort stability).
- Golden-Query-Set (z. B. Top 20 Suchbegriffe) gegen Legacy vergleichen.
Messgrößen (Erfolg):
- Entfernen von ≥ 5 duplizierten Utility-Funktionen.
- Query-Latenz ≤ Legacy ±10% bei 1k Items.
Akzeptanzkriterien:
  DoR (Ready für Phase 4): Query-DSL, Plugin-Schnittstellen, Benchmark-Plan abgestimmt.
  DoD (für Phase 4): Pipeline implementiert, Legacy Utils entfernt, Regressionen grün.
Aufwand (T-Shirt): M
Priorität (Score): 18
Open Questions: Benötigen wir Ranking-Boosts (z. B. Favoriten) im gemeinsamen Modell?

### Work Package WP-C2: Store Simplification

ID: LIB-TD-0014
Titel (imperativ): Straffe Library-Stores und Watcher-States
Kategorie: Architektur
Bezug (Trace): Debts: D-LIB-008; Risks: R-LIB-004; ADR: ADR-0004; WP: WP-C2
Problem (Ist): Terrain/Region-Stores halten doppelte Dirty-Flags und Debounce-Timer; Events verteilen sich über mehrere Helper.
Zielzustand (Soll/Contract): Stores erhalten Events ausschließlich über Event-Bus, verwalten Dirty-State zentral und unterstützen deterministisches Flush-Verhalten.
Scope & Out-of-Scope: In Scope sind Store-Zuschnitt, Removal alter Helper, Telemetrie-Kennzahlen; Out-of-Scope ist UI-Kopplung.
Entwurfsleitlinien (Planung):
- Inventarisiere bestehende Stores/Helper, mappe auf neue Event-Bus-Themen.
- Plane Dirty-State-Maschine (states: clean, dirty, flushing) mit Transitionstabellen.
- Beschreibe Flush-Policy (`flushSave` Trigger) inkl. Kill-Switch.
- Dokumentiere Rollback (Legacy Helper modul wieder aktivierbar).
Abhängigkeiten: LIB-TD-0007, LIB-TD-0005.
Risiken & Mitigation:
- Fehlende Events nach Simplifizierung → Monitoring (Telemetry) + Shadow-Mode.
- Datenverlust bei Flush → Backup + Regressionstests (Debounce-Szenarien).
Test-Impact & Ankermuster:
- State-Machine-Tests für Dirty/Flush.
- Chaos-Tests (rapid switches, event storms).
Messgrößen (Erfolg):
- Reduktion der Store-Dateien um ≥ 20% LOC.
- Keine verlorenen Debounce-Saves mehr in Tests.
Akzeptanzkriterien:
  DoR (Ready für Phase 4): State-Machine-Design, Event-Mapping, Kill-Switch dokumentiert.
  DoD (für Phase 4): Stores vereinfacht, Dirty-States zentral, Tests grün.
Aufwand (T-Shirt): M
Priorität (Score): 20
Open Questions: Müssen wir Legacy-Debounce-Dauern beibehalten oder können wir konfigurieren?

ID: LIB-TD-0015
Titel (imperativ): Entferne Debug-Logging und obsolet gewordene Watcher-Hooks
Kategorie: Cleanup
Bezug (Trace): Debts: D-LIB-003, D-LIB-008; Risks: R-LIB-004; ADR: ADR-0004; WP: WP-C2
Problem (Ist): CreaturesRenderer loggt Metadaten bei jedem Render; Watcher-Helfer behalten alte Listener, was Debugging erschwert und Latenzen erzeugt.
Zielzustand (Soll/Contract): Logging folgt Telemetrie-Policy (Sampling, Level), veraltete Watcher-Hooks werden entfernt oder durch Event-Bus ersetzt.
Scope & Out-of-Scope: In Scope ist Logging-/Watcher-Aufräumplan; Out-of-Scope sind neue Telemetrie-Features (durch LIB-TD-0016 abgedeckt).
Entwurfsleitlinien (Planung):
- Identifiziere Debug-Logs & Alarme, ordne neuen Telemetrie-Leveln zu.
- Plane Entfernung redundanter Watcher-Registrierungen nach Store-Konsolidierung.
- Beschreibe Review-Checklist zur Sicherstellung, dass keine funktionalen Logs verschwinden.
Abhängigkeiten: LIB-TD-0007, LIB-TD-0014.
Risiken & Mitigation:
- Verlust hilfreicher Diagnosen → Ersatz via Telemetrie-Ereignisse definieren.
- Unentdeckte Rest-Logs → Static Analysis (`eslint` Rule) planen.
Test-Impact & Ankermuster:
- Smoke-Tests sichern, dass keine Watcher mehr doppelt feuern.
- Lint-Regel-Tests für verbotene Logger-Aufrufe.
Messgrößen (Erfolg):
- 0 ungefilterte `console.log` im Library-Code.
- Reduzierte Event-Doppelung in Chaos-Tests (≤ 1%).
Akzeptanzkriterien:
  DoR (Ready für Phase 4): Liste der zu entfernenden Logs/Watcher, Telemetrie-Ersatzplan vorhanden.
  DoD (für Phase 4): Logs entfernt/ersetzt, Static-Analysis-Regel aktiv, Tests grün.
Aufwand (T-Shirt): S
Priorität (Score): 16
Open Questions: Müssen wir temporäre Debug-Flags für QA beibehalten?

## Epic D: Test & Rollout Enablement (Fortsetzung)

### Work Package WP-D2: Telemetry & Kill Switches

ID: LIB-TD-0016
Titel (imperativ): Etabliere Feature-Flag-Registry und Paritäts-Telemetrie
Kategorie: Build/Infra
Bezug (Trace): Risks: R-LIB-001, R-LIB-003, R-LIB-004; ADR: ADR-0002, ADR-0003, ADR-0004; WP: WP-D2
Problem (Ist): Es existiert keine zentrale Verwaltung für Feature-Flags/Kill-Switches; Telemetrie zur Paritätsprüfung ist ad hoc.
Zielzustand (Soll/Contract): Feature-Flag-Registry verwaltet Flags (`renderer.v2.enabled`, `serializer.template.enabled`, etc.) mit Remote-Override; Telemetrie liefert Paritätszähler und Divergenz-Alarme.
Scope & Out-of-Scope: In Scope sind Registry-Design, Konfigurations-Dateiformat, Telemetrie-Events; Out-of-Scope ist Backend-Anbindung außerhalb Obsidian.
Entwurfsleitlinien (Planung):
- Plane Registry-Modul (Singleton oder DI) mit statischer Konfiguration + Override-Mechanismus.
- Beschreibe Telemetrie-Schema (Counters, Divergenz-Schwellen) und Dashboard-Export.
- Definiere Rollout-Checkliste (Flag-Etablierung, Default-Werte, QA-Playbook).
- Dokumentiere Sicherheitsmaßnahmen (Fail-Closed Verhalten bei Flag-Ladefehlern).
Abhängigkeiten: LIB-TD-0005, LIB-TD-0009, LIB-TD-0007.
Risiken & Mitigation:
- Flags werden inkonsistent gelesen → Provide Type-Safe Accessor API.
- Telemetrie erzeugt Overhead → Sampling-Strategie und Rate-Limits planen.
Test-Impact & Ankermuster:
- Contract-Tests für Flag-API (Default, Override, Kill-Switch).
- Integrationstests für Telemetrie-Paritätszähler (Legacy vs. v2 Pfade).
Messgrößen (Erfolg):
- Alle neuen Pfade nutzen Registry (0 direkte Flag-Strings).
- Paritätsmetriken zeigen Divergenz < 1% nach Rollout.
Akzeptanzkriterien:
  DoR (Ready für Phase 4): Flag-Liste, Override-Strategie, Telemetrie-Schema dokumentiert.
  DoD (für Phase 4): Registry implementiert, Flags integriert, Telemetrie sendet Daten.
Aufwand (T-Shirt): M
Priorität (Score): 21
Open Questions: Müssen Flags zur Laufzeit persistiert werden (z. B. in Workspace-Settings)?
