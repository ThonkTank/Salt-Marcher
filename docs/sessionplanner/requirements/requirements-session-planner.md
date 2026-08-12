# Session Planner Requirements

## Goal

Give a game master one compact workspace for authoring and preparing a session.
The planner MUST support manual planning and one-click deterministic preparation
that produces editable scenes with concrete saved encounters and structured
generated rewards.

## Authored Planning

The user can:

- create, open, rename, and delete persisted session plans
- add or remove session participants without changing Party membership
- set the adventure-day fraction used for planning
- add, edit, remove, and reorder session-owned scenes
- give a scene a title, notes, and optional World Planner location
- attach or detach one saved Encounter plan through an action on the selected
  scene
- allocate encounter budget per encounter-linked scene
- see session XP budget, planned XP, remaining or exceeded XP, and recommended
  rests
- place short and long rests only between adjacent scenes
- create, edit, and remove authored manual loot notes without presenting them
  as generated loot
- select a scene and edit all planner-owned fields after generation

Scenes exist independently of encounters. Encounter rosters, creature details,
party members, locations, and generated reward contents remain owned by their
source features.

Every authored action, including Generate and destructive-replacement
confirmation, is bound to the Session identity and revision displayed when the
user triggered it. A delayed, stale, removed, or non-current target is never
redirected through the current-session pointer. Successful edits of a
non-current Session refresh catalog truth without replacing, invalidating, or
publishing over the active Session's search and preparation state.

## Compact Workspace

The Session Planner is one master-detail workspace:

- the main area shows the ordered scene list and the selected scene inspector
- the controls slot uses one compact preparation toolbar rather than nested
  cards
- session selection and session actions, participant summary, adventure-day
  input, optional encounter count, Generate, progress, and failure status fit
  in that toolbar
- participant detail may expand on demand without permanently consuming the
  controls slot
- saved Encounter plans are searched and attached from the selected scene;
  the controls slot does not render the full saved-plan catalog
- blank and one-character saved-plan queries perform no Encounter read; a
  qualifying query shows searching, ready-empty, bounded results, overflow, or
  failure state in that inspector
- at most eight saved-plan results are visible. Only those result identities
  and already-linked plan identities may be hydrated with concrete Encounter
  summaries; the global catalog is never joined into the workspace
- the state slot shows a compact budget and selection summary
- generated rewards appear as structured reward cards in their owning scene;
  manual loot notes remain visually and semantically distinct
- attaching, replacing, or detaching a saved Encounter changes only that scene's
  Encounter reference; generated reward references remain until their owning
  scene is deleted
- opening another catalog Session atomically saves a dirty selected-scene draft
  against its displayed Session revision before switching. A stale, removed, or
  invalid source keeps the old Session and draft visible with an actionable
  failure; the draft is never copied into the target Session
- deleting a Session validates its displayed revision and updates deletion,
  fallback selection, and any required empty-catalog replacement atomically;
  stale or missing targets write nothing, while deleting a non-current Session
  preserves the active pointer

The Generate action MUST remain available without exposing a ruleset selector,
engine version, catalog version, or an intermediate Apply button.

## Session Preparation Flow

1. The user selects a session and requests generation. The request retains that
   exact Session identity and revision through loading, confirmation, and the
   final replacement check.
2. If replacing existing scenes, rests, generated reward references, or manual
   loot notes would be destructive, the planner asks for explicit confirmation
   before work starts. An empty session needs no confirmation.
3. `startPreparation` returns immediately with `confirmation_required` or an
   accepted operation receipt. A Utility-owned queue performs generation,
   Encounter import, and saving. The existing workspace remains usable and
   follows progress through `preparationReceipt` and
   `preparation.changed` notices.
4. Success publishes the complete generated session as the current editable
   planner state without an intermediate preview or second Apply action.

Cancellation durably records `cancel_requested`. The worker observes it before
Generation, before Encounter commit, and before Planner commit. It prevents the
final replacement only before that commit starts and never deletes or
compensates immutable foreign artifacts. After the final identity/revision
check and transaction begin, cancellation has no effect; the terminal receipt
is authoritative.

`cancelPreparation` is the only public cancellation operation. Together,
`startPreparation`, `preparationReceipt`, and `cancelPreparation` form the one
durable public preparation workflow; generation, Encounter import, and Planner
commit remain internal worker stages rather than separately callable APIs.

If the selected session or relevant inputs change while preparation is
running, the older result MUST NOT replace the newer authored state. Invalid
input, generation failure, encounter resolution failure, or saving failure
leaves the existing session unchanged and exposes an actionable stage status.
A retry of the same request MUST NOT create visible duplicate runs, Encounter
plans, scenes, or rewards.

## Generated Output

Every generated encounter scene MUST reference a real Encounter-owned saved
plan whose concrete roster contains stable creature identities and quantities.
The scene shows at least the plan label, difficulty, adjusted XP, creature
count, and concrete roster summary.

Every generated reward MUST be visible as structured Session Generation truth,
including its channel and generated item lines with quantities. Value, magic,
curse, and packing facts are shown when present. Encounter-channel rewards
attach to their generated encounter scene. Quest and environment rewards use
encounter-free scenes. A generated reward MUST NOT be projected as a manual
loot placeholder or reduced to a last-known label while its source is
available.

Generated scenes and planner-owned metadata are editable after preparation.
Editing or removing a scene does not mutate or delete the immutable generation
run or Encounter-owned saved plan.

## Preparation Receipt And Visible States

The public receipt uses the closed statuses `queued`, `generating`,
`resolving_encounters`, `saving`, `succeeded`, `invalid`, `stale`, `failed`,
and `canceled`. A failure contains stage, code, retryability, and structured
parameters; it contains no localized message. Renderer presentation may map
these states to localized `idle`, replacement confirmation, progress, ready,
invalid, stale, failed, and canceled labels.

The last stable workspace remains visible in every non-ready state.

## Non-Goals

- editing Encounter rosters or creature statblocks inside Session Planner
- mutating Party membership
- copying foreign domain internals into Session Planner persistence
- exposing generation rulesets or catalog versions as user controls
- a second generation tab or a long-lived preview workflow
- deriving a gold budget from provisional heuristics

## Performance Acceptance

- Generate shows visible in-progress feedback by the next UI pulse and does not
  freeze editing, selection, scrolling, or cancellation while work continues.
- A newer preparation request or relevant session edit remains authoritative;
  late completion from older work never replaces the visible workspace.
- A saved-plan search result is published only while its request epoch, source
  session and revision, and selected scene still match. A newer query, authored
  intent, successful mutation, session switch, or selected-scene change makes
  older completion ineligible to publish.
- On the warmed reference desktop fixture, the canonical input of two level-3
  and two level-4 participants, `0.6` adventure days, and three encounters MUST
  publish the completed editable session within 2 seconds at p95 over 20 runs.
  First-use initialization and schema migration are outside this warmed target.

## Acceptance Criteria

- the Session Planner is a dedicated left-bar tab with the compact
  master-detail structure above
- manual planning survives close and reopen
- linked Encounter plans contribute real adjusted XP; blank scenes contribute
  none
- one Generate action produces concrete saved Encounter rosters and structured
  generated rewards without a second Apply action
- destructive replacement requires confirmation; failed or stale preparation
  changes no authored session content
- retrying an operation returns its receipt; reusing its operation ID with a
  different request is rejected and no retry exposes duplicate or partial
  generated content
- the UI stays responsive and meets the warmed reference-fixture target
- selected-scene saved-plan search is demand-driven, publishes at most eight
  results plus overflow, preserves the inspector field while revisions apply,
  and never reintroduces a full-catalog workspace load

## References

- [Domain](../domain/domain-session-planner.md)
- [Persistence Contract](../contract/contract-session-planner-persistence.md)
- [Session Generation Requirements](../../sessiongeneration/requirements/requirements-session-generation.md)
- [Encounter Requirements](../../encounter/requirements/requirements-encounter.md)
