# Frontend robustness roadmap

Status: normative for the pre-release renderer-state migration.

## Purpose

This roadmap makes the existing Electron renderer deterministic without
replacing Electron, React, TypeScript, the restricted preload capability
bridge, Utility-owned domain logic and SQLite, or the Pixi and Babylon spatial
leaves. It responds to observed renderer fragility caused by overlapping
projection owners, uncoordinated reads and writes, and recovery through broad
React remounts.

The historical `M0` through `M6` roadmap in
[`electron-greenfield-migration.md`](electron-greenfield-migration.md) keeps its
original meaning. This program uses the separate `FR0` through `FR7` identity.
Mutable execution status belongs to the active pull request. This document owns
phase order, entry conditions, exit conditions, and implementation boundaries.

## Binding inputs

- product behavior in the vision and feature requirements;
- `program-technical-needs.md`, especially `TN-11`, `TN-16`, `TN-21`, and
  runtime scenarios `QS-01` through `QS-05`;
- the process, security, capability, and data boundaries in
  `target-architecture.md`;
- the canonical delivery contract in `AGENTS.md`;
- the journey guarantees in the application-layer and World Location
  acceptance matrices.

The current renderer is comparison evidence, not product truth. A phase may
change renderer-local behavior only where product requirements leave that
behavior unconstrained or explicitly require the corrected result.

## Target renderer model

Every state value has exactly one of these classes:

| Class | Authority | Lifetime and rule |
| --- | --- | --- |
| durable truth | Utility process aggregate | Survives restart; renderer never authors a competing copy |
| read projection | one keyed renderer projection owner | Immutable, revisioned, replaceable only by an accepted result for the same authority key |
| authored draft | one feature workflow | Retained or discarded only by its documented workflow transition |
| view state | one mounted or explicitly retained surface | Selection, expansion, search, focus, and layout; never treated as durable truth |
| async infrastructure | one instance-bound coordinator | Request tokens, queues, cancellation, and acceptance only; no domain state |
| reconciliation | durable command receipt plus owning adapter | Resolves an unknown write outcome by the same command identity; never blindly replays |

The following invariants apply in every phase:

1. Reads may use latest-only acceptance. Writes never use latest-only
   transport semantics.
2. Writes are FIFO per semantic authority and independent across unrelated
   authority keys. Expected revisions are selected inside the queued transport
   after the preceding accepted result.
3. A completed result may update its own keyed cache while only a result whose
   authority is still current may replace the visible authored state.
4. An `outcome_unknown` write is reconciled by command identity and affected
   aggregate. Data recovery never changes a React key or remounts an unrelated
   workspace.
5. Capability invalidation is exact. One owner subscribes and accumulates each
   projection; consumers do not independently refresh the same truth.
6. Views receive selector and action ports. Capability calls, revision
   selection, receipts, and cache accumulation remain in application adapters.
7. A draft has an explicit survival matrix covering refresh, invalidation,
   workspace navigation, Campaign switch, failure, and recovery.
8. No phase may weaken process isolation, IPC validation, bundle ceilings,
   accessibility, or canonical handoff.

## Phase protocol

Before every phase:

1. reread this roadmap, its acceptance rows, the original Electron roadmap,
   the target architecture, and the current source and test owners in scope;
2. fetch and compare the live `origin/main` SHA, worktree, relevant pull
   requests, and installed/runtime evidence where applicable;
3. record a concrete implementation packet: owned files, state authorities,
   command keys, failure cases, tests, delivery classification, and exclusions;
4. mentally trace dispatch, transport, commit, event, acceptance, recovery,
   unmount, and next-action paths before editing.

After every phase:

1. compare the implementation row by row with the phase exit conditions and
   the frontend robustness acceptance matrix;
2. record negative findings: awkward ownership, duplicated truth, shortcuts,
   simplified scope, weak tests, missing production evidence, or accidental
   coupling;
3. implement a bounded follow-up phase before promotion when a discrepancy can
   invalidate a guarantee; never defer it behind a completion claim;
4. run focused proof and the complete required gate for the change class;
5. deliver every app-relevant exact Candidate SHA through remote `Check`,
   `pnpm handoff:app`, unchanged promotion, and a green Main run.

## FR0 — baseline and acceptance contract

### Scope

- add this roadmap and the normative acceptance matrix;
- classify existing renderer state-owner families and write paths;
- preserve the known global readback/remount, uncoordinated Campaign root, and
  latest-only mutation mechanisms as explicit baseline findings;
- add a focused, semantic baseline test and check manifest;
- define the rapid-interaction and failure journeys required by later phases.

### Exit conditions

- each renderer owner family has a state class, current mechanism, risk, target
  phase, and required evidence;
- each known instability class is represented by executable baseline evidence
  or an acceptance journey;
- the baseline records evidence only and does not normalize current behavior as
  the target;
- `pnpm check:frontend-robustness` and `pnpm check` pass.

## FR1 — projection and command foundation

### Scope

- preserve the operation registry's `read` and `write` identity through typed
  renderer application adapters;
- introduce separate read-projection, FIFO-command, long-work, and receipt-
  reconciliation entry points;
- define stable projection and authority keys;
- compare a bounded TanStack Query read-cache adapter with a minimal
  `useSyncExternalStore` projection owner. Prefer the implementation that proves
  exact revision/event behavior with less custom lifecycle code; neither may
  own writes or drafts;
- add semantic gates that reject a write routed through latest-only mode and a
  data-recovery path implemented by remount.

### Exit conditions

- one reference read deduplicates, rejects stale visible acceptance, and
  invalidates by exact key;
- one reference write is FIFO through acceptance and chooses its revision at
  transport time;
- an unrelated authority remains concurrent;
- unknown outcome recovery is targeted and never replays;
- the selected cache approach remains within bundle budgets and has an explicit
  removal path if FR2 rejects it.

## FR2 — Campaign and Workspace root

### Scope

- replace the renderer Campaign/Session root with one Campaign Workspace
  authority owner;
- serialize Campaign create, activate, rename, trash, restore, and permanent
  delete on the installation authority;
- bind Campaign catalog, active Campaign, Session projection, workspace view
  state, and acceptance to explicit identities;
- replace global `saltmarcher:readback` and `readbackKey` recovery for this slice
  with targeted reads and receipts;
- specify per-Campaign view-state retention.

### Exit conditions

- rapid `A -> B -> A`, overlapping reads, switch-during-write, readback, restart,
  and the next mutation produce one coherent Campaign/Session truth;
- no data recovery remounts a workspace or silently discards a draft;
- `QS-05` warm-switch equivalence and the one-second p95 budget have production-
  route evidence;
- FR2 is a go/no-go gate. Later migration does not start until the reference
  slice reduces lifecycle complexity and passes owner acceptance.

## FR3 — live Session, Party, Encounter, Group, and Loot

### Scope

- publish one keyed Running Play projection with selectors instead of passing
  a mutable root `setSnapshot` through views;
- queue Scene, Party, Group, Combat, and Loot writes by semantic authority;
- publish exact result projections/patches before the next same-authority
  command selects a revision;
- expose dependent reconciliation as visible pending state under `TN-11`;
- give Loot and Encounter exact invalidation owners.

### Exit conditions

- no Running Play write uses latest-only mode;
- rapid focus, location, Party assignment, Group, Combat, and Loot actions have
  deterministic controlled-promise and Electron evidence;
- stale dependent context is withheld or visibly pending;
- supporting-projection failure leaves the Running Scene usable;
- confirmed mutations survive restart and the representative next action.

## FR4 — Catalog, World Planner, and editors

### Scope

- migrate Location, NPC, Faction, Encounter Table, Creature option, and related
  editor projections to one owner per key;
- separate search, selection, draft, submission, and persisted projection;
- replace latest-only or uncoordinated mutations with authority queues;
- accept exact saved records and reconcile unknown outcomes by command receipt;
- define draft survival across child dialogs, invalidation, workspace navigation,
  and Campaign switches.

### Exit conditions

- delayed pages/details never replace newer search or selection;
- save recovery never issues a second mutation;
- all application-layer and World Location acceptance journeys remain green;
- parent drafts survive every named related-creation and recovery journey;
- route changes preserve or explicitly resolve dirty work.

## FR5 — Session Planner and long work

### Scope

- move Planner catalog/workspace projections onto the shared read model while
  retaining authored-intent authority;
- retain durable preparation and reward operation identities;
- make generation, cancel, resume, and receipt acceptance linear and Session-
  keyed;
- prevent an old Session result from replacing a newer draft while allowing it
  to refresh only its own catalog entry.

### Exit conditions

- cancel before commit creates no later effect; cancel after commit preserves
  accepted truth;
- restart resumes the exact durable stage;
- Session switching during generation never replaces the active draft;
- `QS-02`, `QS-03`, Planner functional E2E, and restart evidence pass.

## FR6 — Hex, Travel, and spatial integration

### Scope

- align the existing Hex and Travel FIFO patterns with the shared command and
  projection contracts;
- key map, chunk, biome, World Location, and Travel projections explicitly;
- remove duplicate Location truth between Catalog and Hex;
- retain Pixi as a dynamic leaf and Babylon as an isolated Dungeon-
  qualification path;
- keep WebGL resource recovery separate from domain and draft recovery.

### Exit conditions

- an old/off-screen map result cannot replace the visible map;
- successful Travel publishes its Session and provider projections together;
- context loss remounts only the rendering leaf and preserves confirmed and
  authored state;
- exact invalidations, spatial journeys, bundle gates, and resource observations
  pass.

## FR7 — legacy removal and qualification

### Scope

- remove global `saltmarcher:readback`, `readbackKey`, data-recovery remounts,
  direct root snapshot setters, unordered async state publication, and manual
  request epochs superseded by the target model;
- ratchet semantic architecture gates to zero legacy paths;
- rerun the complete FR acceptance matrix;
- complete RP-H/M1 measurements, scaling, context-loss, resource-cycle, and
  manual screen-reader evidence;
- obtain manual owner acceptance on the installed exact-SHA artifact.

### Exit conditions

- every acceptance row has direct current evidence;
- zero write uses latest-only mode;
- zero data-recovery path remounts an unrelated surface;
- every projection key has one subscription/accumulator owner;
- `pnpm check`, exact-SHA Candidate handoff, unchanged Main promotion, and the
  green Main run pass;
- owner acceptance closes the visible cutover.

## Delivery decomposition

A phase may use several small pull requests, but each merged app-relevant pull
request must be a coherent vertical guarantee rather than infrastructure that
leaves two active authorities. The preferred package order inside a phase is:

1. acceptance test and typed contract;
2. projection/command owner and migration adapter;
3. consumer cutover and old-path removal;
4. controlled failures and production journey;
5. phase audit, any follow-up, and canonical handoff.

Documentation- or test-only packages finish with `pnpm check`. App-relevant
packages finish only through the canonical exact-SHA handoff described above.

## Sprint decomposition

No implementation sprint may span more than one row below. A row may be split
again during its mandatory pre-phase review, but adjacent rows may not be merged
merely because they touch the same files. Each row has its own pre-phase source
review, implementation packet, post-phase audit, focused proof, and delivery
decision.

| Sprint | Independently closed guarantee |
| --- | --- |
| `FR0` | Roadmap, complete owner-family baseline, executable findings, and focused check |
| `FR1A` | Typed read/write execution contract and semantic mutation gates, without consumer cutover |
| `FR1B` | One low-risk read projection owner selected by the cache spike and cut over end to end |
| `FR1C` | One low-risk write/receipt owner cut over end to end; foundation go/no-go |
| `FR2A` | Identity-bound Campaign catalog and active-Session reads without overlapping publication |
| `FR2B` | FIFO Campaign lifecycle commands with transport-time authority/revision selection |
| `FR2C` | Targeted Campaign/Session reconciliation and removal of their readback remount path |
| `FR2D` | Warm-switch production timing, next-action oracle, and owner go/no-go |
| `FR3A` | Running Play projection owner and selector/action boundary; no behavior migration yet |
| `FR3B` | Scene and Party commands, patches, and dependent-pending behavior |
| `FR3C` | Group and Combat command authorities, including crossed rapid actions |
| `FR3D` | Loot projection/commands and complete Running Play fault/restart journeys |
| `FR4A` | Shared keyed catalog read pattern with one low-risk catalog section |
| `FR4B` | NPC and Location query/mutation cutover with exact receipts |
| `FR4C` | Faction and Encounter Table scope accumulators and command ordering |
| `FR4D` | World Location/related-editor draft survival and complete editor journey gate |
| `FR5A` | Planner catalog/workspace read cutover while retaining authored intent |
| `FR5B` | Planner Session command cutover and inactive-authority cache acceptance |
| `FR5C` | Preparation, generation, reward, cancel, restart, and long-work gate |
| `FR6A` | Shared World Location/map projection ownership across Catalog and Hex |
| `FR6B` | Travel read/write projection cutover and joint Session publication |
| `FR6C` | Pixi/context-loss resource isolation and complete spatial journey gate |
| `FR7A` | Semantic zero-inventory gates and removal of every legacy state path |
| `FR7B` | Complete functional, failure, latency, scaling, and resource qualification |
| `FR7C` | Exact-SHA handoff, installed-runtime audit, Main promotion, and owner acceptance |

`FR1A` and `FR3A` may be test/contract-only only when they add no unused runtime
implementation. Runtime foundation code enters with its first vertical consumer
in `FR1B`, `FR1C`, or `FR3B`; this prevents an unexercised parallel authority
from becoming architecture by accident.
