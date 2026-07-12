Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-12
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

## 2026-07-12 T1-close-out

T1 ist auf dem Branch `codex/harness-modernization-t0` abgeschlossen. Die
Behavior-Harness-Flotte ist von JavaExec auf JUnit-`Test`-Tasks umgestellt:
Hex, Travel, Encounter, Catalog, Party, Dungeon, Session Planner, World
Planner, Smoke und die Dungeon-Editor-Suite laufen jetzt ueber Gradle-Testtasks
und sind in `check` verdrahtet. Die alten JavaExec-Behavior-Registrierungen,
die Dungeon-Editor-`main`-Entrypoints und die alte
`outputs.upToDateWhen { false }`-Sperre sind entfernt.

Die letzte Charge war die Dungeon-Editor-Flotte. Der finale forced Aggregate-
Proof war gruen: `BUILD SUCCESSFUL in 3m 9s`, `13 actionable tasks: 13
executed`. Der finale volle Safety-Run war ebenfalls gruen:
`BUILD SUCCESSFUL in 24m 6s`, `75 actionable tasks: 75 executed`. Die
JUnit-XMLs der Dungeon-Editor-Tasks melden je `tests="1"`, `skipped="0"`,
`failures="0"` und `errors="0"`. Phase 1 und der unabhaengige Judge haben die
finale T1-Diff approved.

Ein bestehender zeitbasierter Dungeon-Editor-Proof blieb unveraendert und ist
als R2-Folgeeintrag abgelegt: `DE-STAIR-001` hat in einem nicht gezaehlten
Fokuslauf einmal 283 ms statt des 250-ms-Budgets gemessen; die direkte
Wiederholung, der forced Aggregate-Run und der volle forced Check waren gruen.
Produktionsverhalten wurde nicht geaendert. T2 ist jetzt der aktive Schritt:
Cache-Korrektheit und Hermetik muessen als naechstes woertlich geprobt werden.

## 2026-07-12 T2-close-out

T2 ist auf dem Branch `codex/harness-modernization-t0` abgeschlossen. Die
geprueften konvertierten Dungeon-Editor-Check-Surfaces nutzen keine absoluten
Worktree-Pfade mehr als `Test`-Systemproperty fuer Ergebnisverzeichnisse:
die Dungeon-Editor-Behavior-Tasks schreiben in task-eigene relative
`build/dungeon-editor-behavior-results/<taskName>`-Pfade, und
`dungeonMapRenderParityHarness` nutzt den relativen Pfad
`build/dungeon-map-render-parity-results`.

Die woertlichen T2-Proben sind dokumentiert. Eine nicht deklarierte
Journal-Aenderung ergab Cache-Hits fuer `dungeonEditorBehaviorHarness` und
`dungeonMapRenderParityHarness`. Temporaere Classpath- und Resource-Aenderungen
triggerten jeweils Re-Runs der betroffenen Harnesses und wurden danach
entfernt. Zwei finale volle Safety-Runs nach allen Fixes liefen gruen:
`BUILD SUCCESSFUL in 26m 8s`, `75 actionable tasks: 75 executed`, und
`BUILD SUCCESSFUL in 26m 17s`, `75 actionable tasks: 75 executed`.

Phase 1 hat approved. Phase 2 blockierte zunaechst korrekt den noch absoluten
Render-Parity-Pfad; dieser Befund wurde behoben, die Proben wurden wiederholt,
und Phase 1 sowie Phase 2 haben die finale T2-Diff approved.
Produktionsverhalten wurde nicht geaendert. T3 ist jetzt aktiv: der
versionierte Pre-Commit-Gate muss als naechstes implementiert und mit den
Roadmap-Proben abgelehnt/bestanden/fresh-clone/dirty-worktree nachgewiesen
werden.
