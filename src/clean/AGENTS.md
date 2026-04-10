# Clean App Root

## Purpose

`src/clean` owns the isolated clean application rebuild that now backs the default `build`/`run`/`installDesktopApp` lifecycle. The current live slice is exactly one static `Clean Start` surface wired through the clean owner chain.

## Owner Atlas

- `clean.CleanObject` — public clean application root seam — canonical request entry for the isolated app lifecycle and parent owner that composes the current one-surface frame packet across the clean subowner seams.
- `clean.startup.StartupObject` — clean startup owner — stages the already-composed clean shell on the JavaFX `Stage` once `Runtime` hands off the real platform stage.
- `clean.navigation.NavigationObject` — clean navigation owner — projects the current active clean surface into toolbar/navigation/panel hosts.
- `clean.frame.FrameObject` — clean frame owner — wraps the projected hosts into the current static cockpit shell.
- `clean.placeholder.PlaceholderObject` — placeholder surface owner — builds the passive `Clean Start` surface descriptor for the current slice.

## Canonical Types and APIs

- `CleanObject.showApplication(ShowApplicationInput)` — clean root request — validates the launcher request, builds the current static `Clean Start` surface packet, and returns the composed frame input for the launcher handoff.
- `startup/StartupObject.startApplication(StartApplicationInput)` — startup request — stages the already-composed clean root on the JavaFX stage.
- `placeholder/PlaceholderObject.composePlaceholder(ComposePlaceholderInput)` — placeholder request — returns the passive `Clean Start` surface descriptor.
- `navigation/NavigationObject.composeNavigation(ComposeNavigationInput)` — navigation request — returns hosts filled from the active surface.
- `frame/FrameObject.composeFrame(ComposeFrameInput)` — frame request — returns the static cockpit root for the current one-surface slice.

## Where New Code Goes

- Put all new clean application entry, shell, surface, persistence, and feature rebuild work under `src/clean`.
- Let `CleanObject` remain a thin root seam. If a capability rebuild needs real workflow, introduce the missing clean owners, inputs, tasks, state, and repositories instead of hiding the workflow in `CleanObject` or `Runtime`.
- Treat the current `frame`, `navigation`, `placeholder`, and `startup` owners as boundary-sensitive scaffolds. Extend the existing one-surface chain incrementally with canonical `input` handoffs and keep cross-owner orchestration in the parent `clean` owner instead of bouncing sibling owners through each other.
- The current slice deliberately inlines the static `ComposePlaceholderInput` packet in `CleanObject.showApplication(...)` and lets `Runtime` perform the final `Stage` handoff into `StartupObject`. That is a temporary small-slice bootstrap shape, not precedent for larger clean workflows.
- Keep phase-1 placeholder surfaces passive when they are reintroduced; replace them later with dedicated clean owners instead of importing legacy feature code.
- Keep clean resources under `resources/clean`.
- Keep the current one-surface slice buildable while adding the next slice. Do not regress back to `Runtime`-owned UI composition.

## Forbidden Drift

- Do not import legacy project packages from `database`, `features`, `importer`, `shared`, or `ui`.
- Do not route clean startup back through `launchers/` or `src/ui/bootstrap`.
- Do not let `src/clean` silently depend on legacy CSS, shell abstractions, or persistence helpers.
- Do not treat `CleanObject.Runtime` as architecture precedent for clean feature work. It is only the JavaFX launcher shell plus the final platform-stage handoff, not a valid home for capability logic, navigation workflow, or panel composition.
- Do not put scene-graph assembly, event-handler wiring, surface lists, or sibling-owner orchestration directly into public clean owner request methods. Those shapes must be pushed into canonical tasks, state transitions, repositories, or private terminal consumers that already satisfy the owner rules.
- Do not route cross-owner work through sibling clean owners as convenience hops. Cross-owner communication in `src/clean` must stay request-based, input-shaped, and be launched from the parent owner that actually owns that subowner edge.
