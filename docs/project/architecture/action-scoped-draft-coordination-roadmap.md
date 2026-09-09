# Action-scoped draft coordination roadmap

## Goal

Each action resolves only drafts that it needs or would discard. The shared
draft coordinator remains the single coordination mechanism. Domain owners
continue to enforce revisions and travel/combat exclusions transactionally.

## Phase 1 — Binding conflict matrix

Define the affected drafts for every transition:

| Action | Drafts to resolve |
| --- | --- |
| Pause or abort travel; change travel multiplier | No independent editor drafts |
| Start or resume travel | Route and Party changes in the same scene |
| Position the Party | Route and relevant scene data in the same scene |
| Move a character | That character plus affected source and target scene drafts |
| Close a window | Drafts whose lifetime ends with that window |
| Change scene | Drafts whose editing context is left or replaced |
| Quit, install or restore | All drafts |

Every coupling must have a product or consistency reason. Travel must not use a
global draft check merely because an editor is registered.

## Phase 2 — Coordination contract

Each draft declares its editing context, affected data, context-loss lifetime,
and real dependencies on other open drafts. Each action supplies its impact to
the coordinator. The coordinator resolves and locks only matching drafts.
Quit and maintenance retain an explicit global mode. An unavailable irrelevant
editor cannot block an action; an unavailable required dependency remains a
visible failure.

## Phase 3 — Travel transitions

Pause, abort and multiplier changes operate on the current travel state without
resolving unrelated editor drafts. Start and resume resolve the route and Party
drafts for their scene. Positioning also resolves changes that its context
transition would discard. Scene, travel and combat state are re-read after
resolution. Unknown command outcomes are never replayed.

## Phase 4 — Window and scene transitions

Window closure and scene changes select drafts by actual editing lifetime.
Drafts in other scenes or persistent windows remain intact. No input may be lost
when its owning context closes.

## Phase 5 — Acceptance and regression

Cover necessary and explicitly independent couplings, multiple drafts, missing
dependencies, save failures, scene changes during resolution, concurrent travel,
Party and combat changes, and global quit/maintenance resolution. Preserve the
existing XP, travel and Party regressions.

## Phase 6 — Documentation and delivery

Publish the conflict matrix as the contract, close stale delivery status, and
bind success reports to a concrete commit and completed workflow. Qualify a
clean candidate, perform exact-SHA application handoff, promote the identical
commit to `main`, and confirm the promoted checks.

## Separate investigation — desktop resource exhaustion

Identify the process and exhausted descriptor or watcher limit before changing
limits or application behavior. This investigation changes draft coordination
only if a causal relationship is established.

