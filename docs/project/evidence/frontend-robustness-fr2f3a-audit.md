# FR2F3A Current-Format next-action/restart audit

Date: 2026-08-25

Baseline: `9f136af94ba0cfddabdf5058415cee5d6105eba0`

Verdict: the Current-Format focused-Scene next-action/restart oracle is
complete. `FR2F3B`, `FR2G`, and exact cross-platform `RP-R`/`RP-L` `QS-05`
qualification remain open.

## Reviewed current truth and phase split

The mandatory pre-phase review covered the FR2 roadmap and acceptance matrix,
`TN-16`, `QS-05`, the Electron target and migration architectures, every
FR2D--FR2F2C2B audit, the complete Current-Format fixtures and public owner
materializers, the Campaign Workspace projection, the Scene production UI,
the Travel scheduler, the Webdriver/Electron configuration, and the existing
empty-profile Campaign and Travel E2E journeys.

The original `FR2F3` row combined two independently falsifiable guarantees.
It is split into:

1. `FR2F3A`: complete Current-Format production-route A/B/A equivalence plus a
   focused-Scene next mutation and restart readback; and
2. `FR2F3B`: an isolated Travel/SwiftShader disposition that neither borrows a
   Campaign-switch pass nor contaminates FR2G timing.

The versioned roadmap records that split. This packet closes only `FR2F3A`.

## Closed guarantee

The E2E materializer now has a strict v5 descriptor for the already-versioned
`frontend-robustness-current-format-completion-v1` fixture. It invokes the
existing completion qualification rather than introducing a second seed path.
Before Electron starts, that path still proves:

- 20/20 Campaign registrations and 5/5 installation authorities;
- the controlled World Location interruption and exact-command
  reconciliation; and
- semantic hashes
  `862037f4b248feb7fd0455baad01658ffb7e56846458e22682198248d15ff596`
  for A and
  `516a909a2b25549561f66148a77c0ae30d23de195e1d04a461733bdcea610ebf`
  for B.

The new production Electron journey then:

1. starts the real GM renderer on Current Format A;
2. activates B and lets the production scheduler reconcile its deliberately
   active historical Travel checkpoint before taking the runtime baseline;
3. records complete immutable `LiveSessionSnapshot` baselines for B and A;
4. performs visible `B -> A -> B -> A` switches and requires exact snapshot
   equality after every activation;
5. proves that A still has an inactive Party sentinel, focused `Salt Harbor`,
   and an initiative Combat;
6. changes the focused Scene Location through the rendered `Scene-Ort` select
   to `Unterbrochene Küstenwacht`;
7. requires the same focused Scene identity and exactly one Scene/Session
   revision advance, from `8` to `9`; and
8. restarts the Electron session and requires the complete post-command
   `LiveSessionSnapshot` to be exactly equal to the committed result.

The local built journey passed 1/1 in 1 minute 46 seconds of test time. Its
total isolated suite time, including reproducible fixture creation and Electron
startup, was 2 minutes 56 seconds. The emitted record declares only
`current-format-focused-scene-oracle-not-rp-r-or-rp-l`.

## Negative audit and rejected shortcuts

1. The older FR2D empty-installation journey was not relabelled. It remains a
   mechanics baseline and still cannot represent the Current-Format gate.
2. Current Format B intentionally contains a travelling checkpoint created by
   a controlled historical clock. Production startup legitimately reconciles
   it against the current clock. The journey waits for that owner transition
   once and takes its B runtime baseline afterward; it does not compare an
   impossible pre-start travelling byte image with post-start truth.
3. The first diagnostic draft called `hexTravel.read` without its required
   `sceneId`. Repeated rejected Webdriver executions eventually reproduced the
   generic renderer-channel timeout. The final journey supplies the focused
   Scene authority and passes. That test defect is not reported as a product or
   SwiftShader disposition.
4. This packet does not open Reise, instantiate Pixi, identify the active GPU
   renderer, or classify the historical empty-profile timeout. Those are the
   explicit `FR2F3B` gates.
5. It records no 5+100 population, p95, calibrated-host, cross-OS, memory, CPU,
   or final `QS-05` claim. Current-format production timing and owner go/no-go
   remain `FR2G`; exact `RP-R`/`RP-L` remains `FR7B`.
6. The production journey does not manufacture another persistence owner or
   use raw fixture SQL. Complete-owner materialization stays behind the prior
   public-owner qualification boundary; the next mutation enters through the
   real renderer UI.

## Proof packet and delivery class

- strict v5 fixture materialization completed with exact-one coverage and both
  established semantic hashes;
- `pnpm typecheck`: passed;
- `pnpm check:frontend-robustness`: 31/31 files and 203/203 tests passed;
- `pnpm test:e2e:built --suite currentFormatNextAction`: 1/1 passed on Linux,
  Electron `43.2.0` / Chrome `150.0.7871.129`;
- development build: 80 files, output hash
  `7d2d9349196a1ff11999ab244110eec0f726f58bd249e490eab6f29fa3913d57`;
- the complete local `pnpm check` passed formatting, every lint partition,
  typecheck, and 91/91 architecture tests. Its portable Unit phase reproduced
  only the unchanged host-sensitive failures already present in the C2B
  baseline: four Encounter Generator Settings cases exceeded their 30-second
  timeout and the 16 ms Reference Matcher gate measured `33.71 ms`; the total
  was 804/809 tests green. A one-worker isolation produced the same four
  Settings timeouts and measured `33.887 ms` for the Matcher, with 11/16 tests
  green. Neither affected test nor its production path is changed here, and no
  threshold was weakened. Clean-host Candidate CI remains the broad delivery
  gate.

The changed runtime scripts are classified as qualification inputs, and the
new descriptor/spec are test inputs. No `src/`, resource, dependency,
Electron/build, or packaging input changes. The app-build fingerprint remains
`f4a545959738c83b8ee3c88ed2b62df55d021ffa992ed46bc8984140917e63c6`;
this packet therefore uses the documentation/test delivery path and requires
no AppImage handoff.
