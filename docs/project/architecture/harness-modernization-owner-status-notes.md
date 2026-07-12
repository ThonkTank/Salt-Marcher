Status: Active
Source of Truth: German owner-facing status notes for harness modernization.

# Harness Modernization Owner Status Notes

## 2026-07-12 T0-start

Die Vorbedingung fuer die Harness-Modernisierung ist jetzt erfuellt:
`origin/main` steht laut Architektur-Migrationsledger bei M6 Complete, PR #451
ist mit `c12cb494f` integriert und der Post-Merge-Ledger-Stand ist mit
`75c96a59d` auf `main`. T0 startet deshalb auf dem separaten Branch
`codex/harness-modernization-t0` in einem sauberen Worktree. Der vorhandene
dirty Migrations-/Owner-Worktree bleibt unangetastet. T0 beschraenkt sich auf
den Pilot `hexMapEditorBehaviorHarness`, eine wiederverwendbare JUnit-
Registrierungsvorlage, den Entscheidungsdatensatz und die Ledger-/Status-
Dokumentation. Es wurden noch keine Fleet-Konvertierungen und keine CI- oder
Hook-Aenderungen begonnen.

## 2026-07-12 T0-close-out

T0 ist auf dem Branch `codex/harness-modernization-t0` abgeschlossen. Der
Pilot `hexMapEditorBehaviorHarness` laeuft jetzt als JUnit-`Test`-Task mit 21
benannten Szenarien, gemeinsamer JavaFX-Lifecycle-Verwaltung per
`@BeforeAll`/`@AfterAll`, Gradle-`check`-Anbindung und ohne die alte JavaExec-
Pilotregistrierung. Die wiederverwendbare `junitTest`-Registrierungsvorlage
liegt in der Build-Logik.

Die woertlichen T0-Proben sind dokumentiert: forced Pilot-Run gruen,
unveraenderter Pilot-Run `UP-TO-DATE`, Classpath-Aenderung triggert Re-Run,
echte Szenario-Assertion in `HEX_EDITOR_006` isoliert einen Fehler ohne
spaetere Szenarien im XML zu verstecken, finaler JUnit-Report `tests="21"`
ohne Fehler. Der finale Abschluss-Check wurde nach Judge-Hinweis mit
`--rerun-tasks` wiederholt und lief gruen: `BUILD SUCCESSFUL in 8m 23s`,
`42 actionable tasks: 42 executed`. Phase 1 und Phase 2 sind approved.

Es wurden keine Produktionsverhaltenspfade geaendert. T1 ist der naechste
Schritt; die erste Fleet-Konvertierungscharge ist noch nicht ausgewaehlt.
