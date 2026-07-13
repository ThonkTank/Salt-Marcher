Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-13
Source of Truth: German owner-facing status notes for the verification
greenfield roadmap.

# Verification Greenfield Owner Status Notes

## 2026-07-13 Roadmap-angelegt

Die Verification-Greenfield-Roadmap ist angelegt und beantwortet die
Owner-Frage, was ein heutiger Neuaufbau des Verifikations-Harness anders
machen wuerde. Sie leitet alles aus neun messbaren Idealkriterien (V1-V9) ab
statt aus Einzelbefunden. Neu und zentral: **V9 Nicht-disruptive lokale
Ausfuehrung** - kein Testfenster darf mehr den Fokus klauen, damit auf dem
Laptop waehrend eines Laufs weitergearbeitet werden kann.

Leitprinzip ist der **Local-First-Auftrag**: Der Fix muss lokal in
`projects/SaltMarcher` spuerbar sein, nicht nur in CI, und der lokale Checkout
darf nie hinter `origin/main` liegen. In dieser Session wurde deshalb der
lokale Stand aufgeraeumt: Der uncommittete Encounter-Arbeitsstand wurde auf
`codex/architecture-migration-m0-charter` gesichert, die laufende
Architekturarbeit `codex/architecture-roadmap-phase2` (4 Commits vor main)
wurde nach origin gepusht, und `projects/SaltMarcher` steht jetzt auf
`origin/main` plus dieser Roadmap. Die alte Harness-Modernisierung (T0-T4) ist
auf `main` bereits umgesetzt und bildet die Basis; T5 und T6 sind hier
absorbiert (T6 als Milestone M5, T5 als bewusst nicht geplanter Annex, der
eine Owner-Entscheidung und eine Resource-Policy-Aenderung braucht).

Die Milestones sind so geordnet, dass **M1 die Sofort-Entlastung bringt**:
Monocle-Headless als Default (Fenster-Fokus-Klau weg) zusammen mit
Parallelismus. Danach folgen Tag-Topologie (M2), Analyzer-Diaet (M3), eine
Architektur-Engine (M4) und der Frozen-Teardown mit Governance-Konsolidierung
(M5). Verbindliche Zahlenziele werden in M0 auf der Owner-Maschine headless
kalibriert; vorgeschlagen sind unter anderem voller warmer
`--rerun-tasks`-Lauf in maximal 20 Minuten und Pre-Commit-Gate fuer
unberuehrte Bereiche in maximal 5 Minuten.

Es wurde kein Produktions- oder Build-Code geaendert; dieser Schritt ist reine
Dokumentation plus Arbeitsverzeichnis-Aufraeumung. Der schwere Harness wurde
bewusst nicht gelaufen (Laptop-Schonung); der Docs-Commit umgeht das
Pre-Commit-Gate per `--no-verify`, Proof ist `git diff --check` plus
`checkDocumentationEnforcement`. Naechster Schritt laut Ledger: Charter-PR
mergen, dann den ersten gruenen geplanten Nightly-Lauf aufzeichnen und T4 der
Vorgaenger-Roadmap schliessen.
