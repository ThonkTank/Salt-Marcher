# Frontend implementation and architecture audit

- Date: 2026-08-24
- Reviewed state: `origin/main@39199de40f8b5adfc908ff94d460841d7d77a86f`
- Scope: Electron renderer implementation, technology choices, state and async
  ownership, recovery behavior, proof surface, and migration suitability

## Executive assessment

The frontend's fundamental technology direction is suitable for SaltMarcher.
Electron with a restricted preload bridge, React for workflow-heavy surfaces,
PixiJS and Babylon.js as isolated spatial leaves, Zod-validated IPC contracts,
and Utility-owned domain logic and SQLite form a coherent target architecture.
The current instability does not justify replacing that stack.

The renderer implementation is nevertheless structurally fragile. It has
grown several incompatible local answers to the same application-layer
problems: who owns a projection, how commands are ordered, when a revision is
chosen, how a durable result is accepted, and what survives a failure or
remount. React components therefore sometimes act as view, cache, command
adapter, reconciliation owner, and lifecycle boundary at the same time. The
visible symptoms can appear random even when every individual component is
locally understandable.

The appropriate response is an incremental application-layer migration, not a
greenfield frontend rewrite. The versioned
[frontend robustness roadmap](../architecture/frontend-robustness-roadmap.md)
and its [acceptance matrix](../architecture/frontend-robustness-acceptance-matrix.md)
provide that migration. At the reviewed state, FR0, FR1A, and FR1B are complete;
the first end-to-end FIFO write and receipt owner in FR1C is the next foundation
gate. Later feature cutovers remain open and the current frontend must not yet
be described as robust as a whole.

## Audit method and sources

The audit compared product and quality obligations with both target boundaries
and the live renderer mechanisms. The primary inputs were:

- product vision, feature requirements, confirmed acceptance matrices, and
  `TN-11`, `TN-16`, `TN-21`, plus `QS-01` through `QS-05`;
- the current target architecture and historical Electron migration record;
- shared operation contracts, the restricted capability surface, renderer
  provider and workspace roots, feature controllers, application adapters,
  reducers, projection owners, receipt paths, spatial leaves, and associated
  tests;
- exact-SHA FR0, FR1A, and FR1B audit and delivery evidence;
- searches for direct capability use, latest-only writes, root snapshot
  replacement, global readback/remount recovery, request coordinators, and
  command receipts.

This is an architecture and implementation audit, not final interaction
acceptance. Unit and semantic architecture tests identify mechanisms and guard
known boundaries; they do not replace the failure, restart, latency,
accessibility, resource, and installed-runtime journeys assigned to later
roadmap phases.

## What fundamentally makes sense

### Process and security boundaries

The renderer has no direct Node.js, filesystem, or database authority. Electron
main owns window and process policy, while Utility owns domain commands,
SQLite, generators, and background work. The preload bridge exposes restricted
capabilities and validates shared contracts. These boundaries match the local,
durable, security-sensitive nature of the product and should be preserved.

### Technology allocation

React is appropriate for the large number of forms, dialogs, master-detail
workspaces, drafts, validation states, and accessibility-sensitive controls.
PixiJS and Babylon.js are appropriately treated as dynamically loaded rendering
leaves rather than general UI frameworks. Their resource lifecycle can be
qualified separately from domain recovery.

TypeScript and Zod provide useful compile-time and runtime boundary checks.
SQLite remains correctly placed behind aggregate-owned repositories and
prepared statements. There is no architectural need for a browser backend, a
generic ORM, or renderer database access.

### Existing good patterns

The codebase already contains usable reference mechanisms:

- immutable operation results and durable command receipts at the Utility
  boundary;
- feature reducers that distinguish authored drafts from persisted snapshots;
- queued command paths in Hex, Travel, and Session Planner;
- exact command identities for receipt reconciliation in several domains;
- provider-owned installation-settings projection introduced in FR1B;
- error boundaries, lazy module loading, one overlay stack, and isolated Pixi
  and Babylon lifecycles;
- semantic architecture tests and exact-SHA delivery gates.

The migration can therefore consolidate proven pieces instead of inventing an
entirely new frontend platform.

## Principal fragility findings

### F1 — Several renderer owners can represent the same truth

The live Session snapshot can be replaced through a root `setSnapshot` passed
through Workspace, Session, Encounter, Travel, Catalog, and integration
surfaces. Other features retain their own local projections and refresh them
independently. A successful command can consequently update one representation
before or instead of another.

Impact: temporary divergence, result publication into a no-longer-current
view, and behavior that depends on which component remains mounted.

Required correction: one keyed projection owner per durable authority, with
views receiving selectors and actions rather than a root snapshot setter. FR2
through FR6 own the feature cutovers; FR7 rejects all surviving alternate
owners.

### F2 — Read cancellation semantics are also used for writes

`AsyncCommandCoordinator` correctly supports `latest-only` reads and queued
work, but multiple Session, Group, Loot, NPC, and Location mutation paths still
route writes through latest-only scopes. Superseding acceptance cannot undo a
mutation whose transport already reached Utility. Two calls may commit while
only the later renderer result is accepted.

Impact: the renderer can lose the authoritative result and revision of a
durable command, so the next mutation may use stale input or show an older
projection.

Required correction: FIFO per semantic authority; unrelated authorities stay
concurrent. Expected revisions must be selected when a queued command reaches
transport, after the preceding result has been accepted. FR1C establishes the
reference owner, and FR2 through FR6 migrate feature families.

### F3 — Data recovery shares a broad React remount mechanism

Capability recovery dispatches `saltmarcher:readback`. The Campaign/Session
coordinator increments `readbackKey`, and the route host includes that value in
its React key. A data incident can therefore recreate a broader subtree than
the failed projection.

Impact: unrelated view state and authored drafts inherit the lifetime of a
recovery event. Remounting can hide the original ordering problem while
introducing focus loss, duplicate reads, and seemingly spontaneous resets.

Required correction: reconcile the exact command or invalidate the exact
projection key. Domain recovery must not be implemented through workspace
identity. FR2 separates Campaign/Workspace recovery; FR7 removes the global
mechanism.

### F4 — Projection lifetime often follows consumer lifetime

Several feature hooks and controllers create local read owners, request epochs,
event refreshes, and snapshots. Unmounting a dialog or changing a route can
discard accepted state or in-flight reconciliation; remounting can initiate a
second read and produce a different ordering.

Impact: correctness changes with navigation and dialog lifetime rather than
with domain authority.

Required correction: keyed projection owners must live at the narrowest stable
provider that outlives their consumers. FR1B proves this shape for installation
settings. FR2 is the go/no-go test for the more complex Campaign/Workspace
topology.

### F5 — Receipt support is present but reconciliation ownership is uneven

Generator Presets, NPCs, Factions, Encounter Tables, Campaign Rules, Hex, and
other domains expose receipt reads. Several renderer adapters perform an
immediate, one-shot receipt lookup after `outcome_unknown`. If that lookup is
itself interrupted, the stable command identity and pending recovery action
are not consistently owned across view remounts.

Impact: the UI may unlock without knowing whether the command committed, or a
later user action may issue a new command instead of resolving the exact first
one.

Required correction: a reconciliation owner retains the command identity,
blocks only the same semantic authority, and retries only the receipt read.
Receipt absence is a decisive non-replay outcome; receipt-read interruption is
explicit pending state. FR1C uses the installation-wide Generator Preset
registry as the bounded reference slice.

### F6 — Application adapters and views do not yet have uniform boundaries

Some adapters encapsulate command IDs, revisions, typed outcomes, and
projection acceptance. Other components call capabilities directly, choose
revisions from component-local snapshots, refresh several stores manually, or
publish command results through view setters.

Impact: domain ordering and recovery rules are duplicated in UI code and are
difficult to test independently from rendering.

Required correction: views receive selector/action ports; application adapters
own capability calls, authority keys, revision selection, receipts, and cache
publication. This is a consolidation of existing patterns, not a new domain
layer in the renderer.

### F7 — The proof surface is stronger than average but incomplete for the risk

The repository has broad unit, architecture, Electron, bundle, packaging, and
handoff checks. However, many current tests prove one result in isolation.
They do not all cross completions, unmount during work, terminate Utility after
transport, or verify the representative next mutation against durable truth.

Impact: green tests can coexist with lifecycle and ordering failures visible
only under rapid interaction or failure timing.

Required correction: each migrated owner must satisfy the controlled-promise
and production interaction journeys in the acceptance matrix. Later phases
retain explicit installed-runtime, performance, resource, accessibility, and
owner-acceptance gates.

## Why the behavior feels unpredictable

The dominant failures are timing and ownership dependent rather than random:

1. a component reads revision N and begins a command;
2. navigation, invalidation, or another command changes local authority;
3. Utility commits the first command, but latest-only acceptance or unmount
   discards its result;
4. a different projection refreshes, or a broad readback remount recreates the
   view;
5. the next action derives its revision from whichever local copy is now
   visible.

Small timing differences select different owners and acceptance paths. The
result is nondeterministic from the user's perspective even though every
individual promise settles deterministically.

## Architecture decision

### Keep

- Electron and the existing main/preload/Utility process separation;
- React and TypeScript for workflow UI;
- Zod-validated immutable IPC contracts;
- SQLite and aggregate-owned persistence in Utility;
- PixiJS and Babylon.js as isolated dynamic leaves;
- durable command IDs and receipts;
- feature reducers for authored draft state;
- exact-SHA CI, packaged-runtime, and installed-runtime verification.

### Change

- one declared state class and semantic authority for every renderer value;
- provider-lived, keyed read projections with exact invalidation;
- FIFO write owners with transport-time revision selection;
- persistent, targeted receipt reconciliation;
- selector/action ports instead of capability calls and root setters in views;
- explicit draft and view-state survival matrices;
- production interaction proof for crossed timing and process loss.

### Do not introduce as a blanket solution

- a frontend rewrite or replacement of Electron;
- one global Redux-style domain store that becomes a second durable authority;
- TanStack Query or another query cache as a write coordinator;
- a generic event bus, global refresh signal, or React-key recovery protocol;
- optimistic blind replay after an unknown command outcome;
- a generic renderer ORM or direct renderer database access.

TanStack Query remains a possible read-cache implementation if later key
topology justifies its lifecycle machinery. FR1B selected a minimal
`useSyncExternalStore` owner for the singleton Settings reference because it
needed no automatic freshness policy and added no dependency. FR2 must confirm
or reject that choice before broad adoption.

## Phased correction and decision gates

| Phase | Architectural result | Audit status at reviewed SHA |
| --- | --- | --- |
| FR0 | owner inventory, acceptance contract, semantic baseline | complete |
| FR1A | read/write operation identity survives renderer typing | complete |
| FR1B | one provider-lived keyed read projection cut over | complete; cache choice remains provisional |
| FR1C | one FIFO write and receipt owner cut over end to end | next foundation gate |
| FR2 | coherent Campaign/Workspace authority and targeted recovery | open; go/no-go for projection approach |
| FR3 | one Running Play projection and ordered Session/Party/Encounter/Loot writes | open |
| FR4 | keyed Catalog/World Planner projections and explicit editor drafts | open |
| FR5 | linear Session Planner generation, cancellation, resume, and acceptance | open |
| FR6 | shared spatial projections and resource-only renderer recovery | open |
| FR7 | zero legacy paths and complete installed qualification | open |

Every phase must reread the live sources, publish its implementation packet,
record negative findings, and implement any bounded follow-up needed to protect
its guarantee before promotion. App-relevant phases require exact-SHA Candidate
checks, canonical handoff, unchanged promotion, and a green Main run.

## Go/no-go conclusion

Proceed with the existing stack and the phased migration. Do not expand feature
scope on top of a newly identified alternate projection or write owner without
assigning it to the roadmap.

The first architectural go/no-go is FR1C: the reference write must prove
same-authority FIFO through acceptance, transport-time revision selection,
unrelated-authority concurrency, and exact non-replay receipt recovery. The
second is FR2: the chosen projection lifecycle must make Campaign switching and
recovery simpler while preserving drafts and meeting the warm-switch budget.

If either gate requires a second active authority, broad remount recovery, or
feature-specific exceptions to the ordering contract, the foundation should be
revised before later feature migration. Nothing in the reviewed evidence
currently calls for abandoning the product's frontend technologies or process
architecture.

## Related phase evidence

- [FR0 audit](frontend-robustness-fr0-audit.md)
- [FR1A audit](frontend-robustness-fr1a-audit.md)
- [FR1B audit](frontend-robustness-fr1b-audit.md)
