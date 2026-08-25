# FR2F3B Travel/SwiftShader isolation audit

Date: 2026-08-25

Baseline: `8a6912547cdae8f52925686c982372800d7aadfe`

Verdict: the historical empty-profile Travel/SwiftShader timeout has an
isolated disposition. Empty and mapped Travel routes both start under the
repository's real SwiftShader Electron configuration, the mapped route creates
an actual SwiftShader WebGL 2 Pixi context, and that context accepts the next
map interaction. `FR2G` and exact cross-platform `RP-R`/`RP-L` `QS-05` remain
open.

## Reviewed current truth

The mandatory review covered the FR2 roadmap and prior FR2D--FR2F3A audits,
the target and Electron migration architectures, `TN-16`, the original
empty-profile timeout record, `wdio.conf.ts`, the E2E registry/runner and
failure diagnostics, the v2 Travel fixture and materializer, the production
Travel integration/provider/controller, Pixi map surface and WebGL utilities,
the comprehensive `session-travel` E2E, runtime GPU observation capability,
and current clean `origin/main`/PR state.

The review retained `FR2F3B` as one independently closed guarantee. It adds no
Campaign timing or Current-Format owner claim and does not reopen `FR2F3A`.

## Closed guarantee

One dedicated functional suite uses the established v2 mapped Travel fixture
and one Electron process:

1. it creates a second empty Campaign through the rendered Campaign UI;
2. it invokes the exact quick-action `Reise` path that timed out in the FR2D
   draft;
3. it requires a rendered, non-error Travel console with a deliberately
   disabled empty map selector in less than the existing ten-second timeout;
4. it switches back to the mapped `Reise-Abnahme` Campaign through the UI;
5. it opens `Reise`, requires the enabled `Reiseküste` map, and opens the Pixi
   map surface;
6. it reads `VERSION` and `UNMASKED_RENDERER_WEBGL` from the canvas's existing
   WebGL 2 context;
7. it requires the actual renderer to contain `SwiftShader`; and
8. it enters route-planning mode, moves the keyboard selection to q=1/r=0,
   confirms it in a later browser turn, and requires the resulting four-hour
   Travel evaluation.

The local evidence was:

- empty Travel readiness: `1516.624 ms`, below the `10000 ms` timeout;
- WebGL version: `WebGL 2.0 (OpenGL ES 3.0 Chromium)`;
- renderer:
  `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`;
- test time: 1 minute 22.5 seconds;
- isolated total including Electron startup/teardown: 1 minute 50 seconds;
- result: 1/1 passed.

This disposes the old ambiguity: an empty Travel surface is valid and bounded
under SwiftShader, and the same runtime can instantiate and interact with the
real Pixi map. The original timeout is not evidence of a Travel or Pixi product
defect.

## Negative audit and harness findings

1. An initial draft awaited `runtime.gpuObservation()` in a synchronous
   Webdriver execution before any Travel action. That diagnostic exceeded the
   renderer channel's ten-second wait. It therefore cannot classify the old
   Travel timeout. The final proof observes the renderer on the actual Pixi
   context instead. The runtime handler currently requests complete GPU info
   before its helper requests complete GPU info again; whether that is an
   intentional warm-up or redundant diagnostic work remains a separate render-
   qualification question for `FR7B`.
2. A draft combined a CSS ancestor and Webdriver text selector into one invalid
   selector. The final journey resolves the action container first and then its
   text button. The rejected selector never reached product code.
3. A draft dispatched `ArrowRight` and `Enter` in one browser turn, before
   React could publish the new selection. Its failed assertion triggered the
   known slow Pixi failure-screenshot path. The final journey waits for the
   selected Hex before confirming it, matching the established Travel suite.
4. `wdio.conf.ts` still forces `--use-angle=swiftshader` and
   `--enable-unsafe-swiftshader`; the WebGL renderer readback proves those flags
   affected the actual Pixi context rather than serving as configuration-only
   evidence.
5. This is a bounded disposition, not production hardware evidence. It adds no
   5+100 population, p95, calibrated host, native-GPU, cross-OS, memory/CPU,
   context-loss, or exact `QS-05` claim.
6. The complete Travel command/lifecycle and idle-render journey remains the
   existing `session-travel` suite. F3B adds only the missing empty-route and
   actual-SwiftShader identity/next-interaction oracle.

## Proof packet and delivery class

- focused ESLint for the suite and typed registry: passed;
- E2E registry and CI matrix: 2/2 files, 8/8 tests passed;
- `pnpm test:e2e:built --suite travelSwiftshaderIsolation`: 1/1 passed;
- `pnpm check:frontend-robustness`: 31/31 files and 203/203 tests passed;
- the complete local `pnpm check` passed formatting, every lint partition, and
  typecheck. Its architecture population reached 90/91: the unchanged renderer
  import/call ownership gate exceeded its 30-second test timeout at
  `31.370 s`. An immediate one-worker run of the complete renderer architecture
  file passed 19/19; the same gate completed in `22.227 s`. The portable Unit
  phase was not reached in that invocation. No architecture timeout or source
  threshold was changed; clean-host Candidate CI remains the broad delivery
  gate.

The packet changes a qualification registry, one E2E test, and this audit only.
It changes no `src/`, resource, dependency, Electron/build, or packaging input;
the app-build fingerprint is unchanged and no AppImage handoff is required.
