# Frontend robustness FR2E qualification-gate audit

- Date: 2026-08-25
- Delivery baseline: `origin/main@0d578cfc8f37b75d8fcb4673c8f2f5a91de5782e`
- Sprint: `FR2E` from the
  [frontend robustness roadmap](../architecture/frontend-robustness-roadmap.md)
- Change class: documentation-only architecture correction
- Gate verdict: **FR2 remains open / no-go for FR3**

## Sources reviewed before implementation

- the complete frontend robustness roadmap, acceptance matrix, and FR2D audit;
- the original Electron greenfield roadmap, especially the deliberately narrow
  name-only Campaign `M1` gate and the later `M2` Campaign-knowledge scope;
- `program-technical-needs.md`, including the population rule, `RP-H`, `RP-R`,
  `RP-L`, `TN-16`, and `QS-05`;
- the Electron target architecture, Campaign Management requirements, Live
  Session requirements, and Live Session persistence contract;
- the current Campaign schema/bootstrap, Scene, Party, Hex/Travel, catalog,
  loot, planning, and import stores plus the E2E fixture materializer and suite
  registry;
- live `origin/main`, the clean worktree, and current open pull requests.

## Root finding

The roadmap incorrectly made completed `QS-05` evidence an FR2 prerequisite for
FR3. `QS-05` requires exact `RP-R` and `RP-L` Campaigns with every declared
Campaign object, record, reusable-definition, media, Running Scene, mask,
travel, override, and reconciliation class. The current product format does not
yet represent that complete set. In particular, there is no Campaign-owned
local-media persistence owner and no complete generic object/record model for
the normative profile. Those capabilities belong to later product milestones.

The resulting dependency was circular:

| Gate dependency | Why it cannot close before FR3 |
| --- | --- |
| exact complete `RP-R`/`RP-L` fixture | the current format cannot encode all normative profile classes |
| final Running Play useful-state oracle | FR3 owns the Running Play projection and Scene/Party command boundary being qualified |
| final Travel/spatial ownership | FR6 owns joint Travel/Session publication and rendering-leaf isolation |
| all-OS final qualification | FR7B owns the complete functional, scale, resource, and cross-OS matrix |

This is a roadmap defect, not permission to weaken `QS-05`. A scaled-down or
current-format fixture still cannot be called `RP-R` or `RP-L`.

## Decision and implementation packet

The roadmap now distinguishes two evidence maturities:

1. FR2 must prove the replacement Campaign Workspace ownership model against a
   reproducible, complete **current-format** fixture. The production journey
   must retain all representable useful state, execute and persist a focused-
   Scene next mutation, restart cleanly, meet the one-second p95 target, and
   receive explicit owner architecture acceptance.
2. FR7B must run exact `RP-R` and `RP-L` `QS-05` populations separately on every
   supported calibrated operating system after all required data owners exist.

The acceptance matrix records both proof stages on `FR-A07`. No process,
renderer, IPC, persistence, or product behavior changes in this slice.

## Negative findings and shortcuts

1. FR2D's empty-installation run remains useful only as a mechanics baseline.
   It is not the complete current-format reference fixture and cannot close the
   revised FR2 gate.
2. The focused-Scene next-action/restart oracle and isolated disposition for
   the Travel/SwiftShader timeout are still absent.
3. The current format has no single declared applicability manifest listing
   every represented and absent `RP-R`/`RP-L` class. FR2F must create that
   record before constructing its fixture so omissions remain visible.
4. `program-technical-needs.md` declares exact totals but its `RP-L` prose does
   not fully spell out construction for non-integral runtime/definition cohort
   multiples. An executable final profile manifest must resolve that ambiguity
   without changing the normative totals before FR7B timing can be valid.
5. This documentation-only correction introduces no executable proof. Its gate
   is repository consistency and the complete documentation/test gate.
6. Owner architecture acceptance is still absent. FR3 is therefore not
   authorized by this correction alone.

## Verification

- `git diff --check`: passed;
- `pnpm check:frontend-robustness`: 23 files and 159 tests passed;
- the complete local `pnpm check` passed formatting, every lint partition, both
  TypeScript projects, and 91/91 architecture tests, then reproduced the same
  four unrelated host-sensitive failures recorded by FR2D: three Encounter
  Generator settings cases exceeded their 30-second test timeout and the
  16-ms Reference Matcher gate measured 32.375 ms. The portable unit result was
  194/196 files and 801/805 tests passed;
- none of the failed tests imports or evaluates a changed documentation path;
  thresholds were not weakened. Clean-host remote `Check` remains the broad
  repository gate;
- the slice changes only Markdown. It does not change application inputs and
  therefore requires no AppImage handoff.

## Follow-up phases

- `FR2F`: inventory every current-format profile class, construct the complete
  reproducible fixture through owning persistence boundaries, add the focused-
  Scene mutation/restart oracle, and isolate the Travel/SwiftShader behavior;
- `FR2G`: run the separate current-format production population, attach the
  semantic oracle, and obtain owner architecture go/no-go;
- `FR7B`: after later owners exist, generate independently validated exact
  `RP-R`/`RP-L` fixtures and run the full calibrated cross-OS `QS-05` matrix.

FR3 remains no-go until `FR2F`, `FR2G`, and explicit owner architecture
acceptance close. Exact `QS-05` remains open until `FR7B` and must remain
reported as such throughout the intervening migrations.
