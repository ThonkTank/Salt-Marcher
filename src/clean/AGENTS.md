# Clean App Root

## Purpose

`src/clean` owns the isolated clean application rebuild that now backs the default `build`/`run`/`installDesktopApp` lifecycle.

## Owner Atlas

- `clean.CleanObject` — public clean application root seam — canonical request entry for the isolated app lifecycle.
- `clean.startup.StartupObject` — clean startup owner — canonical startup request seam; keep it request-shaped, not as an inline JavaFX composition home.
- `clean.navigation.NavigationObject` — clean navigation owner — future home of surface selection and panel projection once rebuilt owner-conform.
- `clean.frame.FrameObject` — clean frame owner — future home of cockpit frame composition once rebuilt owner-conform.
- `clean.placeholder.PlaceholderObject` — placeholder surface owner — future home of passive clean surface descriptors once rebuilt owner-conform.

## Canonical Types and APIs

- `CleanObject.showApplication(ShowApplicationInput)` — clean root request — keep this request body minimal and owner-check compliant.
- `startup/StartupObject.startApplication(StartApplicationInput)` — startup request — accepts canonical startup input and returns canonical startup input.
- `navigation/NavigationObject.composeNavigation(ComposeNavigationInput)` — navigation request — returns canonical navigation input only when the owner can do so without violating owner-boundary rules.
- `frame/FrameObject.composeFrame(ComposeFrameInput)` — frame request — returns canonical frame input only when the owner can do so without violating owner-boundary rules.
- `placeholder/PlaceholderObject.composePlaceholder(ComposePlaceholderInput)` — placeholder request — returns canonical surface input only when the owner can do so without violating owner-boundary rules.

## Where New Code Goes

- Put all new clean application entry, shell, surface, persistence, and feature rebuild work under `src/clean`.
- Let `CleanObject` remain a thin root seam. If a capability rebuild needs real workflow, introduce the missing clean owners, inputs, tasks, state, and repositories instead of hiding the workflow in `CleanObject` or `Runtime`.
- Treat the current `frame`, `navigation`, `placeholder`, and `startup` owners as boundary-sensitive scaffolds. Rebuild them incrementally with canonical `input` handoffs rather than dropping JavaFX node graphs straight into public owner methods.
- Keep phase-1 placeholder surfaces passive when they are reintroduced; replace them later with dedicated clean owners instead of importing legacy feature code.
- Keep clean resources under `resources/clean`.

## Forbidden Drift

- Do not import legacy project packages from `database`, `features`, `importer`, `shared`, or `ui`.
- Do not route clean startup back through `launchers/` or `src/ui/bootstrap`.
- Do not let `src/clean` silently depend on legacy CSS, shell abstractions, or persistence helpers.
- Do not treat `CleanObject.Runtime` as architecture precedent for clean feature work. It is only the JavaFX launcher shell, not a valid home for capability logic, navigation workflow, or panel composition.
- Do not put scene-graph assembly, event-handler wiring, surface lists, or sibling-owner orchestration directly into public clean owner request methods. Those shapes must be pushed into canonical tasks, state transitions, repositories, or private terminal consumers that already satisfy the owner rules.
- Do not cache peer clean owners in owner fields or call them as a convenience hop. Cross-owner communication in `src/clean` must still be request-based and input-shaped, exactly like the rest of the repository.
