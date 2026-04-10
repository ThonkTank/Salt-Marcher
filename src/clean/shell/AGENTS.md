# Clean Shell

## Purpose

`src/clean/shell` owns the reusable clean cockpit framework. Keep frame, navigation, inspector, scene, and async attachment here, because every clean feature needs the same shell contract.

## Canonical Types And APIs

- `ShellObject.composeShell(ComposeShellInput)` - returns the composed shell root and the hook bundle for attached surfaces.
- `frame/FrameObject.composeFrame(ComposeFrameInput)` - returns the cockpit frame around already-final panel content.
- `navigation/NavigationObject.composeNavigation(ComposeNavigationInput)` - returns the active-surface projection and sidebar content.
- `inspector/InspectorObject.composeInspector(ComposeInspectorInput)` - returns the global details pane and publication hooks.
- `scene/SceneObject.composeScene(ComposeSceneInput)` - returns the global runtime pane and scene-registration hooks.
- `async/AsyncObject.composeAsync(ComposeAsyncInput)` - returns background-submission and failure-reporting hooks.

## Where New Code Goes

- Keep reusable shell mechanics here, because features should export surfaces and consume hooks instead of rebuilding shell behavior.
- Keep inspector, scene, and async policy here, because those are shell services shared across features.
- Keep the sidebar contract stable here, because surfaces should provide data and the shell should decide how that data is rendered.
- Keep public `compose*` request methods thin and move scene-graph assembly behind private assembly paths, because owner seams must remain trivial under the clean boundary checks.
- Mirror the cockpit presentation locally in `resources/clean/clean.css`, because clean should preserve the product shell language without importing abandoned shell assets.

## Forbidden Drift

- Keep clean features from calling shell child owners directly, because `ShellObject` is the single shell seam they should consume.
- Keep top-level roster policy in `clean.featuretabs`, because the shell renders surfaces but does not own product navigation choices.
- Keep clean shell code independent from legacy `ui.shell` and `ui.async`, because the rebuild must stay structurally self-contained.
