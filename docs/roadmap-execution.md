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
| 1     | in Arbeit |
| 2–7   | offen     |

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
