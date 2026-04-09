# App Shell Frame Owner

## Purpose

`features.appshell/frame` owns the clean cockpit frame itself: sidebar, toolbar, controls/main split, details/state split, and the initial divider defaults.

## Canonical Types and APIs

- `FrameObject.composeFrame(...)` — builds the shell frame around already-final toolbar, navigation, and cockpit panel nodes.
- `input/ComposeFrameInput` — frame composition request carrier.

## Where New Code Goes

- Keep only frame layout structure here.
- Accept already-final toolbar, navigation, and cockpit content nodes from parent owners instead of pulling feature data directly.

## Forbidden Drift

- Do not add navigation state, toolbar refresh orchestration, or inspector history here.
- Do not reach back into feature owners from this subtree.
