# Frontend robustness FR2A audit

- Date: 2026-08-24
- Delivery baseline: `origin/main@8e00f1232eaddb047f32ec6d1ab4a6e2b1c59ba5`
- Sprint: `FR2A` from the
  [frontend robustness roadmap](../architecture/frontend-robustness-roadmap.md)

## Sources reviewed before implementation

- the complete frontend robustness roadmap, acceptance matrix, FR0 inventory,
  FR1A execution-contract audit, and FR1B/FR1C reference-slice audits;
- the historical Electron migration roadmap, current target architecture, and
  live frontend implementation architecture audit;
- Campaign lifecycle and live Session requirements and contracts;
- `TN-11`, `TN-16`, `TN-21`, and `QS-01` through `QS-05` in the program
  technical needs;
- current Campaign store, Utility composition, shared Zod registry, preload
  bridge, renderer Capability Provider, Workspace root, Catalog session-read
  adapter, and relevant unit, architecture, and Electron journeys;
- the live repository state, application dependencies, focused-test manifest,
  build configuration, and open pull requests.

## Implementation packet

FR2A owns the read side of the Campaign Workspace root. It replaces separate
React-owned Campaign catalog and active-Session state with one provider-lived,
identity-bound projection.

- state class: read projection;
- durable authorities: installation Campaign catalog and active Campaign's
  Utility/SQLite live Session;
- renderer authority keys:
  `{ scope: 'installation.campaign-catalog', entityKey: null }` and
  `{ scope: 'campaign.live-session', entityKey: campaignId }`;
- ordering: latest-only independently per authority key;
- acceptance: the visible Session is selected only from the cache whose
  Campaign identity equals the accepted catalog's active identity;
- lifecycle: one `CampaignWorkspaceProjection` per mounted top-level
  `CapabilityProvider`, independent of Workspace consumer remounts;
- transport identity: `session.read` requires an exact Campaign UUID, and the
  Utility rejects an ID that is no longer active with a typed retryable
  `stale` error before reading live state;
- stale recovery: a typed active-identity mismatch refreshes the catalog and
  then reads only the newly accepted active Campaign;
- write boundary: Campaign lifecycle writes still execute directly and publish
  their returned snapshot into the projection. Their FIFO/revision cutover is
  deliberately reserved for `FR2B`.

## Mental execution trace

1. The top-level Capability Provider creates the Campaign Workspace projection
   once and retains it while Workspace consumers mount and unmount.
2. Initial load invalidates the installation catalog key. A later catalog read
   supersedes an earlier one only for that same key.
3. After catalog acceptance, the owner derives the active Campaign identity and
   reads `session.read({ campaignId })` through that Campaign's own cache key.
4. The composed root can publish a Session only from the cache matching the
   currently accepted active Campaign. A late A result therefore remains in A's
   inactive cache while B is visible.
5. Switching B back to A immediately selects A's accepted cached Session. A
   lower Session revision cannot replace it.
6. If Utility reports that the requested Campaign is no longer active, the
   owner refreshes the installation catalog. If the accepted identity changed,
   it reads that identity's Session instead of retrying the obsolete A read.
7. Unsubscribing the Workspace consumer does not cancel or recreate the
   provider-owned request. A later consumer observes the same accepted cache.
8. Disposal at provider shutdown aborts acceptance, clears listeners and
   authority caches, and leaves no module-global mutable owner.

## Exclusions and delivery classification

FR2A does not serialize Campaign create, activate, rename, trash, restore, or
permanent delete. It also does not remove the global `saltmarcher:readback`
listener or `readbackKey` route remount, qualify `QS-05` timing, prove the
post-switch next mutation, or define final per-Campaign authored view-state
retention. Those guarantees belong respectively to `FR2B`, `FR2C`, and `FR2D`.

The existing root `setSession` publication port remains for Running Play
consumers. Replacing it with selectors and semantic actions is `FR3A`; removing
it in FR2A would merge sprint rows and obscure the Campaign-read guarantee.

Some feature-local Session reads remain outside the root projection, including
the Location Catalog adapter and one post-write Workspace refresh. They now
carry an explicit Campaign identity and cannot read another Campaign's active
Session silently, but their broader projection/action consolidation remains in
FR3/FR4.

The Campaign catalog contract currently has no durable revision. The owner
therefore uses request acceptance order for the installation catalog and uses
the real `LiveSessionSnapshot.revision` for each Session key. Campaign command
serialization in FR2B must ensure that exact write results are published in
FIFO acceptance order; FR2A does not pretend a synthetic catalog revision is a
durable oracle.

Source, shared contract, Utility, Renderer, and E2E inputs change, so the
Candidate SHA requires all remote checks and the canonical exact-SHA app
handoff before unchanged promotion.

## Post-implementation audit

### Exit-condition review

| FR2A condition | Evidence | Assessment |
| --- | --- | --- |
| Campaign catalog and active Session share one root owner | Capability Provider constructs one `CampaignWorkspaceProjection`; the Workspace hook consumes it via `useSyncExternalStore` | covered for the root read path |
| active Session reads carry exact identity | strict Zod input, all call sites supply `campaignId`, Utility compares it with the active Campaign before live read | covered at both IPC boundaries and domain entry |
| overlapping publication cannot mix Campaign and Session | controlled A/B promises resolve B then A; only B remains visible while A is retained by A's key | covered |
| rapid A/B/A selects only matching accepted state | controlled publication restores A's cache and rejects an older A revision | covered at projection level |
| active-identity drift converges | typed Utility `stale` result triggers catalog refresh and one read for the newly accepted Campaign | covered |
| consumer remount does not restart ownership | pending read completes with zero subscribers; a later subscriber observes the same result and one transport call | covered across provider lifetime |
| alternate React Campaign/Session state is absent | architecture scan requires `useSyncExternalStore`, rejects direct root reads and the old `setCampaigns` owner | covered for the Workspace root |

### Negative findings and follow-up

1. The first implementation still used implicit `session.read()` at feature and
   Electron-test call sites. Making the shared input strict exposed every
   caller; each now obtains or receives an exact Campaign ID.
2. The first Workspace-hook callbacks returned `Promise<boolean>` from concise
   projection publications where the command wrapper promised `Promise<void>`.
   Block-bodied callbacks now make the effect boundary explicit without casts.
3. The initial crossed-read tests advanced a fixed number of microtasks and
   were timing-sensitive. They now wait for the semantic transport call before
   resolving the controlled promises.
4. The first stale-identity test rejected with an untyped object. It now uses
   the real `CapabilityError('stale', true)`, exercising the production error
   classifier.
5. An early architecture assertion treated the retained `setSession` port name
   as proof of a second React state owner. The assertion was removed after
   source inspection: the port publishes into the keyed owner and is explicitly
   retained for FR3, while the removed `setCampaigns` state owner remains gated.
6. The Campaign catalog lacks a durable revision, so its read owner uses
   revision `0`. Latest-only request tokens protect overlapping reads, but
   unordered write-result publication is not solved by this value. FR2B must
   queue all Campaign lifecycle commands and select/publish at transport-time
   acceptance.
7. The global readback event still increments `readbackKey` and remounts the
   routed Workspace surface. FR2A retains this behavior visibly in the FR0
   baseline; FR2C must replace it with targeted Campaign/Session reconciliation
   and prove draft preservation.
8. FR2A proves projection-level A/B/A coherence, not the full `QS-05` production
   route, one-second p95, crash resume, or safe next mutation. FR2D remains the
   go/no-go owner-acceptance gate for those claims.
9. Inactive Campaign Session caches are in renderer memory only. They improve
   warm switching during one provider lifetime but are intentionally discarded
   at application shutdown; durable resume truth remains Utility/SQLite.
10. Feature-local direct Session reads are identity-safe but not yet unified
    under the Running Play projection. FR3 and FR4 must remove those alternate
    read/publication paths rather than expanding this Campaign-root owner into
    an unbounded application store.
11. The first provider integration bound `api.campaigns.list` eagerly in the
    owner constructor. The broader focused gate exposed this through existing
    UI tests that intentionally mount inactive provider capabilities with
    partial API doubles. The owner now captures a lazy operation closure and
    dereferences the transport only on its first real load; inactive provider
    capabilities remain side-effect free.
12. Strict Renderer lint rejected a synchronous menu-state update derived in a
    React effect. Empty-installation menu opening now occurs when the explicit
    projection load settles successfully, and the initial effect schedules
    that load in a microtask. This avoids an effect-driven cascading render
    while preserving initial-load and readback behavior.
13. The first Candidate build exceeded the 16-KiB reachable bundle-growth
    allowance by 10 bytes. No baseline was raised for that marginal overage; a
    renderer-internal missing-provider diagnostic was shortened, retaining the
    same failure behavior while bringing the owner cutover back inside the
    existing spike allowance. The final built graph and budget are repeated
    before the Candidate is replaced.

No remaining finding invalidates FR-A04 for the bounded Campaign root read
slice. FR-A06 and FR-A07 remain open until FR2C/FR2D; FR2B is mandatory before
the Campaign root can claim coherent switch-during-write behavior.

### Pre-PR verification

- focused TypeScript check passed for both main and Renderer configurations;
- controlled proof: 4 files and 21 tests passed, including contract, Utility
  identity rejection, crossed reads, A/B/A cache selection, stale recovery,
  provider-lifetime ownership, baseline, and architecture gates;
- no zero-argument `session.read()` call remains in `src/` or `tests/`;
- `pnpm check:frontend-robustness`: both TypeScript configurations, 16 test
  files, and 106 tests passed on the final pre-commit tree;
- all Core, Electron-tooling, Renderer, and test lint partitions passed;
- repository-wide Prettier check and `git diff --check` passed;
- the Development Main/Utility, Preload, and Renderer production build passed;
- final reachable bundle growth is 16,382 bytes, two bytes inside the 16-KiB
  spike allowance; all shell, Workspace, lazy-route, Pixi, and total budgets
  passed without changing their baselines;
- the existing full `campaignCreate` Electron scenario was attempted on the
  built output and timed out at its 180-second suite limit after repeated
  30-second renderer script timeouts in its host-intensive visual/settings
  section; failure screenshots also timed out, so the run provides no semantic
  Campaign-switch verdict and is not counted as passing evidence;
- exact Candidate remote jobs, canonical app handoff, installed-runtime proof,
  unchanged promotion, and green Main evidence remain pending and must be
  attached before promotion.
