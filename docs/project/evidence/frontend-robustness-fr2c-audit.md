# Frontend robustness FR2C audit

- Date: 2026-08-24
- Delivery baseline: `origin/main@a3119d288952698e02c53c18270cf8c887ab7116`
- Sprint: `FR2C` from the
  [frontend robustness roadmap](../architecture/frontend-robustness-roadmap.md)

## Sources reviewed before implementation

- the complete frontend robustness roadmap and normative acceptance matrix;
- the complete historical Electron greenfield roadmap and current target
  architecture;
- Campaign lifecycle, Session resume, `TN-01` through `TN-24`, and `QS-01`
  through `QS-05`, with particular attention to `TN-11`, `TN-15`, `TN-16`,
  and `TN-21`;
- the FR2A/FR2B Campaign Workspace projection and command owner, the FR1C
  receipt-reconciliation reference, strict Campaign operation contracts,
  Utility composition, Campaign store, registry repository, filesystem and
  lifecycle recovery, Workspace route host, generic capability-error path,
  current focused/architecture/Electron evidence, and live delivery state;
- live `origin/main`, open pull requests, the clean worktree, and the installed
  exact-SHA handoff evidence were compared before editing.

## Implementation packet

FR2C owns targeted reconciliation for the six installation-scoped Campaign
lifecycle commands and removal of the broad data-recovery remount.

- durable truth: Campaign registry plus a bounded installation-owned command
  receipt journal;
- renderer authority: `{ scope: 'installation.campaign-catalog', entityKey:
  null }`;
- command identity: one UUID retained from dispatch through transport,
  receipt lookup, explicit retry of lookup, acceptance, and error reporting;
- result: an operation-specific immutable receipt carrying the exact accepted
  Campaign snapshot and affected identity;
- ordering: the existing provider-lived FIFO remains the sole command queue;
  receipt reconciliation runs inside the same authority queue and blocks later
  Campaign transports while unresolved;
- recovery: `outcome_unknown` reads only the same command receipt. A present
  compatible receipt follows normal acceptance; an interrupted receipt read
  remains visibly pending; an absent receipt triggers targeted Campaign and
  active-Session readback but never resends the mutation;
- persistence: completed receipts commit in the same installation SQLite
  transaction as the visible registry revision. Creation retains its command
  identity across the pre-commit filesystem boundary so startup recovery can
  finish the same receipt;
- consumer behavior: the Campaign dialog remains mounted and disables further
  lifecycle submission while reconciliation is pending; explicit `Pruefen`
  retries only receipt lookup;
- recovery lifetime: after the first successful Utility start, a later Core
  recovery overlays status without replacing the Workspace tree. The open
  Campaign view is retained when recovery readback changes `forced` from true
  to false, and Modal busy semantics prevent close, Escape, or backdrop draft
  loss while a receipt is unresolved;
- remount removal: `saltmarcher:readback`, `readbackKey`, and the data-driven
  `ModuleHost` key are removed. Module/render failure recovery stays owned by
  `ModuleHost` and Main;
- delivery class: contracts, Utility, SQLite, Renderer, Electron behavior, and
  schema change make this app-relevant and require canonical exact-SHA handoff.

## Mental execution trace

1. Dispatch creates one command ID before joining the installation authority
   queue; no retry creates a second ID.
2. At transport time the command selects the latest accepted registry revision
   and Utility first checks for an existing compatible receipt.
3. A normal commit advances the registry and persists the exact receipt in one
   transaction. Renderer accepts its snapshot before the next queued transport.
4. If transport returns `outcome_unknown`, renderer reads that command ID. A
   receipt is accepted exactly like the original response and the command is
   never replayed.
5. If receipt reading is interrupted, the authority records that command as
   pending. Later lifecycle actions are blocked and the still-mounted dialog
   exposes an explicit check action that retries only the read.
6. If the receipt is conclusively absent, targeted catalog and matching active
   Session reads reconcile projection truth. The original command is still not
   replayed and the broad Workspace route is never remounted.
7. A create interrupted after its staged store is promoted retains pending
   command metadata. Startup finalization commits the same command receipt;
   failed incomplete creation removes both the partial registry row and its
   pending command.
8. Trash and permanent delete commit receipts with their registry marker;
   existing startup filesystem convergence completes remaining movement
   without duplicating the visible transition.
9. Unmount disposes only renderer coordination. Durable receipts survive
   restart, and a later provider read reconstructs current Campaign/Session
   truth without a data-driven React key change.

## Exclusions

FR2D still owns warm-switch p95 populations, the production next-mutation
oracle, final per-Campaign view-state retention, and owner go/no-go. FR2C does
not migrate Running Play, Catalog, Planner, Hex, or Travel authorities and does
not add a second Campaign projection owner.

## Post-implementation audit

FR2C is internally coherent and ready for canonical delivery. The delivered
slice replaces uncertain Campaign writes with one explicit, bounded protocol;
it does not add a competing state owner or a second refresh channel.

### Findings resolved during implementation

1. Zod validation creates a new object. Returning that object directly from
   `CampaignStore` had silently removed the repository's deep freeze. The
   Store boundary now freezes the parsed receipt and nested snapshot again.
2. A conclusively absent receipt originally started targeted readback only
   after the authority queue had been released. A following command could
   therefore select the pre-readback revision. `KeyedWriteCommandOwner` now
   performs adapter-owned absent-receipt reconciliation inside the same queue.
3. An explicit receipt retry that returned `null` cleared the command owner's
   pending marker but initially left the Campaign projection's UI marker set.
   Terminal retry failure now clears both owners before reporting the unknown
   outcome.
4. `WorkspaceApp` replaced the complete Workspace tree whenever Utility left
   `ready`, so a process-loss reconciliation still unmounted the Campaign
   dialog even after removal of `readbackKey`. After the first ready state the
   shell now remains mounted and exposes the existing status banner over the
   retained tree.
5. When recovery readback published the first active Campaign, `forced`
   changed from true to false. The menu then exposed its hidden default view
   and unmounted the dialog. The open menu now owns an explicit instance whose
   initial view is selected at open time and retained until that instance is
   closed.
6. The pending fieldset blocked lifecycle buttons but the dialog could still
   close via its close button, Escape, or backdrop. Receipt pending now uses
   the modal layer's existing busy contract, preserving all local drafts until
   receipt acceptance or conclusive absence.
7. Create activation committed the registry receipt before opening the active
   Campaign connection. The order is now validate/open first, transactionally
   commit second, and restore the prior connection if commit fails; no
   fallible step remains after a successful create/activate receipt commit.
8. Structural receipt schemas allowed snapshots that contradicted their
   operation. Shared contracts now reject invalid active/available/trashed/
   deleted relationships, while Create and Rename acceptance additionally
   verifies the command's expected name.
9. The first clean-host matrix showed that the pre-existing Session Generation
   journey still assumed Utility recovery unmounted its open Settings dialog.
   It attempted to reopen the burger menu through the intentionally retained
   modal backdrop. The journey now continues with the same retained dialog and
   only reopens Settings when that dialog is genuinely absent.

### Resulting ownership and recovery path

- Shared contracts own six strict command inputs, six operation-specific
  receipts, semantic snapshot invariants, and `campaign.commandReceipt`.
- Utility and `CampaignStore` own command idempotency. Completed receipts and
  registry revision commit in one SQLite transaction; a same-ID/different-
  request reuse fails with `idempotency_conflict`.
- Installation schema `39` and migration-registry contract `11` add
  `campaign_commands`; completed history is pruned to 512 records while a
  pending Create identity survives until completion or incomplete-create
  cleanup.
- The provider-owned `CampaignWorkspaceProjection` remains the only renderer
  Campaign/Session projection and the only Campaign command owner. Receipt
  absence waits for targeted Campaign plus matching active-Session readback
  before a later queued command selects its revision.
- Generic capability formatting is side-effect free. No production source
  contains the former global readback event, `readbackKey`, or a data-driven
  `ModuleHost` key.

### Local proof before delivery

- `pnpm check:frontend-robustness`: 22 files and 153 tests passed, including
  controlled present/absent/interrupted receipt cases, same-authority ordering,
  all six durable lifecycle receipts, restart recovery, bounded history,
  schema migration, draft retention, and semantic architecture gates.
- focused current-state verification: 67/67 tests passed and
  `pnpm check:version-truth` confirmed installation schema `39`, Campaign
  schema `34`, and migration registry `11`.
- built Electron production route:
  `campaign-reconciliation.e2e.ts` passed 1/1. It retained the identical dialog
  DOM node and `Receipt E2E` draft across an interrupted committed
  `campaign.create`, disabled lifecycle controls, reconciled only by the same
  receipt identity, and read back exactly one persisted Campaign.
- `pnpm build` completed after the final source audit with 80 files and
  development output hash
  `47a0281fb02dc5918a8dcdefac01b124bfb17bb8cda6daff033fa9adaff35aee`.
  Canonical exact-SHA artifact evidence remains a delivery step after commit
  and remote Check.

### Observed false starts and their disposition

- The first broad `campaignCreate` attempt exhausted its existing 180-second
  visual/accessibility route on the local software renderer before reaching a
  new assertion. FR2C received an independent, fixture-owned functional suite
  instead of weakening that broad journey.
- The first bounded Electron run exposed finding 5 because the receipt button
  disappeared after recovery readback. It passed after the explicit open-view
  lifetime fix.
- The first clean-host remote matrix exposed finding 9 in the pre-existing
  Session Generation journey: its next menu click was correctly intercepted
  by the retained Settings modal. The focused local reproduction matched the
  remote trace, so the journey's stale remount assumption was fixed rather
  than retrying the failed product-classified shard.
- Two focused runs exposed resource-sensitive historical tests: a full
  `CampaignStore` preserve-policy test took 30.85 seconds under parallel load
  but passed isolated in 26.43 seconds, and a lazy settings import exceeded the
  DOM library's one-second default. The FR2C manifest now selects the dedicated
  receipt and reconciliation files; the historical lazy assertion also has a
  bounded ten-second wait. No product assertion was removed or relaxed.
- The local broad portable Unit phase later ran concurrently with a pre-existing
  CPU-heavy Gradle/Kotlin process. Four historical Encounter settings tests hit
  their 30-second timeout and the unrelated 16-ms Reference Matcher gate
  measured 31.984 ms; an isolated single-worker rerun reproduced the host-load
  condition. All FR2C-focused checks and the built Electron route remained
  green. The required clean-host remote Check is therefore retained as the
  authoritative broad gate rather than weakening either historical threshold.

FR2D remains the required gate for the one-second warm-switch p95 population,
the post-recovery next-mutation production oracle, complete per-Campaign view-
state retention, and owner go/no-go.
