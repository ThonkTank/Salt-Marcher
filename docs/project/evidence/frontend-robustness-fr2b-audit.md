# Frontend robustness FR2B audit

- Date: 2026-08-24
- Delivery baseline: `origin/main@cee564c2714eb4bfa9eb66d81d5d2d05dee0d71e`
- Sprint: `FR2B` from the
  [frontend robustness roadmap](../architecture/frontend-robustness-roadmap.md)

## Sources reviewed before implementation

- the complete frontend robustness roadmap and normative acceptance matrix;
- the original Electron greenfield migration roadmap and current target
  architecture;
- Campaign lifecycle, Session-resume, and immediate-switch product
  requirements;
- `TN-01` through `TN-24`, with particular attention to `TN-11`, `TN-15`,
  `TN-16`, and `TN-21`;
- the FR2A Campaign Workspace projection, Renderer execution contract, keyed
  read/write owners, Generator Preset reference owner, Workspace hook, shared
  Campaign contracts, Utility composition, Campaign store, registry repository,
  installation database owner, import lifecycle, and recovery paths;
- current unit, integration, architecture, Electron, focused-manifest, bundle,
  and delivery proof surfaces on the exact baseline SHA.

## Implementation packet

FR2B owns only the ordered command side of the Campaign Workspace root.

- state class: write command whose accepted result updates the installation
  Campaign catalog read projection;
- durable authority: the installation Campaign registry;
- renderer authority key:
  `{ scope: 'installation.campaign-catalog', entityKey: null }`;
- commands: create, activate, rename, trash, restore, and permanent delete;
- ordering: one provider-lived FIFO queue shared by all six commands;
- transport-time selection: each queued command reads
  `CampaignSnapshot.revision` only when its transport is allowed to start;
- acceptance: the immutable command result is published into the catalog
  projection before the next same-authority transport selects its revision;
- durable concurrency boundary: all six strict IPC inputs require
  `expectedRegistryRevision`; Utility forwards it to a SQLite compare-and-swap
  check before connection or filesystem effects and again inside the registry
  transaction;
- persistence: the installation `settings` table stores the monotonic Campaign
  registry revision. Installation schema migration 37 to 38 creates revision
  zero before application activation; every visible registry transition then
  advances it exactly once;
- recovery: completed create, import/replacement registry publication,
  compensation of an already visible lifecycle commit, and pending deletion
  recovery also preserve monotonic revision truth.

Command receipts, `outcome_unknown` blocking/reconciliation, targeted
Campaign/Session readback, removal of `saltmarcher:readback` and `readbackKey`,
draft survival, restart/next-action qualification, and warm-switch timing remain
explicitly assigned to FR2C and FR2D.

## Mental execution trace

1. The provider owns one Campaign command queue for its full lifetime. Views do
   not call Campaign capabilities directly.
2. With accepted revision `r`, command A begins and sends `r`. Command B may be
   requested while A is pending, but it cannot reach transport yet.
3. Utility rejects a stale expected revision before changing the active
   connection, Campaign directories, or registry rows. The registry transaction
   repeats the check before committing.
4. A successful mutation commits revision `r + 1` and returns that immutable
   snapshot.
5. Renderer acceptance publishes `r + 1` into the Campaign catalog and derives
   the visible active Session only from the matching Campaign cache.
6. Only after that acceptance completes may B start. B therefore selects
   `r + 1`, never the revision captured when the user originally clicked.
7. A rejected A publishes nothing. B still starts and selects the unchanged
   accepted revision `r`; failure does not poison the authority queue.
8. A rapid A to B to A switch retains both Session caches. B becomes visible
   only with B's cached Session after its command result is accepted, and the
   subsequent A result selects A's cache again.
9. A second renderer or installation-scoped internal transition cannot rely on
   this renderer queue, but its durable registry revision invalidates an older
   expected revision at Utility. The current renderer must then reconcile; the
   targeted recovery mechanism is FR2C.
10. Disposal aborts queued renderer acceptance and releases the provider-owned
    queue without creating module-global mutable state.

## Exclusions and delivery classification

FR2B deliberately uses the plain FIFO owner, not receipt reconciliation. If a
sent Campaign command commits but its response becomes `outcome_unknown`, the
current queue can continue only into a typed stale rejection; it does not yet
know the committed command identity. FR2C must add durable receipts, block that
authority while the result is unresolved, perform targeted readback, and prove
that no command is replayed.

The global capability-error event still triggers Campaign reload and route
remount. Keeping that debt executable prevents this phase from claiming
FR-A05, FR-A06, or complete FR-A07 early. Campaign import/replacement is also an
installation registry writer outside the six menu actions. It now advances the
same durable revision, but its targeted publication/reconciliation remains
FR2C.

Direct store and repository callers used by synchronous Utility recovery and
fixtures may omit an expected revision and thereby select the current durable
revision. The restricted IPC contract cannot omit it, Utility forwarding is
architecture-gated, and Utility command handlers execute synchronously. This
is an intentional internal recovery seam, not a renderer concurrency fallback;
new externally initiated commands must not use it.

Shared contracts, Utility, SQLite data, Renderer application code, and Electron
behavior change, so the Candidate SHA requires all remote checks and the
canonical exact-SHA application handoff before unchanged promotion.

## Post-implementation audit

### Exit-condition review

| FR2B condition | Evidence | Assessment |
| --- | --- | --- |
| all six Campaign lifecycle actions share one FIFO authority | one provider-owned `KeyedWriteCommandOwner`, one installation authority constant, no direct Campaign capability calls in the Workspace hook | covered |
| revisions are chosen after preceding acceptance | two commands are dispatched before the first resolves; the second transport is absent until acceptance and then receives the first result revision | covered with the durable registry oracle |
| accepted Campaign/Session identity stays coherent | controlled queued A/B/A activation selects only the matching cached Session at each accepted catalog identity | covered at projection level |
| rejection does not poison later work | a failed create is followed by an accepted queued rename using the unchanged revision | covered |
| stale external authority is rejected before side effects | integration proof checks registry rows, active identity, Campaign directories, trash, and deletion staging | covered |
| the revision is durable and complete | create, activate, rename, trash, restore, delete, restart, lifecycle commit, compensation, and recovery paths are exercised | covered for FR2B transitions |
| every IPC lifecycle input carries authority | strict Zod schemas reject missing revisions; TypeScript and architecture gates require Utility forwarding | covered |

### Negative findings and bounded follow-up

1. The first action-port implementation passed `publishCampaigns` as an
   unbound class method. Controlled acceptance immediately exposed the lost
   private-field receiver. Every command now passes an explicit bound closure,
   and all three ordering tests were rerun.
2. Adding the revision to the public snapshot exposed exact-shape fixtures in
   menu, capability, supervisor, and persistence tests. Those fixtures now
   state the expected revision rather than using partial casts; the focused
   manifest includes contract, registry, and real SQLite restart proof.
3. The first repository read converted a missing settings value through
   `Number(null)`, which could masquerade as revision zero after corruption.
   Missing and malformed durable revision state now both fail closed.
4. The first implementation reused the existing installation `settings` table
   without increasing its schema version. That looked backward-compatible but
   made first runtime startup insert revision zero after the installer's
   verified backup. The canonical handoff correctly rejected the now-changed
   data checkpoint even though runtime verification itself passed. Bounded
   follow-up replaced lazy cutover with official installation migration 37 to
   38 and migration-registry contract 10. The installer now creates and hashes
   the row before activation; runtime initialization remains idempotent. The
   key is still Campaign-owned and must not become a generic revision registry.
5. The six explicitly typed action methods contain some mechanical duplication.
   A generic helper was not introduced because it would weaken operation/input
   inference at the security boundary. The duplication is bounded to this one
   owner and is architecture-gated.
6. A successful Campaign mutation can still be followed by a failed transport
   reply or post-mutation publication effect. FR2B cannot safely infer that
   result from the old projection. This is the primary blocking debt for FR2C,
   which must add command identity and receipt-backed targeted reconciliation.
7. The existing global readback/remount path remains active and can still
   discard view state after recovery. It is retained in the executable FR0
   baseline and prevents any FR2 completion claim before FR2C.
8. Campaign import/replacement does not use the renderer menu queue. Its
   registry commit and compensation now advance the same durable revision, so
   concurrent stale menu work fails safely, but coherent targeted renderer
   acceptance is still FR2C.
9. The current phase proves projection-level switch ordering, not the final
   production-route one-second p95, persisted next mutation after recovery, or
   owner acceptance. Those remain the FR2D go/no-go gate.
10. The combined FR2A/FR2B Campaign Workspace owners moved reachable Renderer
    growth to 18,209 bytes over the 2026-08-22 baseline, 1,825 bytes beyond the
    temporary 16-KiB spike window. The repo-owned workflow recorded a new
    rationale-bearing baseline instead of hiding the change: no dependency or
    lazy-boundary changed, reachable Renderer remains at 50.4% of its hard
    budget, and the Common Workspace graph at 38.8%.

No remaining finding invalidates FR-A02 or FR-A03 for the bounded Campaign menu
command slice. FR-A05 through FR-A07 remain intentionally open; therefore FR2C
is mandatory before the broader FR2 reference slice can pass its gate.

### Pre-PR verification

- controlled implementation proof: 6 files and 32 tests passed;
- `pnpm check:frontend-robustness`: both TypeScript configurations, 19 test
  files, and 125 tests passed;
- Campaign store, replacement, import, and registry-revision integration suite:
  4 files and 44 tests passed after updating exact revision assertions;
- persistence migration, local installer crash/recovery, registry, and restart
  regression packet: 4 files and 52 tests passed with the new 37 to 38 path,
  including preservation of an already initialized revision;
- repository-wide Prettier, both TypeScript configurations, and all four lint
  partitions passed;
- the Development Main/Utility, Preload, Passive Preload, and Renderer build
  passed;
- the explicitly updated bundle baseline and all hard graph budgets passed;
  reachable Renderer is 1,522,638 bytes with 1,497,260 bytes reserve;
- built Electron smoke passed with Utility ready/clean shutdown;
- the local complete gate passed architecture (9 files/90 tests) but was
  host-blocked in its portable Unit phase: 791 of 795 tests passed, three
  unrelated Encounter Generator UI cases hit their fixed 30-second timeout,
  and the unrelated Reference Matcher measured 30.859 ms against its 16-ms
  microbenchmark while several long-running Gradle/JVM processes saturated the
  host. A one-worker retry reproduced the same timing-only failures. No timeout
  or unrelated threshold was changed; exact-Candidate remote `Check` remains
  the required clean-host gate;
- Electron journeys, exact Candidate remote checks, canonical app handoff,
  installed-runtime proof, unchanged promotion, and green Main evidence remain
  pending and must be appended before promotion.

The first exact Candidate `296f6e1aadce454c9b5e990f083e55f80a7f3945`
passed all 15 remote jobs, including the 7m38s Campaign Workspace shard. Its
handoff installed and runtime-verified artifact
`e5370195f37276c3d7679bda47d500b8699fa98095afeb5c02c9b3ae646e0096`
with two quick checks and four domain readbacks, then failed the post-runtime
checkpoint because of the lazy revision initialization described in finding 4.
That SHA is rejected and will not be promoted; final evidence must come from the
replacement Candidate containing the migration follow-up.
