# Frontend robustness FR2G1 Current-Format timing audit

Date: 2026-08-25

Baseline: `7716d9bdaab6d8be58c8a85251327fc555912156`

Verdict: the Current-Format production timing and semantic oracle are complete.
A clean Candidate population measured p95 `378.011 ms` and maximum
`452.992 ms` across 100 coherent switches, then durably preserved the focused-
Scene next mutation across restart. The deliberately overloaded local host did
not meet p95 and remains recorded as a negative result, not qualification
evidence. `FR2G2` owner architecture go/no-go and exact cross-platform `RP-R`/
`RP-L` `QS-05` remain open.

## Reviewed current truth and phase split

The mandatory pre-phase review covered the complete frontend robustness
roadmap and acceptance matrix, `TN-11`, `TN-16`, `TN-21`, `QS-05`, the target
and Electron migration architectures, every FR2D--FR2F3B audit, the complete
Current-Format owner manifest/materializer/readback chain, Campaign Workspace
projection and coordinator, production root readiness contract, focused Scene
mutation path, E2E registry/runner/configuration, current Candidate/Main state,
open pull requests, and the prior empty-profile and Current-Format Electron
journeys.

The review found that the former `FR2G` row joined two guarantees with different
authorities. The roadmap now separates:

1. `FR2G1`: executable Current-Format production timing, complete useful-state
   equivalence, and the focused-Scene next-action/restart oracle; and
2. `FR2G2`: an explicit human owner architecture go/no-go based on the completed
   FR2 evidence.

An automated test cannot manufacture the second decision. This packet closes
only `FR2G1`; its clean-host Candidate evidence met every unchanged threshold.

## Implementation packet

No production authority changes. Durable Campaign and Session truth remains in
Utility-owned aggregates. The provider-lived `CampaignWorkspaceProjection`
remains the only renderer owner for the installation Campaign catalog and
Campaign-ID-keyed active Session projections. The rendered Workspace remains a
consumer through `useSyncExternalStore`; it owns only view state and publishes
accepted Session results back through the same owner.

The existing v5 `frontend-robustness-current-format-completion-v1` journey is
extended instead of creating a second fixture or competing oracle. In one
fresh Electron process it:

1. materializes all 20 Campaign and 5 installation owner dispositions through
   the established public-owner qualification path;
2. settles Current Format B's intentionally historical Travel checkpoint,
   then records immutable complete B and A Session baselines;
3. proves the existing `B -> A -> B -> A` control sequence;
4. performs five unrecorded alternating warmups;
5. performs 100 alternating UI activation samples, timing from the Campaign
   selection click through identity-bound rendered Session readiness and
   Campaign-dialog closure;
6. after every measured switch, outside the timing window, reads the complete
   active `LiveSessionSnapshot` and requires exact equality with its A or B
   baseline;
7. sorts the 100 samples, uses rank 95 as p95, requires p95 below one second,
   and requires every sample below the existing ten-second timeout;
8. switches to A, changes the focused Scene Location through the rendered UI,
   and requires exactly one Scene/Session revision advance; and
9. restarts Electron and requires the complete post-command Session snapshot
   to equal the committed result.

The timing observation is emitted before threshold assertions so a failed run
retains its complete sample population. The semantic completion record is
emitted only after the mutation and restart oracle pass.

## Negative audit and rejected shortcuts

1. The first expanded local run exposed the global 180-second Mocha spec limit
   at sample 30. This was a harness budget, not a switch timeout. The final
   configuration gives only `currentFormatCampaignQualification` a 600-second
   overall spec budget. The one-second p95 and ten-second per-sample product
   thresholds are unchanged.
2. Failure screenshots against the already timed-out renderer repeatedly
   consumed further ten-second WebDriver waits. That known diagnostic cost did
   not cause the original assertion and is not counted as product timing.
3. A complete second local population reached all 100 coherent samples but
   measured p95 `1483.255 ms`, above the required one second. During the run the
   host load average was approximately 14--18, dominated by unrelated parallel
   Gradle/Robolectric processes. The result is an honest local no-go and must
   not be relabelled as passing evidence. The independent clean Candidate
   population is the phase timing evidence.
4. Dialog opening is excluded from the stimulus exactly as in the established
   FR2D protocol. Snapshot equality reads occur after each timed readiness
   interval, so oracle cost cannot improve or contaminate a sample.
5. Current Format B is baselined only after its historical Travel checkpoint
   is reconciled by the production scheduler. Comparing pre-start historical
   bytes to legitimate post-start truth would be an invalid oracle.
6. This fixture is the complete currently representable format, not `RP-R` or
   `RP-L`. It adds no calibrated `RP-H`, supported-OS matrix, future state
   classes, resource profile, cold/crash population, or completed `QS-05`
   claim; those remain `FR7B` work.
7. The Campaign Workspace architecture decision remains explicitly absent.
   Even a green Candidate timing population cannot decide `FR2G2` on the
   owner's behalf or authorize FR3.

## Proof packet and delivery class

- focused Prettier and ESLint: passed after the scoped suite-timeout fix;
- E2E registry and CI matrix: passed;
- `pnpm typecheck`: passed for both TypeScript projects;
- `pnpm check:frontend-robustness`: 31/31 files and 203/203 tests passed;
- first local Electron attempt: stopped by the former 180-second suite limit at
  sample 30;
- second local Electron attempt: 100 coherent samples, p95 `1483.255 ms`, then
  correctly failed the unchanged one-second threshold under unrelated host
  load; no completion claim;
- clean-host Candidate run `32869874511` on
  `47efaad8bfba45d0e3ce950e254239907ee36d4a`: complete Check and exact-SHA
  aggregate passed;
- `currentFormatCampaignQualification`: 1/1 passed in 2 minutes 33 seconds on
  Linux, Electron `43.2.0` / Chrome `150.0.7871.129`;
- remote population: 5 warmups, 100/100 exact A/B Session snapshots, p95
  `378.011 ms`, maximum `452.992 ms`, zero samples at or above one second and
  zero samples at or above ten seconds;
- semantic oracle: Scene revision `8 -> 9`, Location
  `Salt Harbor -> Unterbrochene Küstenwacht`, and complete committed snapshot
  equality after Electron restart;
- the complete `hex-npc-restart` shard passed in 9 minutes 48 seconds; its
  registry estimate is updated to the measured 153 seconds for this suite.

The packet changes one E2E qualification journey, its typed registry, scoped
Webdriver test configuration, the roadmap split, and this audit only. It changes
no `src/`, resource, dependency, Electron build, or packaging input. The app-
build fingerprint must remain unchanged; no AppImage handoff is required.
