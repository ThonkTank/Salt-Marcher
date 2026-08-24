# Frontend robustness FR1C audit

- Date: 2026-08-24
- Delivery baseline: `origin/main@733bcb4659ef717154e3bdc1df0972860425c886`
- Sprint: `FR1C` from the
  [frontend robustness roadmap](../architecture/frontend-robustness-roadmap.md)

## Sources reviewed before implementation

- the complete frontend robustness roadmap, acceptance matrix, FR1A contract
  audit, and FR1B reference-read audit;
- the historical Electron migration roadmap and the current target
  architecture, especially renderer application ownership, coordinator
  semantics, and receipt-aware commands;
- `TN-11`, `TN-16`, `TN-21`, and `QS-01` through `QS-05` in the program
  technical needs;
- current Generator Preset requirements, Zod contracts, Utility aggregate,
  capability bridge, Workspace/settings composition, editor reducer, existing
  receipt tests, and Electron process-test controls;
- the live repository state, application dependencies, focused-test manifest,
  build configuration, and open pull requests.

## Implementation packet

FR1C owns one complete low-risk write/receipt reference slice: the
installation-wide Generator Preset registry.

- state class: write command plus receipt reconciliation;
- durable authority: Utility/SQLite Generator Preset registry and command
  receipts;
- renderer authority key:
  `{ scope: 'installation.generator-presets', entityKey: null }`;
- ordering: FIFO for create, update, delete, and Campaign assignment because
  every command compares and advances the same global registry revision;
- revision selection: inside queued transport, after the preceding command's
  exact receipt has been accepted into the application projection;
- lifecycle: one lazy `GeneratorPresetApplicationOwner` per mounted Workspace,
  independent of settings-dialog and Campaign-menu remounts;
- unknown outcome: read only the same command identity, retain an explicit
  reconciliation-pending state if that receipt read is interrupted, and never
  replay the mutation;
- UI: disable editing, close, reset, and further mutations while reconciliation
  is pending; expose an explicit receipt-check action;
- production journey: an E2E-only Main-process probe drops one already
  committed `generatorPresets.create` reply, restarts Utility, and then lets the
  real UI recover the durable receipt.

The generic `KeyedWriteCommandOwner` owns only transient queue, pending, and
receipt-retry state. Generator registry and Campaign-assignment accumulation
remain in the feature application adapter; React owns neither Promise tails nor
command identities.

## Mental execution trace

1. Workspace lazily constructs one Generator Preset owner and requests a port
   bound to the active Campaign.
2. The port reads the current registry and Campaign assignment once into the
   owner's immutable accepted projection.
3. A mutation captures its command identity, enters the global registry FIFO,
   and selects `expectedRegistryRevision` only when its transport turn begins.
4. A successful transport receipt is accepted into registry/assignment state
   before the next same-authority queue entry starts.
5. If transport reports `outcome_unknown`, the same queue entry reads the exact
   command receipt. A present compatible receipt follows the normal acceptance
   path; an absent receipt fails without replay.
6. If the receipt read is itself interrupted, the owner records that command
   identity. The command call reports reconciliation-pending, and a following
   write on the same authority fails closed before transport.
7. Closing or remounting the settings subtree does not destroy the
   Workspace-owned pending identity. The remounted editor renders the last
   accepted snapshot in a locked reconciliation state.
8. The explicit check action invokes only the retained receipt read. Recovery
   accepts the exact receipt, clears pending state, restores editing, and lets
   the next queued mutation select the recovered registry revision.
9. Workspace disposal cancels coordinator acceptance and clears transient
   pending state. No module-global mutable owner remains.

## Exclusions and delivery classification

FR1C does not migrate Campaign lifecycle commands, generalize projection
invalidation, add a Generator Preset changed event, or claim draft/authority
switch guarantees from FR2 onward. A full Renderer crash still loses the
renderer-local command identity; this slice proves a Utility-process exit while
the Workspace owner survives, not durable renderer-startup command discovery.
That broader start/resume policy remains a later recovery concern and is not
required to close the bounded FR1C reference row.

The application owner deliberately serializes assignments for different
Campaigns because assignment also compares the installation registry revision.
Campaign switching while reconciliation is pending uses only already accepted
cached assignments; complete A/B/A switching and targeted Campaign
reconciliation remain FR2.

There is no Generator Preset changed event. The owner accumulates its own exact
receipts and explicit reads rather than inventing polling or a renderer-global
broadcast. The source, Main, Preload, Renderer, and E2E changes are
application-build-input relevant, so exact-SHA Candidate checks and canonical
`pnpm handoff:app` are mandatory before promotion.

## Post-implementation audit

### Exit-condition review

| FR1C condition | Evidence | Assessment |
| --- | --- | --- |
| one write/receipt owner is cut over end to end | Workspace owner, Generator application ports, settings UI, old per-dialog port factory removed | covered for all four Generator Preset mutations |
| same-authority writes are FIFO | controlled generic and Generator application tests dispatch two writes before the first settles | covered; second transport waits |
| unrelated authority keys remain independent | generic owner test holds key A while key B succeeds | covered at the reusable owner boundary |
| revision is selected after preceding acceptance | crossed create test observes revisions 4, 5, then 6 | covered with the real registry oracle |
| exact receipt recovery never replays | present, absent, and interrupted receipt tests plus committed-result Electron journey | covered; durable oracle finds exactly one created preset |
| pending identity survives consumer remount | a newly acquired Campaign port and the remounted real settings dialog observe the same pending command | covered across the intended Workspace lifetime |
| next mutation works after recovery | unit assign uses recovered revision 5; Electron journey assigns after receipt confirmation | covered |
| latest-only write path is absent | architecture scan plus controlled latest-only mutation | covered for Generator Preset application source |
| foundation go/no-go | generic owner stays projection-free, feature adapter owns domain accumulation, focused gate remains bounded | go for phased adoption; reassess key topology in FR2 rather than bulk-migrating |

### Negative findings and follow-up

1. The first reconciled-owner API accepted `commandId` both beside and inside
   its typed execution descriptor. That allowed the two identities to diverge.
   The duplicate field was removed; the execution descriptor is now the sole
   identity source.
2. Initial blocked and failed entries were projected as public failures after
   the coordinator had recorded a successful settlement. They now fail through
   the coordinator itself; controlled tests assert the coordinator failure
   state and the public blocked/failure projection.
3. The first E2E interruption patch armed the probe at an unrelated send site.
   A protocol test exposed the mistake. Arming now happens only after the
   selected request was posted and marked sent, and a supervisor test proves
   that exactly one committed write reply is dropped.
4. The first settings proof was added to the existing heavy 680-cell editor
   suite. On the low-power handoff host that suite already contains known
   30-second render timeouts, which would have made the focused manifest
   nondeterministic. A lightweight test now renders the real dialog/reducer/
   toolbar while replacing only the heavy leaf editors; the full editor suite
   and production Electron journey remain independent coverage.
5. The first Electron rerun blindly clicked the menu button after Utility
   restart. The outer menu-open state survives while the inner Campaign Menu
   view remounts, so that click closed the menu and caused a false selector
   failure. The journey now reuses the visible menu or opens it only when
   absent; the corrected full run passes.
6. A post-audit typecheck found one test fixture still supplying the removed
   duplicate `commandId`. Removing that obsolete property made the test use the
   same single-source contract as production.
7. The generic callback types originally expressed the operation's generic
   return type directly while awaiting it. The strict lint gate correctly
   rejected three ambiguous awaits. Transport and receipt callbacks now
   explicitly return promises of the awaited operation result; no lint
   suppression or runtime wrapper was introduced.
8. Editing controls outside the preset toolbar were initially still live while
   a save was pending. The complete editor is now enclosed in a disabled
   fieldset for both saving and receipt reconciliation, preventing draft changes
   from being confused with an unsettled command.
9. The E2E hook is intentionally test-only: its IPC handler and preload surface
   exist only with `--salt-marcher-e2e`, accept one hard-coded Generator Preset
   write, and are removed during shutdown. Production code receives no general
   process-kill or arbitrary-operation capability.
10. The pending identity is renderer memory, not durable startup state. A full
    Renderer or Electron restart can therefore require a separate command
    discovery/resume policy. Claiming that broader guarantee here would weaken
    FR1C's evidence; only Utility restart under a live Workspace is closed.
11. A read for a previously unseen Campaign while reconciliation is pending
    cannot synthesize its assignment. The bounded owner returns cached accepted
    state only when available; full Campaign switching and inactive-authority
    publication stay with FR2.
12. No changed event exists for external Generator Preset mutations. Explicit
    read and exact accepted receipts are the current bounded invalidation path;
    FR7 retains the zero-alternate-owner and recovery inventory.

No remaining finding threatens FR-A02, FR-A03, or FR-A05 for the bounded
Generator Preset slice. The go decision applies to incremental owner cutovers,
not to a repository-wide framework replacement.

### Pre-PR verification

- focused controlled proof: 5 files and 33 tests passed;
- `pnpm check:frontend-robustness`: both TypeScript configurations, 15 test
  files, and 100 tests passed on the final pre-commit tree;
- full TypeScript check passed;
- all Core, Electron-tooling, Renderer, and test lint partitions passed;
- Prettier check and `git diff --check` passed;
- built Electron `sessionGeneration` journey passed: 1 test in 2 minutes
  20.8 seconds, including committed-result interruption, Utility restart,
  remount, exact receipt recovery, one-row durable oracle, and next mutation;
- full local `pnpm check` passed format, all lint partitions, both TypeScript
  configurations, and 89 architecture tests; its Portable unit phase passed
  777 of 781 tests and failed only at the three pre-existing 30-second heavy
  Encounter Settings render timeouts plus the pre-existing 16-millisecond
  Reference Matcher CPU budget on this low-power host;
- exact Candidate remote jobs, canonical app handoff, installed-runtime proof,
  unchanged promotion, and green Main evidence are intentionally pending at
  audit creation and must be attached before promotion.
