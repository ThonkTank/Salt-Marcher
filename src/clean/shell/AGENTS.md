# Clean Shell

## Purpose

`src/clean/shell` owns the clean application shell framework that future clean features plug into through passive surface exports and shell-provided hooks.

## Canonical Types and APIs

- `ShellObject.composeShell(ComposeShellInput)` — shell root request — returns the cached shell result created by the shell-local assembly path.
- `input/ComposeShellInput` — shell request and result carrier — provides passive surfaces, the initial active surface, and the hook bundle returned to callers.
- `frame/FrameObject.composeFrame(ComposeFrameInput)` — shell frame request — returns the cockpit frame assembled around already-final toolbar, navigation, and panel nodes.
- `navigation/NavigationObject.composeNavigation(ComposeNavigationInput)` — shell navigation request — returns the active-surface projection assembled from passive surfaces.
- `inspector/InspectorObject.composeInspector(ComposeInspectorInput)` — shell inspector request — returns the global details pane plus publication hooks.
- `scene/SceneObject.composeScene(ComposeSceneInput)` — shell scene request — returns the global lower-right pane plus scene-registration hooks.
- `async/AsyncObject.composeAsync(ComposeAsyncInput)` — shell async request — returns the background-submission and failure-reporting hooks.

## Where New Code Goes

- Put clean shell framework work here instead of rebuilding shell behavior in `clean.CleanObject` or future clean features.
- Keep later feature attachment passive: exported surface packets in, shell hooks out.
- Keep shell-owned inspector, scene, and async behavior here instead of importing or wrapping legacy `ui.shell` or `ui.async`.
- Keep the public `*Object` request methods thin. When JavaFX composition is needed, use a private nested assembly inside the owner file and let the public request only validate and return the already-built result.

## Forbidden Drift

- Do not introduce a clean `AppView` replacement here.
- Do not import legacy `ui.shell`, `ui.async`, or feature packages here.
- Do not move scene-graph assembly or event-handler wiring back into the public `compose*` request methods; that immediately breaks the owner checks in this subtree.
- Do not make later clean features call sibling shell owners directly; they should consume the hook bundle returned from `ShellObject`.
