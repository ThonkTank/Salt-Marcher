# Frontend robustness FR2G2 owner architecture decision

Date: 2026-08-25

Decision baseline: `origin/main@eeec3abdd2637a6d75f6c42081dd7777a4774560`

Status: **NO-GO recorded; bounded FR2G2 follow-up implemented; owner
re-decision pending**

The original recommendation below was superseded by the owner's explicit
**NO-GO** on 2026-09-02 after a valid empty-profile Campaign creation exposed a
provider-lifecycle defect. The bounded follow-up is recorded in
[`frontend-robustness-fr2g2a-provider-lifecycle-followup.md`](frontend-robustness-fr2g2a-provider-lifecycle-followup.md).
FR3A remains unauthorized until the owner reviews that delivered follow-up and
records a new explicit GO.

## Original decision request

Choose exactly one outcome after reviewing this packet:

- **GO** — accept the Campaign Workspace ownership model as the FR2 reference
  architecture and authorize the bounded FR3A migration; or
- **NO-GO** — name a concrete blocking defect in the FR2 owner or its evidence.
  The defect must receive a bounded FR2 follow-up before FR3 starts.

Until the owner records one of those outcomes, `FR2G2` and the FR3 entry gate
remain open. Tests, audits, CI, and this recommendation cannot substitute for
that explicit decision.

## Owner decision — 2026-09-02

**FR2G2 NO-GO — blocking defect:** under the application's root React
`StrictMode`, the top-level `CapabilityProvider` constructed its stateful
projection owners during render and disposed the retained instances during
StrictMode's probe cleanup. The following setup reused those permanently
disposed instances. A valid `createCampaign("test")` therefore stopped before
transport, produced no Campaign registry entry, and surfaced only
`Unbekannter Fehler`.

The owner explicitly selected formal NO-GO handling for this defect. It is a
Campaign Workspace ownership failure and must be closed as a bounded FR2G2
follow-up, not shipped as unrelated polish or used to authorize FR3A. A
successful follow-up, Candidate check, exact-SHA handoff, Main promotion, and
installed-runtime proof resolve the named blocker but do not manufacture the
subsequent owner GO.

## Sources and live state reviewed

The mandatory pre-phase review covered:

- the complete frontend robustness roadmap and acceptance matrix, especially
  the FR2 exit conditions and `FR-A06`/`FR-A07`;
- `TN-11`, `TN-16`, `TN-21`, `QS-05`, the Electron target architecture, and
  the historical Electron migration Go/No-Go boundaries;
- every FR2A--FR2G1 audit and their negative findings;
- the baseline root at
  `7590d6653dc29f8c258529634caa28893320eebe` and the live
  `CampaignWorkspaceProjection`, Campaign coordinator, Workspace root,
  operation contracts, Utility handlers, invalidation path, architecture
  gates, controlled unit tests, reconciliation E2E, Current-Format fixture,
  production timing, and next-action/restart journey;
- live `origin/main`, the clean worktree, merged PRs #649--#651, their exact
  Candidate/Main runs, and all currently open PRs.

Open PR #628 changes iteration tooling and architecture prose but does not
replace the Campaign owner. Open PR #596 changes Running Play code on an older
branch but is not current product truth. Neither unmerged branch is evidence
for this decision; both must rebase and satisfy the then-current gates before
promotion.

Installed-runtime evidence is not applicable to this architecture-only
decision. FR7C retains installed exact-SHA visible-cutover acceptance.

## Baseline-to-target comparison

| Concern | FR0 baseline | Current FR2 result | Assessment |
| --- | --- | --- | --- |
| Campaign catalog owner | Hook-local `useState` populated by direct reads | One provider-lived keyed projection on `installation.campaign-catalog` | pass |
| active Session owner | Separate Hook-local `useState`, published after the catalog | Campaign-ID-keyed cache composed only against the accepted active catalog identity | pass |
| overlapping reads | Any completion could call `setCampaigns`/`setSession` | crossed results remain in their authority cache; only current identity becomes visible | pass |
| lifecycle writes | direct create/activate/rename/trash/restore/delete calls from the Hook | one FIFO receipt owner; registry revision selected at transport time | pass |
| unknown outcomes | global event plus broad reload/readback | exact command receipt, blocked authority while unknown, targeted truth readback, never replay | pass |
| recovery lifecycle | `readbackKey` remounted workspace routes | no data-driven React key; mounted dialog/draft survives reconciliation | pass |
| invalidation | consumers could independently reload root truth | one active-Session event subscription accumulated by the provider owner | pass |
| readiness | Campaign and Session could temporarily disagree | root readiness requires matching active Campaign ID, Session authority ID, revision, route, and rendered Session | pass |
| current-format coverage | empty/name-only evidence | executable 20/20 Campaign plus 5/5 installation owner manifest and A/B fixture | pass |
| production behavior | no complete-format population | 5+100 UI switches, complete snapshot oracle, focused-Scene mutation, restart readback | pass |

## Exit-condition evidence

| FR2 exit condition | Current evidence | Result |
| --- | --- | --- |
| rapid A/B/A and overlapping reads remain coherent | controlled Campaign projection tests cover crossed reads, cached A/B/A publication, queued A/B/A activation, active-authority rejection, and consumer-independent lifetime | met |
| switch-during-write and revision choice are deterministic | same-authority lifecycle commands queue; accepted registry revision is selected inside transport; failures do not poison the next command | met |
| unknown outcome is reconciled without replay | exact receipt present, receipt lookup interrupted, absent receipt, and next-command-after-readback cases are controlled; the Electron journey keeps the dialog and draft mounted | met |
| recovery does not remount or discard draft | semantic gates reject `saltmarcher:readback`, `readbackKey`, and route-host data keys; reconciliation E2E preserves the authored draft | met |
| complete current format is reproducible | owner drift gate requires exactly 20 Campaign and 5 installation primary dispositions; public materializers and independent readback preserve both semantic hashes | met |
| production-route useful-state equivalence | Current Format B is reconciled once, then every one of 100 measured A/B activations matches the complete immutable baseline for that Campaign | met |
| warm reference p95 below one second, each below ten seconds | exact final Candidate run `32871402283`: p95 `369.187 ms`, maximum `424.928 ms`, 100/100 samples | met |
| safely rendered next mutation survives restart | focused Scene Location changes from `Salt Harbor` to `Unterbrochene Küstenwacht`, Scene revision `8 -> 9`; complete committed snapshot equals restart readback | met |
| lifecycle complexity is reduced | implicit competing React owners/remount recovery are replaced by one explicit application owner and semantic gates; see the complexity caveat below | met with caveat |
| owner architecture acceptance | this document requests it but cannot supply it | **pending** |

## Architecture assessment

The replacement is fundamentally aligned with the target architecture:

- Utility remains the only durable Campaign/Session authority and database
  owner; the renderer receives immutable validated results through the narrow
  capability bridge.
- One provider-lived application adapter owns catalog projection, Campaign-
  keyed Session projections, lifecycle command ordering, receipts, and exact
  invalidation accumulation. React consumes it through
  `useSyncExternalStore`.
- Campaign writes use one installation authority because all lifecycle
  operations mutate the same registry. Session projections remain keyed by
  Campaign identity, so accepted inactive results cannot replace visible
  authored state.
- Unknown write outcomes become explicit pending reconciliation. The next
  Campaign command cannot overtake that uncertainty, and recovery never
  blindly repeats the mutation.
- View state remains in the mounted Workspace. Product truth resolved the
  roadmap shorthand: Campaign activation opens Session, Session layout is an
  installation preference, and Scene scenario selection is keyed by Scene for
  the app lifetime rather than invented as Campaign durable truth.

This is a sound reference slice for applying the same ownership principles to
Running Play. It is not a reason to turn the Campaign owner into a generic
store, service locator, or template copied without semantic authority design.

## Negative audit and residual risks

1. Explicit code volume increased. The baseline Hook was small because it hid
   ordering, cache, receipt, recovery, and publication rules in uncontrolled
   promise completion and React setters. `CampaignWorkspaceProjection` is now
   roughly 600 lines plus shared primitives and extensive tests. That is an
   acceptable trade only while it remains one cohesive Campaign-root
   application boundary. If it gains unrelated feature truth, split internal
   collaborators without creating a second public owner.
2. The Workspace still adapts the accepted Session projection into a
   `setSnapshot` port for Running Play children, and several child writes still
   use latest-only mutation scopes. These are recorded FR3 defects, not hidden
   FR2 success. FR3A--FR3D must replace them with the keyed Running Play owner,
   selector/action ports, FIFO semantic authorities, patches, and pending
   dependent state.
3. The clean timing evidence is one Linux Candidate environment and the
   complete current format, not calibrated `RP-H`, exact `RP-R`/`RP-L`, or the
   supported-OS matrix. FR7B retains final `QS-05`; this decision must not be
   cited as that qualification.
4. Current Format B's historical Travel checkpoint legitimately reconciles
   once before its stable baseline. FR2 does not prove all future background
   work, cancellation, spatial recovery, or simultaneous Running Play
   mutations; FR3, FR5, FR6, and FR7 own those guarantees.
5. The local timing host failed p95 at `1483.255 ms` under unrelated load
   approximately 14--18. The independent clean Candidate population passed.
   Both results remain visible; the local failure must not be erased or used to
   weaken the one-second target.
6. No installed-artifact owner walkthrough or visible-cutover acceptance is
   claimed. FR7C remains the final installed-runtime owner gate.
7. The historical M1 Pixi/Babylon integrated-GPU, scaling, accessibility, and
   context-loss Go/No-Go is separate. A GO here authorizes the FR3 renderer-
   state migration only; it does not close M1 or authorize unrelated product
   expansion.

## Exact owner response contract

The owner can close this gate by replying with one of these forms:

```text
FR2G2 GO — I accept the Campaign Workspace replacement architecture and
authorize FR3A. I understand that M1 rendering qualification, exact QS-05,
the remaining FR3-FR7 migrations, installed-runtime acceptance, and final
visible cutover remain open.
```

```text
FR2G2 NO-GO — blocking defect: <concrete owner/evidence defect>.
```

A GO will be recorded verbatim with date and decision baseline in this file;
a NO-GO will produce a bounded follow-up packet before any FR3 implementation.

## Verification and negative gate finding

- focused Prettier for this decision packet: passed;
- `git diff --check`: passed;
- the complete local `pnpm check` passed repository formatting and all four
  lint partitions (`core`, `electron-tooling`, `renderer`, and `tests`), then
  entered typecheck;
- after approximately 30 minutes total wall time, the execution environment
  terminated the still-active typecheck with signal exit `143`. During the run
  unrelated Gradle/Robolectric work held load average at approximately 18--24.
  Kernel logs contain no OOM record, and TypeScript emitted no diagnostic;
- the interrupted local run is not called green and no timeout, threshold, or
  source rule was changed. Clean-host Candidate `Check` is the complete
  repository gate for this documentation-only packet.

## Delivery classification

The original decision packet changed documentation only. The owner NO-GO and
its linked follow-up now accompany an app-relevant Renderer lifecycle change.
That final Candidate must pass the complete remote check and canonical
exact-SHA AppImage handoff before unchanged Main promotion. Even after that
delivery, `FR2G2` remains at **NO-GO resolved; owner re-decision pending** until
the owner explicitly supplies the next decision.
