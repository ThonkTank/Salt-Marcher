# Clean Shell

## Purpose

`src/clean/shell` owns the clean application shell framework that future clean features plug into through passive surface exports and shell-provided hooks.

## Canonical Types and APIs

- `ShellObject.composeShell(ComposeShellInput)` — shell root request — returns the cached shell result created by the shell-local assembly path.
- `input/ComposeShellInput` — shell request and result carrier — provides passive surfaces, grouped sidebar metadata, the initial active surface, and the hook bundle returned to callers.
- `frame/FrameObject.composeFrame(ComposeFrameInput)` — shell frame request — returns the cockpit frame assembled around already-final toolbar, navigation, and panel nodes.
- `navigation/NavigationObject.composeNavigation(ComposeNavigationInput)` — shell navigation request — returns the active-surface projection assembled from passive surfaces, grouped sidebar sections, and legacy-style navigation graphics.
- `inspector/InspectorObject.composeInspector(ComposeInspectorInput)` — shell inspector request — returns the global details pane plus publication hooks.
- `scene/SceneObject.composeScene(ComposeSceneInput)` — shell scene request — returns the global lower-right pane plus scene-registration hooks.
- `async/AsyncObject.composeAsync(ComposeAsyncInput)` — shell async request — returns the background-submission and failure-reporting hooks.

## Where New Code Goes

- Put clean shell framework work here instead of rebuilding shell behavior in `clean.CleanObject` or future clean features.
- Keep later feature attachment passive: exported surface packets in, shell hooks out.
- Keep shell-owned inspector, scene, and async behavior here instead of importing or wrapping legacy `ui.shell` or `ui.async`.
- Keep the public `*Object` request methods thin. When JavaFX composition is needed, use a private nested assembly inside the owner file and let the public request only validate and return the already-built result.
- Mirror the visual shell contract from `ui.shell.AppShell` and the shell-facing parts of `resources/salt-marcher.css`, but keep that presentation duplicated locally inside `resources/clean/clean.css`.
- Keep the sidebar contract stable for future features: surfaces provide `sidebarSectionId`, a compact text fallback, and preferably a `navigationGraphic`.

## Forbidden Drift

- Do not introduce a clean `AppView` replacement here.
- Do not import legacy `ui.shell`, `ui.async`, or feature packages here.
- Do not move scene-graph assembly or event-handler wiring back into the public `compose*` request methods; that immediately breaks the owner checks in this subtree.
- Do not let `clean/shell` drift into a separate visual language. If the original shell changes structurally or stylistically, mirror the relevant shell presentation here instead of inventing a second cockpit style.
- Do not make later clean features call sibling shell owners directly; they should consume the hook bundle returned from `ShellObject`.
- Do not let grouped Clean sidebar behavior leak upward into `CleanObject`; section separators and navigation graphics belong to `clean/shell/navigation`.
