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
- Party appears as the first normal allied card in the Scene group panel, not
  as loose character rows. Its chips show only PCs assigned to the focused
  Scene. `Bearbeiten` opens the Scene-assignment dialog, where the GM assigns
  active PCs or removes assigned PCs. Campaign-level roster and Party
  membership remain owned by the top-bar Party surface.
- Activating a Roster PC through `Zur Party` assigns that PC atomically to the
  focused Scene. Removing Party membership removes the PC from every Scene.
  Manual Scene removal remains stable until membership is toggled again.
- `Gruppe erstellen` always opens one transient new-group draft. Every active
  group row exposes `Bearbeiten`, which opens that group directly without an
  internal group selector. A new group may
  be saved with an empty roster and without a custom name. Disposition is
  descriptive metadata and does not assign a Combat side.
- The dialog's left pane contains the Creature catalog with name, CR, size,
  type, subtype, biome, and alignment filters. The right pane edits the single
  group selected by the opening action. A blank or whitespace-only name is
  replaced atomically on save with the smallest free `Gruppe N` name in that
  Scene. Active and archived groups reserve their exact `Gruppe N` number;
  this rule applies equally to new groups and renamed existing groups.
- Catalog rows add monsters to the draft explicitly. The draft supports
  quantity changes, removal, and an optional persisted group note. A custom
  name is optional; creatures are optional, but a non-empty draft needs at
  least one available creature before saving.
- Every draft change shows base XP, adjusted XP, Party thresholds, creature
  count, multiplier, semantic difficulty band, and status without persisting
  the draft.
- One group may contain several creature identities. Scene stores stable
  creature references and quantities, not copied statblocks.
- Active groups can be edited or archived. Archived groups appear under
  `Inaktiv`, can be restored, and are permanently deleted only after explicit
  confirmation. Empty and archived groups cannot start a new Encounter.
- Archiving a linked group removes that group and its members from Combat.
- A missing creature remains visibly unavailable and cannot enter combat.

The same dialog exposes the Encounter tuning language. `Auffüllen` preserves
the current draft and adds filtered creatures until the requested difficulty
band is reached; an already sufficient or stronger group remains unchanged.
`Neu generieren` replaces only the draft roster. Both operations receive the
focused Scene, assigned Party, optional Location, current draft, filters, and
tuning. A successful roster generation immediately creates an inline Loot
preview for the same unsaved roster. Manual roster edits, undo, and redo remove
that preview; `Loot neu würfeln` replaces only Loot. Seeds remain internal and
independent. `Gruppe & Loot übernehmen` saves both owners atomically, while the
ordinary save action remains group-only. Generator results remain transient
until explicitly saved and do not survive restart. Closing the dialog with a
dirty draft requires explicit discard confirmation.

## Three-column workspace

- The fixed-width left column owns the control panel and the remaining-height
  group list. The control panel presents scene focus and location as compact
  register rows whose selectors appear only while editing. It owns `Gruppe
  erstellen` and assigns one current World Planner location or clears the
  assignment without changing the Detail history. Party and Scene groups share
  a compact register with aligned count and XP columns; at most one row exposes
  its members, note, Loot, and actions.
- The flexible center column switches between Details, Katalog, and Karte.
  Katalog reuses the shared filtered Creature collection and opens a selected
  creature in Details without losing its query and page state. Details has a
  scene-local backward/forward history and renders creature statblocks inline;
  later described scene objects use the same history surface.
- During Combat, activating a monster card with a catalog identity opens that
  creature in the center Details view automatically.
- Read-only rules prose, creature statblocks, group notes, active condition
  labels, and displayed location names recognize terms from the local reference
  graph. Hover or keyboard focus opens a preview; previews can recursively open
  child previews, and clicking opens the full document in Details history.
- Holding direct pointer intent on a preview for five seconds, or choosing its
  pin action, creates a movable persistent card. Pinned cards survive center-tab
  and Scene changes but remain memory-only and clear on application restart.
- Karte consumes the approved Hex provider. Its borderless canvas shows the
  current token and an honest empty state when no map exists; map selection,
  accessible administrative placement, ordered waypoint planning, evaluation,
  explicit start, and runtime controls share one Scene-scoped state with the
  `Reise` scenario pane.
- The right preferred-width column owns the scenario pane. In full composition,
  two vertical dividers resize the left control/group column and right scenario
  column independently. The left range is 280–440 px, the right range is
  264–420 px, each divider is 9 px, and the measured center content requires at
  least 360 px. Divider ARIA limits and pointer/keyboard limits use this same
  geometry.
- The layout model keeps three truths separate: `preferred` is the versioned
  user choice, `available` is the measured workspace after native frame and
  Electron rail, and `effective` is the current fitted result. When full
  composition contracts, the scenario side yields to 264 px before the control
  side yields to 280 px. Automatic fitting never writes either preferred width.
- If measured center content cannot fit the three-column minimum, the workspace
  uses a two-column compact composition at 680 px or more and a stacked
  composition below 680 px. Restoring space restores the unchanged preferred
  widths. The application-wide native minimum is 720 px; Session does not raise
  it and does not add a global CSS minimum.
- Widths and the center tab are stored app-wide as schema version 2 in Electron
  user data. Unversioned pixel preferences and legacy fraction preferences have
  named migrations; invalid data, a successful migration, and a temporary
  runtime fit remain distinguishable.

### Normative layout acceptance matrix

| Case | Available measurement | Required behavior |
| --- | --- | --- |
| Native frame and rail | Actual `.session-workspace` width, not outer-window width | Full composition fits from the measured owner geometry. |
| 200% scale | 720 px workspace with a 440 px measured center | Compact composition; no global minimum and no preference write. |
| Pseudolocalized copy | 900 px workspace with a 620 px measured center | Compact composition without clipping controls. |
| Long group, creature, and combat names | Any composition | Name truncation preserves Count/XP/AC/status and exposes the complete accessible name. |
| Temporary shrink | 512 px workspace | Stacked composition; restoring width restores the prior preferred widths. |
| Scene/location controls | Any composition | Selectors appear only for the row being edited; group and location Loot actions remain in their owning expanded section. |

## Combat Scenario

1. The GM switches between the `Encounter` and `Reise` scenario tabs. A new
   Scene starts on `Encounter`; `Reise` publishes no-context or the approved
   provider's interactive travel console without automatically changing the
   center tab.
2. The GM selects one or more groups belonging to the focused Scene. The
   assigned Scene Party is always selected.
3. Every selection change shows base XP, adjusted XP, Party thresholds and the
   resulting difficulty. At least one available group and one assigned active
   Party member are required to prepare Initiative.
4. Initiative values can be edited before Combat starts. The Party reports its
   values manually; the roll action rolls only monster initiatives.
5. Combat exposes a four-step breadcrumb, turn and round progression, monster
   HP, damage, healing, conditions, a bounded 20-step undo history, and a direct
   transition to Resolution. HP editing opens a modal and closes after a
   successful damage or healing command.
6. Resolution exposes defeated-enemy selection, defeat threshold, XP fraction,
   per-player XP, one idempotent Party award, and typed treasures anchored to
   the selected groups. A treasure opens the shared distribution dialog. The
   current campaign rule selects base or adjusted XP; the resolution exposes
   both values, the selected basis, and its rule revision. A policy change
   before award makes the older award request stale.
7. Completing Resolution returns the scenario panel to selection while keeping
   the Scene and its groups unchanged.

Matching monsters retain individual Scene-owned HP. The view shows up to three as
individual cards, four to ten as one mob, and larger counts in mobs of four to
ten. Mob damage spills through lowest-HP living members; healing restores the
lowest-HP living member. A mob card shows the front living member's HP plus the
living and total counts; its conditions belong to that front member.

Party membership changes are visible immediately. During Initiative or Combat,
SC combatants are reconciled while the active turn is retained where possible.

## Acceptance

- a new campaign exposes four inactive test Roster characters exactly once
- membership is controlled from the top-bar Party surface, not a Party tab
- newly activated Party members appear immediately in the focused Scene Party;
  during Initiative or Combat they are reconciled into that runtime while the
  active turn is retained where possible
- a multi-creature Scene group survives restart and remains campaign-local
- the unified builder persists an empty named group with disposition, creates
  populated manual or generated groups, updates existing groups and notes in
  place, and never persists a discarded draft
- archived groups survive restart, are excluded from Encounter selection, and
  can be restored or permanently deleted after confirmation
- Initiative, Combat, and Resolution resume exactly after restart
- monster Initiative rolling never replaces manually entered Party values
- HP and condition changes can be undone in reverse order, including after a
  persisted restart while their bounded history remains available
- switching scene focus hides another scene's Combat and restores it unchanged
  when that scene is focused again
- creating or renaming a World Planner location updates the selector; deleting
  an assigned location leaves an explicit unresolved reference until the GM
  replaces or clears it
- the assigned Scene Party and at least one selected Scene group are required
  to start
- the same Combat identity cannot award XP twice
- completing Combat never leaves the Session workspace
- group cards may expose multiple anchored treasures; location treasures appear
  in their own left-column section and unplaced treasures remain recoverable
- closing a Loot distribution dialog writes nothing; only `Verteilung
  abschließen` atomically creates allocations and character-ledger entries
