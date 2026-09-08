# Ausführung der Release- und Wartungsroadmap

Kanonisch: [Roadmap](project/architecture/release-maintenance-roadmap.md).
Ergänzende Detailanforderungen: [Zielzustand](project/architecture/release-maintenance-target.md).

## Ausgangspunkt — 2026-09-08

- Aktueller und entfernter main: `4bd78927b80079142597d4b8c310cfd580ed74c2`, nach `git fetch origin` bestätigt.
- Sauberer Ausgangsarbeitsbaum; neuer Kandidat `candidate/unified-maintenance-roadmap`.
- AGENTS.md gelesen. Vollständige bestehende CI- und Handoff-Regeln bleiben verbindlich.
- Vorhandene Implementierung zählt nicht ohne Prüfung als erfüllte Roadmapphase.

| Phase | Status    |
| ----- | --------- |
| 1     | abgeschlossen |
| 2     | in Arbeit |
| 3–7   | offen |

## Phase 1 — Plan, vor Änderungen

Ergebnis: verbindliche Version und zweigeteilter Datenvertrag, nachvollziehbare
Zuständigkeiten und vollständige Abnahmematrix mit konkreten Nachweislücken.

Komponenten: Dokumentation unter docs/project/architecture und docs/project/contract;
Release-Dokumentation. Keine Änderung des Wartungsverhaltens in dieser Phase.

Reihenfolge:

1. Originalroadmap und ergänzenden Zielzustand unverändert sichern.
2. Version/Tag und aktuelle Schema-/Fixturestände prüfen.
3. Datenformat und sichere Quellübernahme getrennt festlegen; unbekannte Altstände
   nicht als unterstützt zusagen.
4. Journalbesitzer und zu ersetzende Abläufe zuordnen.
5. Abnahmematrix mit vorhandenen Tests, fehlenden Tests und Vergleichsständen festhalten.
6. Dokumentformatierung, Referenzen und relevante vorhandene Basistests prüfen;
   Gesamtabschluss der Dokumentänderungen zusätzlich mit pnpm check nach AGENTS.md.
7. Separates Audit gegen diesen Plan und die kanonische Phase 1 dokumentieren.

Abnahme: Jede Zusage hat einen identifizierbaren Testfall; vorhandene Tests und
zukünftig nötige Nachweise werden unterschieden. Entscheidungen stimmen mit den
Quellen überein. Keine Behauptung erfolgreicher öffentlicher Freigabe.

### Erhobene Evidenz

GitHub API: matching-refs/tags/v0.3.0 liefert []; releases/tags/v0.3.0 liefert 404.
0.3.0 wird als Ziel gewählt; erneute Prüfung vor Tag-/Release-Erstellung bleibt nötig.
Fixture tests/fixtures/release-0.2.0/manifest.json nennt Installation 39/Kampagne 34.
release-baseline.test.ts prüft diesen aktuellen Stand und vorhandene Pfadauflösung,
keinen realen historischen AppImage-Schemawechsel.
controller.ts importProfile prüft SingletonLock und eine abgeleitete runtime.lock;
das belegt noch keine gemeinsame Sperre aller angebotenen Altanwendungen.

### Validation round 1

Command: pnpm exec vitest run tests/integration/release-baseline.test.ts
tests/integration/release-maintenance.test.ts tests/integration/release-recovery.test.ts
tests/unit/installed-profile-readbacks.test.ts --maxWorkers=2.
Result: 4 files, 24 tests passed (2026-09-08). These are baseline evidence only.

Audit against Phase 1 plan: canonical source and detailed target persisted;
compatibility split, owner mapping, fixture selection and M01–M23 matrix recorded.
Audit against roadmap: initial discrepancy was stale public-first-release wording
in docs/releases/0.2.0.md and release-process.md. Corrective plan: retain historical
notes, label their status accurately, point to 0.3.0 target and explain that package
version is updated alongside Phase 6 baseline tooling. Those corrections are applied.
No runtime behavior or publication status is inferred from the documentation.

Remaining validation before closing Phase 1: full pnpm check required by AGENTS.md;
check internal links and original source fidelity. No later phase started.

## Phase 1 — Abschlussaudit, 2026-09-08

`pnpm check` auf unverändertem Commit `8e8b335a2b83a6a78a495254986ca32ec05b9abd`
ist mit Exit 0 beendet. Local-check run `7e053beb-475d-4a29-973a-86543fa81266`
meldet alle fünf Phasen completed: 91 Architektur-, 823 portable Unit-,
241 Integrations- und 34 Linux-Tests; Build, Smoke und Bundlebudget; alle
18 funktionalen und 7 visuellen Suiten. Gesamtdauer rund 39 Minuten 41 Sekunden.
Logs: work/roadmap-phase1-check.log im übergeordneten Aufgabenordner.
GitHub Check [34210249425](https://github.com/ThonkTank/Salt-Marcher/actions/runs/34210249425)
ist ebenfalls vollständig erfolgreich. PR: #661 (Entwurf).

Interne Markdown-Referenzen geprüft; gespeicherter Zielzustand ist bytegleich mit
dem Nutzeranhang. Separates Audit gegen Phase-1-Plan: bestanden. Audit gegen
kanonische Roadmap Phase 1: bestanden; jede Zusage hat M01–M23 als konkreten
Abnahmefall, bestehende Evidenz wird von noch nötiger Qualifikation getrennt.
Kein Laufzeitverhalten wurde geändert oder als neu qualifiziert ausgegeben.

Historische Vergleichsstände anhand ihrer database.ts verbindlich ausgewählt:

- A: `52a0cc28cdb332406a4d03e0a14cc005eb7a0ff0`, Installation 37 / Kampagne 34.
- B: `6e84a12c1c83cd6437680ae70529cdc9723c353b`, Installation 38 / Kampagne 34.
- C: `c583e05506e10d8446a4e210fa0603e3be53d63a`, Installation 39 / Kampagne 34.

37→38 ergänzt Registry-Revision, 38→39 Befehlsbelege. Verpackung und
AppImage-Harness dieser historischen Stände bleiben Phase 5; keine erfundenen
Produktionsmigrationen. Ergänzend bleibt Kampagne 30→31 ein fachlicher Prüffall.

Die Codeprüfung bestätigt M04/M05 zusätzlich: Local campaign-migration.ts entfernt
seinen Rollbackstand bereits bei data-promoted; Local recovery.ts entscheidet
Programmabschluss separat anhand Symlink und Ersetzungsdateien. Release verwendet
Datenjournal v1 und Aktivierungsjournal v1 samt eingebettetem Launcher-Fallback.
Diese bisherigen Entscheidungsstellen sind in Phase 2 vollständig abzulösen.

## Phase 2 — Plan vor Implementierung

Ergebnis: ein versionierter, maßgeblicher Wartungszustand bindet alte/neue
Programmversion, Profil, Sicherung und Freigabe. Local und Release verwenden
identische Zustandsübergänge. Alte Journale werden vor neuen Transaktionen
abgearbeitet. Nach dauerhaftem Commit keine automatische Rücksetzung.

Betroffene Komponenten: shared/maintenance (Koordinator und Journalvertrag),
core/maintenance (Utility-Datenarbeit), main/release (Prozess-/Programm-Adapter),
utility/maintenance (validierte Arbeitsaufträge), scripts/local-installation und
local-app-installation (Local-Adapter), Lifecycle/Launcher und passende Tests.
SQL bleibt bei den existierenden Datenbankverantwortlichen.

Implementierungsreihenfolge:

1. Strikten gemeinsamen Journalvertrag und Dateisystem-Koordinator einführen:
   vorbereitete Daten und Programmidentität, dauerhafte Absichten vor jedem Move,
   idempotente Recovery auch nach Unterbrechung der Recovery selbst.
2. Profil-Sicherung/Migration von Aktivierungsentscheidungen lösen; Utility liefert
   validierte Arbeitskopie/Sicherungsmetadaten, Koordinator besitzt Veröffentlichung.
3. Release-Prozesse, Startprüfung und Launcher auf eine Entscheidungsquelle umstellen;
   Wiederherstellung verwendet das bestehende Deployment.
4. Local-Installer/Handoff auf denselben Koordinator umstellen, vorheriges Paar bis
   erfolgreicher Zielruntime-Prüfung erhalten; Provenienzbelege getrennt lassen.
5. Eng begrenzte Legacy-Journalübernahme implementieren und alte aktive
   Orchestrierungs-/Recovery-Wege entfernen.
6. Gemeinsame Fehlerfallmatrix für Local und Release, echte Profil-/Recovery-Tests,
   Typen/Lint/Build und betroffene Installer-/Handoff-Tests ausführen.
7. Separates Audit gegen Plan und Roadmap, dokumentierte Korrekturrunden bei Lücken.

Abnahme: M04/M05/M06/M12, inklusive vor/nach jedem Aktivierungsschritt,
Unterbrechungen beim Zurücksetzen, erster Installation ohne vorheriges Paar,
festgeschriebener späterer Änderungen, alter Journale und unveränderter
Deploymentidentität bei Wiederherstellung. Gemeinsame Backup-/Prüfgarantien bleiben.
Der endgültige genaue CI-/AppImage-Handoff und die Main-Promotion erfolgen nach
der zusammenhängenden Implementierung gemäß AGENTS.md; Phasenprüfungen ersetzen
keine spätere öffentliche Release-Abnahme.

### Phase 2 — Implementierungsrunde 1

Gemeinsamer Journalvertrag v2 und MaintenanceCoordinator hinzugefügt. Ein Journal
bindet Datenbewegung, Programmzeiger, vorheriges Deployment, Sicherungs-ID und
Transaktionskennung. Vor jedem Daten-/Programmübergang steht eine dauerhafte
Absicht. Rücksetzung besitzt eigene Zustände für Erhalt des fehlgeschlagenen
Datenstands, Wiederherstellung und Programmwechsel. Committed bleibt terminal;
spätere Änderungen werden nicht automatisch zurückgesetzt. Keine alte
Daten-/Programmversion wird dabei automatisch gelöscht.

Validierung: pnpm exec vitest run tests/unit/maintenance-coordinator.test.ts
--maxWorkers=2: 44 Tests bestanden. Beide Kanalvarianten durchlaufen dieselbe
Fehlermatrix; Unterbrechungen bei Aktivierung und Recovery, leere Erstinstallation,
Commit-Abbruch, falsches Token und veränderte Programmbytes sind abgedeckt.
Diese Tests qualifizieren den gemeinsamen Koordinator, noch nicht die Adapter.

Zwischenaudit gegen Plan: Schritt 1 als Grundlage vorhanden. Schritte 2–5
(Utility/Release/Local/Legacy-Anbindung) weiterhin offen. Phase 2 ist nicht
abgeschlossen; bisherige Laufzeitabläufe sind noch aktiv. Vollständige Integration
und ihre Tests sind Voraussetzung für den Phasenabschluss.

### Phase 2 — Korrekturrunde 1, Plan vor Änderung

Lint findet nach Umstellung der Recovery auf synchrone Journal-/Dateiarbeit einen
unnötigen await im Controller. Korrektur: alle Aufrufer von recoverRelease,
completeRelease und rollbackRelease im Controller/Lifecycle auf die tatsächliche
synchrone Schnittstelle anpassen. Bestehende asynchrone Core-Bereitschafts- und
Schließbarrieren bleiben erhalten. Danach betroffene Lint-/Typprüfungen wiederholen.

### Phase 2 — Korrekturrunde 2, Plan vor Änderung

Der Launcher-Test liest sein Manifest untypisiert mit JSON.parse; Lint lehnt
unsichere Zugriffe ab. Korrektur: denselben strikten Release-Manifestparser wie
Produktion verwenden; anschließend Lint, Typen und Release-Tests erneut prüfen.
Keine Änderung der erwarteten Sicherheitsgrenzen oder Abschwächung der Prüfung.

### Phase 2 — Implementierungsrunde 2 und Zwischenaudit

Release-Anbindung umgesetzt: ProfileMaintenance erzeugt Sicherung und geprüfte
Arbeitskopie, aktiviert aber keine Live-Daten. Main bindet diese Vorbereitung an
das gemeinsame Journal, aktiviert mit MaintenanceCoordinator und bestätigt erst
nach Zielruntime-Bereitschaft. Utility-Aufträge und Vorbereitungsergebnisse sind
an beiden Grenzen strikt validiert und tragen die Transaktionskennung.

Die frühere aktive ProfileTransaction und beginActivation wurden entfernt.
Legacy-Datenjournal v1 und activation.json werden ausschließlich durch die
begrenzte Übernahme gelesen/archiviert; danach entscheidet Journal v2 allein.
Bereits bestätigte Legacy-Daten werden nicht zurückgesetzt. Der stabile Launcher
liest den Rückfall aus dem maßgeblichen Journal und führt nach committed keinen
Fallback aus. Restore verwendet currentProgram statt ein weiteres Deployment
anzulegen. Speicherbedarf berücksichtigt aktuellen und eingehenden Datenstand.

Validierung: 155 Tests in 14 Dateien bestanden (Architektur, Koordinator,
Release-Vertrag/Transport/Launcher/Baseline/Profil/Recovery/Controller).
Korrekturrunden 1 und 2: betroffener ESLint-Lauf und beide TypeScript-Projekte
erfolgreich. Development-Build erfolgreich; kein Release-/Handoff-Nachweis.
Controller-Test verwendet echten Profilspeicher mit simuliertem Zielprozess;
er ersetzt ausdrücklich keinen Zwei-AppImage-Test.

Audit gegen Phase-2-Plan: Release-Anbindung und Legacy-Release-Übernahme vorhanden;
Local-Adapter, Legacy-Local-Journalübernahme und gemeinsame Startfreigabe dort noch
offen. Die 44 kanalparametrisierten Koordinatortests allein beweisen noch keine
Local-Installer-Anbindung. Phase 2 bleibt offen.

Konkrete Local-Anbindungspunkte aus der Codeprüfung:
- local-app-installation.ts: Backup-/Deployment-Provenienz darf weiterbestehen,
  Daten-/Programm-Recovery muss an den gemeinsamen Koordinator übergehen.
- installed-runtime-verification.ts: bisheriger Smoke-Aufruf braucht die passende
  Wartungskennung für Startbestätigung; normale Nutzung darf vorher nicht starten.
- application-lifecycle/application.ts: Local muss pending Wartung ebenfalls vor
  Core-Zugriff wiederherstellen oder unter passender Kennung prüfen.
- Alte Local install-journal-v2-Phasen vor Umstellung kontrolliert abarbeiten;
  aktuelle Daten niemals allein aufgrund alter Provenienzbelege zurücksetzen.

Zusätzliche Validierung Runde 2: pnpm test:smoke:built unter Xvfb erfolgreich,
Core erreicht ready und beendet mit Code 0. Beleg im Aufgabenordner
work/roadmap-phase2-release-smoke.log. Dieser Development-Smoke bestätigt den
Buildstart, nicht die noch ausstehende AppImage-Update-Abnahme.
