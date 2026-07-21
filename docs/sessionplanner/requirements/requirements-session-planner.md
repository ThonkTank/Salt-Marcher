Status: Active Target
Owner: Session Planner Feature
Last Reviewed: 2026-07-21
Source of Truth: Observable Session Planner behavior and acceptance criteria.

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
- attach a saved Encounter template as a new scene-owned Encounter plan, detach
  it, and open that independent plan in the global Encounter state tab
- allocate encounter budget per encounter-linked scene
- see session XP budget, planned XP, remaining or exceeded XP, and recommended
  rests
- place short and long rests only between adjacent scenes
- create, edit, and remove authored manual loot notes without presenting them
  as generated loot
- select a scene and edit all planner-owned fields after generation
- edit structured treasures, including title, note, channel, stock, theme,
  magic type, value, slots, item facts, packing, and ordering

Scenes exist independently of encounters. Creature details, party members, and
locations remain owned by their source features. Attached Encounters are cloned
before linking. Generated rewards become Session Planner-owned treasure
snapshots immediately and retain no generation-run provenance.

Every authored action, including Generate and destructive-replacement
confirmation, is bound to the Session identity and revision displayed when the
user triggered it. A delayed, stale, removed, or non-current target is never
redirected through the current-session pointer. Successful edits of a
non-current Session refresh catalog truth without replacing, invalidating, or
publishing over the active Session's search and preparation state.

## Compact Workspace

The Session Planner is one master-detail workspace:

- the main area is a true side-by-side workspace: an independently scrolling
  ordered timeline and one persistent selected-scene detail pane
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
- Session Planner contributes no private state slot; Encounter editing uses the
  existing global Encounter state tab
- encounter creatures, treasure items, and locations open in the global
  inspector; compact Encounter, item, and location pickers stay in scene detail
- treasures appear as editable structured entity cards in their owning scene;
  manual loot notes remain visually and semantically distinct
- attaching or replacing a saved Encounter creates an independent plan for that
  scene; detaching changes only the scene link
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
2. If replacing existing scenes, rests, treasures, or manual
   loot notes would be destructive, the planner asks for explicit confirmation
   before work starts. An empty session needs no confirmation.
3. Preparation runs asynchronously. The existing workspace remains usable and
   shows stage progress while encounters and rewards are prepared.
4. Success publishes the complete generated session as the current editable
   planner state without an intermediate preview or second Apply action.

Cancellation remains available through the `saving` stage while the immutable,
idempotent Session Generation and Encounter commits finish. It prevents the
final Session Planner replacement but does not delete or compensate those
foreign artifacts. After the final current-session identity and revision check
passes and the final Planner commit begins, cancellation is no longer available
and has no effect. Concurrent cancellation cannot suppress that commit's
`ready`, `invalid`, or `failed` outcome.

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

Every generated reward MUST be materialized as an independent, editable Session
Planner treasure, including channel, item quantities, value, magic, curse,
packing, title, note, and order. Encounter-channel rewards attach to their
generated encounter scene. Quest and environment rewards use encounter-free
scenes. A generated reward MUST NOT be projected as a manual loot placeholder,
reduced to a label, or require its generation run for later display.

Generated scenes and planner-owned metadata are editable after preparation.
Editing or removing a scene does not mutate or delete the immutable generation
run, the source Encounter template, or another scene's cloned plan.

## Visible Preparation States

- `idle`: no preparation is running
- `confirming-replacement`: destructive replacement awaits the user's choice
- `generating`: Session Generation is computing encounters and rewards
- `resolving-encounters`: concrete Encounter rosters are being prepared
- `saving`: the complete prepared result is being saved
- `ready`: the authored session contains the completed result
- `invalid`: current inputs cannot produce a session
- `failed`: a stage failed and authored truth is unchanged

The last stable workspace remains visible in every non-ready state.

## Non-Goals

- embedding a second Encounter or creature-statblock editor in Session Planner;
  those edits use the global Encounter state and inspector
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
- the Planner contributes no dead state panel, and linked entities open in the
  global Encounter state tab or inspector without leaving the workspace
- manual planning survives close and reopen
- linked Encounter plans contribute real adjusted XP; blank scenes contribute
  none
- one Generate action produces distinct saved Encounter plans and editable
  treasure snapshots without a second Apply action or retained run provenance
- destructive replacement requires confirmation; failed or stale preparation
  changes no authored session content
- retry does not expose duplicate or partial generated content
- the UI stays responsive and meets the warmed reference-fixture target
- selected-scene saved-plan search is demand-driven, publishes at most eight
  results plus overflow, preserves the inspector field while revisions apply,
  and never reintroduces a full-catalog workspace load

## References

- [Domain](../domain/domain-session-planner.md)
- [Persistence Contract](../contract/contract-session-planner-persistence.md)
- [Architecture](../architecture/architecture-session-planner.md)
- [Session Generation Requirements](../../sessiongeneration/requirements/requirements-session-generation.md)
- [Encounter Requirements](../../encounter/requirements/requirements-encounter.md)
