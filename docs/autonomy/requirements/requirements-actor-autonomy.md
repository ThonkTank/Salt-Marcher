Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-21
Source of Truth: Confirmed solution-neutral behavior and quality needs for
GM-authorized NPC and monster autonomy across campaign contexts.

# Actor Autonomy Requirements

## Goal

Let one GM delegate bounded, explainable campaign-time behavior to individual
NPCs and monsters and to groups formed from them. Enabled actors satisfy needs,
select reachable work, move, interact, and resolve non-party conflicts without
wall-clock simulation or loss of GM control.

## Authority And Scope

- the GM explicitly enables, pauses, or disables autonomy per actor or group
- the Party and its members remain GM-controlled
- GM confirmation of campaign time authorizes enabled actors to act within
  their configured bounds
- the GM may directly assign or cancel a job and change role or job priorities
- autonomy never creates or deletes actor identities, campaign places,
  Features, or other authored content
- external actor, creature, inventory, Dungeon, Feature, rule, and calendar
  facts remain owned by their respective capabilities
- the capability may change foreign truth only through an explicit operation
  offered by its owner

Actor autonomy is the confirmed exception to the general product principle that
SaltMarcher does not make campaign decisions. The exception is limited to
enabled actors, confirmed campaign time, configured job and consequence bounds,
and the behaviors specified here.

## Needs And Job Offers

Every enabled individual is a simulation unit with current need state. Built-in
needs are:

- hunger
- thirst
- rest
- safety
- social proximity

The GM may disable or parameterize built-in needs and add custom needs. Needs
change their own state and job priority. They do not independently apply D&D
damage, exhaustion, conditions, or another feature's mechanical effects; such
effects require an operation from the owning capability or GM confirmation.

Roles, Rooms, campaign places, Curiosities, Loot, Traps, and other referenced
targets may offer jobs. Initial useful jobs include guarding, patrolling,
resting, eating, working, resetting a mechanism, traveling, waiting, and an
explicit simple interaction offered by a referenced Feature.

A job is eligible only while its preconditions hold, its target is reachable,
and every required foreign operation is currently available. Free fictional
consequences remain GM-owned unless covered by the bounded non-party conflict
rules below.

## Job Selection And Execution

For each actor, SaltMarcher considers valid jobs using current needs, danger,
role, GM priorities, campaign time, place, reachable target, and reservations.
It selects the highest-priority candidate deterministically. Equal candidates
use a stable deterministic tie-break; ordinary job selection contains no
randomness.

An exclusive target is reserved for one actor or group. A reservation conflict
makes that candidate invalid, causes selection of the next valid job, and
appears in the explanation.

A higher-priority need, newly perceived danger, invalidated target, or GM
override may interrupt a job. A paused job resumes when it remains valid. A job
may mark a short critical step as non-interruptible; this does not permit it to
cross a Party-danger or GM-decision boundary.

Individuals are authoritative simulation units. A group normally shares one
job and travels together, but may split or merge autonomously when the GM's
configuration permits it. An urgent individual need may split its actor from a
group. Group changes preserve individual identity and are logged.

## Campaign Time And Contexts

Autonomy advances only through GM-confirmed campaign or exploration time. It
never advances from wall-clock time, application downtime, or merely opening a
screen.

The active campaign context is simulated in detail. Other autonomy-enabled
contexts retain the elapsed campaign-time boundary and are caught up
deterministically when activated. Catch-up uses the same authored facts and
rules that were valid for the elapsed periods; it does not fabricate wall-clock
activity.

Catch-up stops immediately before the first action whose effect requires a GM
decision. The affected context remains paused and shows the pending decision
when opened. Independent read access and inspection remain available.

Non-party NPC or monster conflict is the explicit exception: it may be
resolved during ordinary progression or catch-up without stopping for GM
confirmation. Party involvement always pauses and notifies before any danger
resolution, movement into engagement, or conflict consequence.

## Perception And Local Behavior

Spatial capabilities provide position, route, environmental perception,
tracks, and local job offers. A new perception result may invalidate or
reprioritize jobs.

NPCs and monsters may autonomously flee, warn, pursue, take position, or engage
when the Party is not involved. When the Party is or becomes involved, the
affected jobs and routes pause and the GM receives the relevant context. An
Encounter starts only after GM confirmation.

## Bounded Non-Party Conflict

Conflicts involving only enabled NPCs or monsters use a simplified abstract
D&D 5e 2014 resolution. Relevant actor values, group size, environment,
position, resources, and configured protection bounds influence a small number
of abstract conflict steps. Full tactical initiative, action-by-action combat,
and a hidden battlemap simulation are not required.

Conflict resolution uses real random rolls. Every roll, applicable modifier,
input reference, step, and result is durably logged. Repeating the same inputs
need not reproduce the same result.

Allowed durable outcomes are:

- changed position, retreat, or escape
- captured state
- injury or death state owned through the relevant actor or rules capability
- consumption of relevant resources
- transfer of referenced possessions through their owning capability

The simulation never deletes an identity or authored record. Per actor or group
the GM may prohibit severe consequences, including death, capture, or permanent
possession loss. Resolution then stops at the strongest permitted result rather
than silently ignoring the bound.

Non-party conflicts do not interrupt catch-up merely to report their outcome.
They remain available in the detailed log and appear in a compact summary when
the GM next opens the context.

## Atomicity, Cancellation, And Correction

One confirmed campaign-time step commits all affected needs, jobs, movements,
group changes, reservations, foreign effects, random conflict results, and
events atomically or commits none of them. A crash leaves either the complete
old step or the complete new step.

Before commit, a long-running step is cancellable and leaves no behavioral or
random-result effects. A completed autonomy step has no runtime undo. The GM
corrects the resulting campaign state through normal owner-provided overrides;
the correction is logged without rewriting the original history.

## Explainability And Log

For the current decision the GM can inspect:

- current needs and their contribution to priority
- considered eligible and rejected jobs
- reachability, reservation, role, time, danger, and target constraints
- the selected job and deterministic tie-break
- pause, interruption, completion, or failure reason

The durable factual log records job start, pause, cancellation, resumption and
completion; group and reservation changes; confirmed movement and simple
effects; time boundaries; conflict rolls and outcomes; GM overrides; and
corrections. Full candidate evaluation is diagnostic and need not be retained
as permanent campaign history.

## Persistence And Failure States

Needs, enabled state, priorities, jobs, reservations, groups, time boundaries,
paused decisions, protection bounds, and committed outcomes survive restart.
Broken or missing referenced targets invalidate only affected jobs and expose a
specific reason; they do not delete actor state or choose an unrelated target
silently.

An owner capability rejecting an effect aborts the complete uncommitted time
step. Catch-up or active simulation then remains at its previous confirmed time
with diagnostics and a repairable reason.

## Quality Needs

- qualification includes at least 200 autonomous individuals
- a confirmed 200-actor time step completes within 2 seconds p95
- progress appears within 100 ms
- an uncommitted operation expected to exceed 2 seconds is cancellable
- simulation does not block camera, selection, or independent reads
- work scales with active actors, locally reachable candidates, and touched
  routes rather than every Dungeon cell or dormant campaign record
- adding a need, job family, job-offer source, spatial adapter, or effect owner
  remains a local change and does not require unrelated feature rewrites

## Non-Goals

- autonomous Party or player-character decisions
- wall-clock or offline simulation
- full tactical D&D combat
- unrestricted scripting of arbitrary campaign mutations
- autonomous creation or deletion of authored campaign content
- ownership of Dungeon geometry, actor identity, creature statistics,
  inventory, calendar, or Feature truth

## Acceptance Outcomes

- an enabled actor selects the same job from the same eligible candidates and
  priorities, excluding separately logged random conflict resolution
- an exclusive target is never simultaneously committed to conflicting jobs
- a GM-confirmed time step is atomic across all affected actors and effects
- catch-up stops before a GM-owned decision but may complete bounded non-party
  conflicts
- any Party involvement pauses before danger resolution and notifies the GM
- protection bounds prevent prohibited severe conflict outcomes
- every random conflict outcome can be audited from recorded inputs, rolls,
  modifiers, and steps
- restart preserves enabled state, jobs, needs, reservations, time boundaries,
  and committed results
- no completed autonomy step can be silently undone or history-rewritten

## References

- [SaltMarcher Vision](../../project/vision.md)
- [Dungeon Travel Requirements](../../dungeon/requirements/requirements-dungeon-travel.md)
- [Dungeon Needs Interview](../../project/interviews/2026-07-20-dungeon-needs-interview.md)
- RimWorld inspiration:
  `/home/aaron/Schreibtisch/projects/references/literature/rimworld-ai-tutorial-introduction.md`
  ([public source](https://github-wiki-see.page/m/CBornholdt/RimWorld-AI-Tutorial/wiki/Part-1---Introduction))
- D&D evidence:
  `/home/aaron/Schreibtisch/projects/references/literature/dnd-basic-rules-2014-adventuring.md`
  ([public source](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/adventuring))
