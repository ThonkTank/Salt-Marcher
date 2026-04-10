# Clean App Root

## Purpose

`src/clean` owns the isolated clean application rebuild that now backs the default `build`/`run`/`installDesktopApp` lifecycle.

## Owner Atlas

- `clean.CleanObject` — public clean application root seam — assembles the phase-1 surface catalog and delegates final startup.
- `clean.startup.StartupObject` — clean startup owner — creates the shell, scene, stylesheet hookup, and stage presentation.
- `clean.navigation.NavigationObject` — clean surface navigation owner — swaps the toolbar and the four cockpit panels.
- `clean.frame.FrameObject` — clean frame owner — lays out the cockpit shell chrome and panel hosts.
- `clean.placeholder.PlaceholderObject` — placeholder surface owner — emits the phase-1 capability-family surfaces that mark rebuild targets.

## Canonical Types and APIs

- `CleanObject.showApplication(ShowApplicationInput)` — clean root request — builds the phase-1 clean surface set and starts the app on the provided stage.
- `startup/StartupObject.startApplication(StartApplicationInput)` — startup request — composes navigation plus frame and shows the JavaFX stage.
- `navigation/NavigationObject.composeNavigation(ComposeNavigationInput)` — navigation request — returns toolbar/navigation/panel hosts wired to the active clean surface.
- `frame/FrameObject.composeFrame(ComposeFrameInput)` — frame request — returns the cockpit `BorderPane`.
- `placeholder/PlaceholderObject.composePlaceholder(ComposePlaceholderInput)` — placeholder request — returns a passive clean surface descriptor for one capability family.

## Where New Code Goes

- Put all new clean application entry, shell, surface, persistence, and feature rebuild work under `src/clean`.
- Let `CleanObject` remain a thin root seam that only assembles canonical inputs and delegates to direct clean subowners.
- Keep phase-1 placeholder surfaces as passive descriptors; replace them later with dedicated clean owners instead of importing legacy feature code.
- Keep clean resources under `resources/clean`.

## Forbidden Drift

- Do not import legacy project packages from `database`, `features`, `importer`, `shared`, or `ui`.
- Do not route clean startup back through `launchers/` or `src/ui/bootstrap`.
- Do not let `src/clean` silently depend on legacy CSS, shell abstractions, or persistence helpers.
