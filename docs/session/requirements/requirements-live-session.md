# Live Session Requirements

## Goal

Provide one running-play shell per campaign. The workspace shows the focused
runtime Scene and a scenario selector without navigating away from the Session
tab. Scene owns runtime composition; Session does not own a second group list.

## Focused Scene

- The Standardszene exists on first use. The control panel switches the focused
  scene when multiple simultaneous scenes exist. Groups, detail navigation,
  selected scenario, and running Combat remain scoped to their scene.
- Only active PCs explicitly assigned to the focused Scene form its Party.
- The Party card lets the GM assign active, unassigned PCs to the focused Scene
  and remove assigned PCs from it.
- `Gruppen managen` opens one GM dialog for creating and editing groups. The
  left pane contains the Creature catalog with name, CR, size, type, subtype,
  biome, and alignment filters. The right pane selects an existing Scene group
  or starts a new draft.
- Catalog rows add monsters to the draft explicitly. The draft supports
  quantity changes and removal and requires a group name plus at least one
  available creature with a positive quantity before saving.
- Every draft change shows base XP, adjusted XP, Party thresholds, creature
  count, difficulty, and status without persisting the draft.
- One group may contain several creature identities. Scene stores stable
  creature references and quantities, not copied statblocks.
- Groups can be edited and deleted in the focused Scene.
- A missing creature remains visibly unavailable and cannot enter combat.

The same dialog exposes the Encounter tuning language. `Auffüllen` preserves
the current draft and adds filtered creatures until the requested difficulty
band is reached; an already sufficient or stronger group remains unchanged.
`Neu generieren` replaces only the draft roster. Both operations receive the
focused Scene, assigned Party, optional Location, current draft, filters, and
tuning. Generator results remain transient until explicitly saved and do not
survive restart. Switching groups or closing a dirty draft requires explicit
discard confirmation.

## Four-panel workspace

- The upper-left control panel owns `Gruppen managen`, scene focus, and the
  location selector. It assigns one current World Planner location or clears
  the assignment without changing the Detail history.
- The lower-left group panel and lower-right scenario panel retain their
  running-play behavior.
- The upper-right panel switches between Details and Karte. Details has a
  scene-local backward/forward history and renders creature statblocks inline;
  later described scene objects use the same history surface.
- Karte consumes the approved Hex provider. It shows the current token, supports
  administrative placement, ordered waypoint planning, explicit start, and an
  honest empty state when no map exists.
- The control panel uses only its required height and the group panel receives
  the remaining left-column space. One shared vertical divider changes both
  left/right panel widths. A separate horizontal divider changes only the
  Details/Scenario split on the right. Both dimensions are stored app-wide in
  Electron user data.

## Combat Scenario

1. The GM selects `Encounter` from the scenario dropdown. `Reise` is the other
   current option and publishes no-context or approved Hex readback plus bounded
   runtime controls.
2. The GM selects one or more groups belonging to the focused Scene. The
   assigned Scene Party is always selected.
3. Every selection change shows base XP, adjusted XP, Party thresholds and the
   resulting difficulty. At least one available group and one assigned active
   Party member are required to prepare Initiative.
4. Initiative values can be edited or rolled before Combat starts.
5. Combat exposes turn and round progression, editable initiative, monster HP,
   damage, healing, and a confirmed end action.
6. Resolution exposes defeated-enemy selection, defeat threshold, XP fraction,
   per-player XP, one idempotent Party award, and the current no-loot notice.
7. Completing Resolution returns the scenario panel to selection while keeping
   the Scene and its groups unchanged.

Matching monsters retain individual runtime HP. The view shows up to three as
individual cards, four to ten as one mob, and larger counts in mobs of four to
ten. Mob damage spills through lowest-HP living members; healing restores the
lowest-HP living member.

Party membership changes are visible immediately. During Initiative or Combat,
SC combatants are reconciled while the active turn is retained where possible.

## Acceptance

- a new campaign exposes four inactive test Roster characters exactly once
- membership is controlled from the top-bar Party surface, not a Party tab
- a multi-creature Scene group survives restart and remains campaign-local
- one builder creates a new group, updates an existing group in place, and
  never persists a discarded manual or generated draft
- Initiative, Combat, and Resolution resume exactly after restart
- switching scene focus hides another scene's Combat and restores it unchanged
  when that scene is focused again
- creating or renaming a World Planner location updates the selector; deleting
  an assigned location leaves an explicit unresolved reference until the GM
  replaces or clears it
- the assigned Scene Party and at least one selected Scene group are required
  to start
- the same Combat identity cannot award XP twice
- completing Combat never leaves the Session workspace
