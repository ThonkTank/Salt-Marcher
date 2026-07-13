Status: Active
Source of Truth: German owner status notes for Phase 2 architecture
decomposition close-outs and reverts.

# Phase-2 Architekturstatus

## 2026-07-13 W0 Phase-2-Vorbereitung

Phase 2 ist auf dem neuen Branch `codex/architecture-roadmap-phase2`
gestartet. Die neue Roadmap ist aktiv, die Ledger-Position zeigt jetzt auf
Phase 2, und die alten Phase-1-Metriken sind fuer diese Arbeit ausdruecklich
aufgehoben.

Die Phase-1-Nachweise wurden aus der aktiven Architektur-Dokumentation in das
Archiv `docs/project/archive/migration/` verschoben. Vor dem Archivschritt
hatte die aktive Architektur-Dokumentflaeche 13.135 Zeilen; nach dem Schritt
wird der neue Wert im Ledger festgehalten.

Naechster Schritt ist W1: Harness Check/Closure fuer den Split von
`DungeonAuthoredApplicationService`. Dabei bleibt Verhalten unveraendert; die
vorhandenen Harness-Szenarien und Assertions bleiben eingefroren.
