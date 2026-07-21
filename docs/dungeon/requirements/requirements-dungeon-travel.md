Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-21
Source of Truth: Confirmed solution-neutral Dungeon exploration and travel
behavior.

# Dungeon Travel Requirements

## Goal

Let one GM run spatial Dungeon exploration over committed authored truth and
party-owned runtime state. Travel maintains cell-precise position, time, routes,
events, and a factual log while leaving free actions and fictional outcomes to
the table.

## Runtime Actors And Groups

- the active party and selected relevant NPCs, groups, or movable
  campaign objects may have cell-precise Dungeon positions
- characters may be split from one party token, moved alone, placed into
  separate groups, and later regrouped
- a grouped token travels at the slowest included member's effective speed by
  default and arrives together
- GM group-speed, individual-speed, and member-exclusion overrides apply from
  the `Reisen` state tab
- the GM is the only interface operator; actors do not represent player-owned
  VTT clients

Rooms, derived corridor sections, junctions, stair landings, and comparable
decision points may organize choices and presentation, but do not replace
cell-precise runtime position.
Every bounded standable interior Volume uses the same travel semantics,
including chambers, corridors, and stair spaces. A Room supplies stable authored
content associated with such a Volume. SaltMarcher silently derives
identityless navigation areas at meaningful choices such as branches,
junctions, and landings. They may be freely recalculated and do not own names,
descriptions, content, movement semantics, or runtime position.

## Passive Travel Map

The runtime raster map:

- shows relevant authored geometry and runtime actors
- lets the GM select rooms, areas, objects, actors, and destinations
- opens the selected target's description in a detail pane
- does not edit authored geometry
- does not need to contain the travel controls, which live in the independent
  `Reisen` state tab

## Valid Travel Options

Travel options arise from both authored semantics and actual geometry.

Authored Passages and unified generated connection Paths provide internal travel
meaning. Any Passage may link to another Passage in the same or another Dungeon
or to an external campaign place. Link and return direction are independent,
and each side has its own description, passability, sensory facts, and optional
additional travel time. A missing target makes the link visibly broken and
unavailable without deleting its local Passage.
Geometry may additionally expose long-room and corridor travel, junctions,
complex path forks, open vertical relationships, and potential climb, jump, or
similar special routes.

SaltMarcher may detect a potential geometric special route without consulting
character ability or equipment. The GM decides whether the attempted route is
possible and succeeds. The Dungeon feature then records only a confirmed
journey or a deliberate position override.

## Passability Boundary

A Passage has one explicit travel fact: passable or not passable.
Passages occur at Volume boundaries and are distinct from the Paths that own
route and travel properties. Their authored identities and descriptions may
remain preserved even while no Passage geometry is assigned.

Passability, geometric resolution, sight, light, and sound transmission are
independent. A passable dangling Passage is not travelable until geometry or a
valid linked target resolves it. Door, window, gate, or opening appearance does
not infer any of those facts.

Travel through a Passage link arrives on the valid cell immediately inside the
target Passage with heading derived from that target. It uses ordinary
through-time plus any GM-authored additional duration. Every Passage whose
target is external to the current Dungeon is an available Dungeon entrance;
the GM may alternatively begin exploration by deliberate position placement.

Descriptions such as locked, blocked, heavy, hidden, cold, or difficult do not
create additional passability logic. Authored secret status controls whether
content appears in player-readable descriptions; current-party discovery is
separate runtime state and likewise does not change passability. Hidden content
may carry optional search method and DC facts. Passive values or a GM-entered
active check may privately notify the GM, but reveal requires GM confirmation.
These attributes affect generated description text and
may expose a GM-authored prompt, but SaltMarcher does not infer what actors are
allowed to attempt.

A lock may behave like a trap prompt, for example “Lock, lockpicking DC 16”.
The GM resolves it freely at the table and then continues or aborts travel.
SaltMarcher does not roll, adjudicate, or encode the result.

Difficult terrain, climbing, and comparable movement factors may change
calculated travel time without creating another passability condition or
requiring a separate GM prompt.

## Local Travel And Long Routes

- ordinary point-to-point navigation proceeds to the next relevant decision
  point
- the GM may plan a complete route between two points in the overview
- an autoroute executes as consecutive segments ending at decision points
- position and time commit atomically for each completed segment
- an event, newly invalid route, lost pursuit track, reached destination, or
  GM abort stops or completes automatic travel as applicable
- completed segments remain committed when a later segment stops
- travel does not require confirmation in every ordinary exploration round

## Dynamic Pursuit

The GM may route one actor or group toward another movable actor or group.

- pursuit recalculates toward the target's current position as travel advances
- pursuit ends when the target is caught
- a lost track interrupts pursuit
- catching a target does not automatically merge tokens; the GM decides whether
  to regroup them

## Movement Rules And Time

- distance, terrain, climbing, jumping, movement modes, and effective movement
  rates use an explicitly versioned D&D 5e 2014 rule profile
- diagonal and free path length use geometrically accurate distance rather than
  the simplified five-foot or alternating five/ten-foot grid methods
- movement modifiers apply to that precise distance
- the resulting travel-time calculation runs without an additional GM decision
- terrain and movement-cost calculation remains unobtrusive during travel
- the GM chooses an exploration-round duration of 1, 5, 10, 15, or 30 minutes,
  or enters a custom duration
- when movement lasts longer than one round, subsequent actor rounds remain
  occupied by that journey until destination or interruption
- non-movement actions receive no programmed action categories or durations

## Position Override

`Travel` and `Set position` are distinct GM actions.

- travel follows current valid routes and advances time and event context
- set position places the selected actor at a chosen cell without reachability
  validation, automatic time advancement, or event activation

## Events, Prompts, And GM Authority

Confirmed travel advances calendar time automatically and activates applicable
events.

Event sources include:

- GM-planned events
- GM-configured location-, time-, or actor-dependent event pools
- GM-authored traps
- random encounters
- track, pursuit, and perception notifications

A triggered event opens the relevant GM context and interrupts travel when
resolution is required. SaltMarcher may open, repeat, or dismiss a prompt, but
does not decide or log its fictional outcome.

A trap is an authored Dungeon Feature at an exact voxel anchor within a Volume;
its trigger opens a description. The GM resolves it at the table and dismisses
the prompt to continue or aborts travel. Other Dungeon Features likewise begin
with exact voxel anchors; Encounter context may follow referenced mobile actors
or groups.

Only Traps and Encounters activate automatically through spatial
proximity. A Trap may define zero or more arbitrary voxel-set trigger fields
distinct from its own anchor; fields may lie in several adjacent Volumes and
follow their Volume geometry. Entering a field may notify and interrupt travel,
but the field never changes passability or decides the Trap outcome. Without a
field, the Trap remains manually handled by the GM.

A Trap has maximum and current Charges limiting how many times it can actually
activate in succession. Charge use follows a GM-confirmed actual activation
rather than mere entry into a trigger field. At zero Charges it cannot activate
automatically.

Reset Duration restores all Charges together. Per Trap, the GM chooses whether
the countdown begins only at zero Charges or as soon as current Charges fall
below maximum. Consuming another Charge does not restart a running countdown;
completion restores all Charges regardless of intervening use. The GM may
manually correct current Charges and reset state. An explicit Actor Autonomy
job may perform a reset.

A Dungeon Encounter placement primarily uses the existing SaltMarcher Encounter
capability for monster composition and statistics. The Dungeon adds its voxel
anchor, local notes, detection context, and autonomy integration. One concrete
Encounter or monster group has at most one current Dungeon placement; repeated
equivalent groups require copied Encounters. Movement changes the same group's
anchor. Encounter detection uses the shared perception behavior. Loot and
Curiosity Features do not open automatically from
proximity alone.

More interaction may be added later, but comprehensive trap simulation is not a
requirement.

Position and time commit together or not at all for one travel segment. Opening
the following event may fail and be retried without corrupting the committed
travel state.

Named state actions may atomically change several authored Passage, light,
sound, or mechanism states. They run only after GM confirmation or an explicit
authored trigger based on time, entering an area, elapsed duration, or a
confirmed action. Their result persists and is logged.

## Factual Travel Log

SaltMarcher records confirmed:

- cell or area changes
- elapsed calendar time
- used transitions
- opened events and prompts

The log records what the system confirmed, not GM-decided event outcomes.

## Perception And Knowledge

Perception follows the versioned D&D 5e 2014 profile plus committed 3D Dungeon
facts. Passive Perception or a GM-entered active result is compared with
Stealth, while line of sight, lighting, distance, cover, and the actor's
relevant senses gate detection. An entered active result remains in force until
the GM clears it.

Detection is directional: each actor or group keeps independent knowledge of
the other. A new relevant sighting updates knowledge and notifies the GM. If the
Party is involved, its active route and the involved autonomous behavior pause
before further danger resolution. An Encounter begins only after GM
confirmation.

The GM may force known or unknown state with an optional logged reason. The
override remains until an explicit reevaluation; ordinary perception updates do
not silently replace it.

Environmental perception starts with sight, light, and sound and remains
extensible to senses such as blindsight or tremorsense. Movement, jobs,
conflicts, and interactions create transient sound events; Features or places
may own persistent sound sources.

## Tracks And Pursuit

Confirmed movement automatically creates tracks according to actor, movement,
and surface. The GM may suppress generation, correct a track, or add one
manually. A track records a known or unknown source, voxel path and direction,
creation time, strength, search DC, and relevant movement facts.

Track strength decays according to a versioned time, surface, environment, and
movement profile that the GM may override. Track knowledge is separate per
actor or group; the GM can inspect every track.

Searching uses D&D Perception or Survival, or a GM-entered active result,
against the track DC. GM confirmation records discovery. Following proceeds in
segments along the stored path. Weak, broken, or crossing segments require a
new check; loss or ambiguity pauses the route.

## Passive Player Display

The second-monitor player view is display-only and accepts no player input. Its
camera automatically follows the active Party actor or group in the exploration
initiative; autonomous NPC or monster jobs never switch it.

Fog distinguishes currently visible space, dim remembered geometry without
live details, and unknown space. Current visibility derives from D&D senses,
light and darkness, darkvision, 3D line of sight, height, and cover. The
knowledge filter is the union of the complete Party's knowledge.

Party members and other actors appear only when allowed by party knowledge and
current perception. The GM may temporarily reveal or hide presentation without
changing discovery truth. The view updates within 100 ms p95 after movement or
a visibility change.

## Actor Autonomy Integration

Dungeon travel supplies local position, routing, perception, tracks, and job
offers to the project-wide Actor Autonomy capability. A confirmed campaign-time
step may move enabled NPCs or monsters, update their jobs, and invoke explicit
simple Feature interactions. The owning autonomy requirements define needs,
selection, catch-up, conflict resolution, authority, atomicity, and logs.

Party involvement is a hard boundary: an emerging danger pauses and notifies
before autonomous resolution. Non-party conflicts may be resolved by the
bounded abstract simulation owned by Actor Autonomy.

## Non-Goals

Dungeon travel does not own or automate:

- tactical attacks, spells, combat actions, or full combat rounds
- tactical initiative or six-second combat rounds
- encounter, trap, lock, or unrestricted exploration-action outcomes
- direct player controls
- full tactical Battlemap behavior

An encounter or another open situation involving the Party interrupts travel
and is resolved at the table or by another owning feature. Actor Autonomy may
resolve bounded non-party conflicts without making Dungeon travel their owner.

## Acceptance Outcomes

- travel reads committed authored Dungeon truth plus runtime actor state
- every confirmed segment updates position and time atomically
- route failure never leaves partially committed position or time for the
  failed segment
- a dynamic pursuit follows current target position and stops on catch or lost
  track
- explicit passability, not descriptive text, determines whether pathfinding may
  use a door or passage
- precise geometric distance and the versioned movement profile determine
  unobtrusive travel time
- a position override never silently behaves like rule-based travel
- triggered content pauses for GM resolution without SaltMarcher deciding the
  outcome
- Party-involved danger pauses before autonomous conflict resolution
- perception, tracks, Fog of War, and player display use the same committed
  geometry, environment, and knowledge facts as travel
- runtime travel state does not become authored Dungeon-package truth

## References

- [Dungeon Feature Requirements](./requirements-dungeon.md)
- [Dungeon Travel State Requirements](./requirements-dungeon-travel-state.md)
- [Dungeon Editor Requirements](./requirements-dungeon-editor.md)
- [Dungeon Needs Interview](../../project/interviews/2026-07-20-dungeon-needs-interview.md)
- [Actor Autonomy Requirements](../../autonomy/requirements/requirements-actor-autonomy.md)
- D&D evidence:
  `/home/aaron/Schreibtisch/projects/references/literature/dnd-basic-rules-2014-adventuring.md`
  ([public source](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/adventuring))
