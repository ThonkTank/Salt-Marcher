# App Shell Scene Owner

## Purpose

`features.appshell/scene` owns the clean shell-wide lower-right scene pane and its persistent activity-tab registry.

## Canonical Types and APIs

- `SceneObject.composeScene(...)` — builds the shell-owned state node plus passive scene-registration callbacks for feature surfaces.
- `input/ComposeSceneInput` — scene composition request plus registry/result carrier.

## Where New Code Goes

- Put shell-owned persistent state tabs and scene registration here.
- Let features publish persistent activities into this owner through passive registration callbacks instead of owning global lower-right state themselves.

## Forbidden Drift

- Do not route clean state tabs back through legacy `ui.shell.ScenePane`, `SceneRegistry`, or `SceneHandle`.
- Do not move view-local forms or one-off workflow controls into this owner unless they must persist independently of shell navigation.
