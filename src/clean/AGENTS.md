# Clean App Root

## Purpose

`src/clean` owns the isolated clean application rebuild that now backs the default `build`/`run`/`installDesktopApp` lifecycle. The current live slice is the first clean shell-framework pass plus the first real top-level feature roster: `Encounter`, `Travel`, `Map Editor`, `Tabellen`, `Zauber`.

## Owner Atlas

- `clean.CleanObject` — public clean application root seam — canonical request entry for the isolated app lifecycle and parent owner that bootstraps the clean shell, the top-level feature tabs, and initial hook usage.
- `clean.startup.StartupObject` — clean startup owner — stages the already-composed clean shell on the JavaFX `Stage` and loads clean-local styling.
- `clean.shell.ShellObject` — clean shell root owner — composes the clean frame, navigation, inspector, scene, and async framework owners into the live shell.
- `clean.featuretabs.FeaturetabsObject` — clean top-level feature roster owner — builds the 5-tab surface set and the initial active tab for the shell.

## Canonical Types and APIs

- `CleanObject.showApplication(ShowApplicationInput)` — clean root request — validates the launcher request and returns the already-bootstrapped clean application handoff created by the owner-local assembly path.
- `startup/StartupObject.startApplication(StartApplicationInput)` — startup request — returns the already-staged JavaFX startup handoff created by the startup assembly path.
- `shell/ShellObject.composeShell(ComposeShellInput)` — shell request — returns the live shell root plus the shell-owned hook bundle for later feature attachment.
- `featuretabs/FeaturetabsObject.composeFeaturetabs(ComposeFeaturetabsInput)` — top-level feature-tab request — returns the ordered Clean shell surfaces for `Encounter`, `Travel`, `Map Editor`, `Tabellen`, and `Zauber`.

## Where New Code Goes

- Put all new clean application entry, shell, surface, persistence, and feature rebuild work under `src/clean`.
- Let `CleanObject` remain the bootstrap seam only. Move reusable shell mechanics under `clean/shell`, and move later feature-specific workflow into dedicated clean feature owners instead of growing `CleanObject`.
- Treat `clean/shell` as the single home for the reusable shell framework. Later features should attach through passive `SurfaceInput` packets plus the hook bundle returned from `ShellObject`.
- Keep the top-level Clean feature roster under `clean/featuretabs` instead of hardcoding surface lists in `CleanObject`.
- Keep `Travel` and `Map Editor` aggregated at the top level. Hexmap and Dungeon internals may stay separate, but top-level switching should happen automatically from the selected map instead of via extra sidebar tabs.
- Keep clean resources under `resources/clean`.
- Mirror the legacy shell presentation from `ui.shell.AppShell` and the shell-facing parts of `resources/salt-marcher.css` inside `resources/clean/clean.css`, instead of inventing a second cockpit look.
- Keep the shell slice buildable while features are still missing. Do not regress back to `Runtime`-owned UI composition or back to the old top-level `clean/frame` and `clean/navigation` scaffolds.
- When a clean owner must assemble JavaFX nodes, keep the public request method trivial and push the actual scene-graph assembly into a private owner-local assembly path behind the constructor. That is the current clean-safe pattern that survives the owner boundary checks.

## Forbidden Drift

- Do not import legacy project packages from `database`, `features`, `importer`, `shared`, or `ui`.
- Do not route clean startup back through `launchers/` or `src/ui/bootstrap`.
- Do not let `src/clean` silently depend on legacy CSS, shell abstractions, or persistence helpers.
- Do not restyle `src/clean` into a separate visual language. Clean may duplicate the original shell presentation locally, but it must not directly load or import legacy shell code or CSS.
- Do not treat `CleanObject.Runtime` as architecture precedent for clean feature work. It is only the JavaFX launcher shell and exception boundary, not a valid home for capability logic, navigation workflow, or panel composition.
- Do not put scene-graph assembly, event-handler wiring, surface lists, or sibling-owner orchestration directly into public clean owner request methods. Those shapes must be pushed into canonical tasks, state transitions, repositories, or private terminal consumers that already satisfy the owner rules.
- Do not resurrect the retired top-level shell scaffolds under `clean/frame` or `clean/navigation`. The active reusable shell lives only under `clean/shell`.
- Do not route cross-owner work through sibling clean owners as convenience hops. Cross-owner communication in `src/clean` must stay request-based, input-shaped, and be launched from the parent owner that actually owns that subowner edge.
- Do not bring back the retired demo tabs (`Start`, `Framework`) or the old top-level split between `Karte`/`Dungeon` and `Karteneditor`/`Dungeon-Editor`.
