# Frontend robustness FR2D qualification audit

- Date: 2026-08-25
- Delivery baseline: `origin/main@6527d08008c09b4084b21709a208a2af834750d1`
- Sprint: `FR2D` from the
  [frontend robustness roadmap](../architecture/frontend-robustness-roadmap.md)
- Gate verdict: **open / no-go for FR3**

## Sources reviewed before implementation

- the complete frontend robustness roadmap and normative acceptance matrix;
- the current Electron target architecture and historical greenfield migration
  record;
- the Campaign Management and Live Session requirements plus Live Session
  persistence contract;
- `program-technical-needs.md`, in particular the population rule, `RP-H`,
  `RP-R`, `RP-L`, `TN-11`, `TN-16`, `TN-21`, and `QS-05`;
- the FR2A, FR2B, and FR2C audit records, current Campaign Workspace projection,
  Campaign coordinator, Workspace root, installation preference owner,
  Reference owner, E2E registry, current production-route journeys, and live
  delivery state;
- live `origin/main`, the clean candidate branch, and open pull requests were
  compared before editing.

## Implementation packet

FR2D adds a bounded qualification route without introducing another state
owner.

- durable truth remains the Utility-owned Campaign registry and each
  Campaign-owned Live Session;
- the provider-lived `CampaignWorkspaceProjection` remains the only renderer
  owner for the installation Campaign catalog and Campaign-ID-keyed Session
  projections;
- the production root exposes only bounded readiness facts:
  `data-active-campaign-id`, `data-session-campaign-id`,
  `data-session-revision`, and `data-active-workspace`;
- useful Session state is accepted only when Campaign identity and Session
  authority identity match, a non-empty Session revision is published, the
  active workspace is Session, and the real `.session-mockup` exists;
- the functional journey creates A and B through the UI, performs five
  unrecorded warmups and 100 recorded alternating UI activations, applies a
  ten-second timeout to every sample, computes sorted-value p95, compares both
  complete active Session snapshots with their pre-population values, performs
  one subsequent Campaign rename through the UI, restarts Electron, and reads
  the renamed active Campaign back through the rendered Session heading;
- timing starts immediately before the Campaign-selection click. Opening the
  Campaign dialog is not part of the warm-switch stimulus;
- the existing receipt-reconciliation journey now performs a rename after the
  interrupted committed Create, restarts Electron, and verifies exactly one
  renamed Campaign;
- delivery class is app-relevant because production Renderer readiness markers
  changed. Canonical exact-SHA handoff is required before promotion.

## Product-truth resolution for view state

The pre-phase review found that an initially considered per-Campaign Rail and
layout map would contradict current product requirements. It was therefore not
implemented.

| View state | Normative scope | Campaign-switch behavior |
| --- | --- | --- |
| active Rail workspace | shell view state | Create and Activate explicitly open Session; a prior non-Session workspace is not restored. |
| Session preferred widths and center tab | installation-wide schema-v2 preference | Shared app-wide; never copied into Campaign truth or silently made per-Campaign. |
| selected Encounter/Reise scenario | focused Scene ID in the mounted Workspace root | Keyed by Scene identity for the app lifetime; it is not durable Session truth. |
| Reference navigation and pinned cards | Campaign/Scene scope in `ReferenceProvider` | Navigation is identity-keyed; pins remain memory-only as required. |
| Campaign and Session projections | installation authority plus Campaign ID | Immutable accepted projection; never treated as view state. |

This matrix is intentionally narrower than the roadmap shorthand
“per-Campaign view-state retention”. Product requirements remain authoritative:
selecting or creating a Campaign opens Session, and Session layout is app-wide.

## Local production-route evidence

The final built Electron run used the empty-installation fixture on Linux,
Electron `43.2.0` / Chrome `150.0.7871.129`, and the repository's SwiftShader
E2E route.

- warmups: `5`;
- recorded switches: `100`;
- p95: `530.138 ms`;
- maximum: `638.266 ms`;
- samples at or above the one-second target: `0`;
- samples at or above the ten-second timeout: `0`;
- A and B complete active `LiveSessionSnapshot` values after the population:
  byte-for-byte equivalent to their respective pre-population values;
- next mutation: active Campaign A renamed to
  `Qualification A confirmed` through the UI;
- restart oracle: the exact renamed Campaign identity reopened as the active
  Session after a real Electron restart;
- the separate reconciliation route retained the same Campaign dialog and
  draft across an interrupted committed Create, reconciled by receipt, then
  renamed and restored that result after restart.

The development build completed with 80 output files and output hash
`f9a76cab430bfad09dd4084d6c1dbca11e99ec990ec86429995ffdb21a8239a1`.
Canonical candidate, installed-artifact, and Main evidence remain delivery
steps after commit.

Focused local proof after the final source change:

- `pnpm check:frontend-robustness`: 23 files and 159 tests passed;
- E2E registry plus CI-matrix gates: 8/8 passed after placing the suite at its
  actual shard boundary; measured shard totals are approximately 503 seconds
  for `campaign-workspaces` and 494 seconds for `hex-npc-restart`;
- built `campaignQualification`: 1/1 passed in 4m08s with the 100-sample JSON
  record above;
- built `campaignReconciliation`: 1/1 passed in 1m42s, including the added
  rename and restart oracle.

The complete local `pnpm check` reached the portable unit phase. Format, all
lint partitions, both TypeScript projects, and 91/91 architecture tests passed.
The first run found one real registry-order error, fixed and verified above.
It also reproduced four unrelated host-sensitive historical failures: three
Encounter Generator settings cases exceeded their 30-second test timeout, and
the 16-ms Reference Matcher gate measured 30.899 ms. Single-worker isolation
still measured 31.589 ms for the Matcher and the same three settings timeouts.
No touched production path imports either feature. Those thresholds were not
weakened; clean-host remote `Check` remains authoritative for the broad gate.

## Findings and weaker-than-required evidence

1. The empty-installation fixture is not `RP-R` or `RP-L`. It contains neither
   the required object/record/media populations nor active Scenes, masks,
   travel, overrides, and pending reconciliation.
2. The run covers one Linux host only. `QS-05` requires separate populations on
   every supported Linux, Windows, and macOS environment calibrated to `RP-H`.
3. The post-population mutation is an installation-authority Campaign rename.
   It proves that a subsequent serialized mutation is durable, but it is weaker
   than `TN-16`'s safely rendered focused-Scene mutation.
4. The empty new Campaign published no inactive Roster population in the Live
   Session snapshot, so the planned Party-membership next-action oracle could
   not be executed from this fixture. That mismatch needs a product/fixture
   decision before it can serve as normative evidence.
5. An attempted `Reise` view-state assertion on the empty SwiftShader route
   exceeded the ten-second WebDriver renderer channel. The attempt was removed
   from this Campaign-only population rather than hiding it behind a longer
   timeout. It is not yet isolated sufficiently to classify as a Travel/Pixi
   product defect and belongs to FR6 qualification follow-up.
6. The Journey initially attempted inactive-Campaign Session reads. The
   capability correctly rejected that authority violation. The final oracle
   switches visibly to each Campaign before reading its active Session.
7. Manual owner acceptance of the installed exact-SHA artifact is absent.

## Gate decision and required follow-up

This slice establishes the production readiness marker, the normative
population mechanics, a green 100-sample Linux empty-profile result, complete
A/B Session equivalence, and two durable post-switch/post-recovery Campaign
mutations. It does **not** close `FR-A07`, `TN-16`, or `QS-05`.

FR2D remains no-go until all of the following are current and attached:

1. reproducible `RP-R` and `RP-L` fixtures containing the exact Campaign,
   Running Scene, mask, travel, override, media, and pending-reconciliation
   truth required by the technical-needs profile;
2. separate 5+100 warm populations on calibrated `RP-H` Linux, Windows, and
   macOS hosts;
3. complete useful-state equivalence plus a focused-Scene next mutation that is
   durable after restart for every population;
4. an isolated disposition for the empty-profile Travel/SwiftShader timeout;
5. canonical exact-SHA handoff, installed-runtime evidence, green Main, and
   explicit owner go/no-go.

FR3 must not start while those conditions remain open.
