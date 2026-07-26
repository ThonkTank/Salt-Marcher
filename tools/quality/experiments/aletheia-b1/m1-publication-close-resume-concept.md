Status: Frozen concept
Owner: Aletheia B1
Last Reviewed: 2026-07-27
Source of Truth: One temporary B1 question and its frozen test boundary; not product, architecture, or maturity truth.

# M1 Publication, Close, And Resume Behavior Concept

## Decision

The highest unresolved B1 question on the exact stable product baseline remains:

> After a committed Campaign activation times out at visible publication and recovery is shown, can a late terminal publication callback settle, the application close normally, and a fresh production start resume the durable Beta Campaign as a safely rendered focused Scene which visibly acknowledges and durably preserves the next mutation?

This is falsifiable and remains higher B1 risk than another nominal switch sample. Existing production journeys separately prove publication timeout/recovery, ordinary close cleanup, restart, safe rendering, and a next mutation, but no journey composes that adversarial boundary. A failure can expose stale mutation authority after recovery, abandon terminal ownership during close, or resume truth that is durable but not safely usable. The canonical roadmap separately reopens M1 for a B3 memory-retirement finding; that structural work neither answers nor supersedes this B1 behavior question.

## Frozen Authority And Baseline

- Product commit: `3eb1e0746d60e3e36fe25bd0b791e0f1bb0e9b71` (`origin/main`).
- Owner IDs: `AC-F01`, `AC-F02`, `AC-L01`, `AC-D01`; chiefly `TN-01`, `TN-02`, `TN-07`, `TN-15`, `TN-16`, `TN-21`.
- Binding interview meaning: immediate switch needs no warning or prior closure; complete Running Scene/Encounter/travel state resumes; the primary Scene never ends and remains mutable; restart restores as much useful state as possible; acknowledged work is automatically durable.
- Process authority commits/blobs at the product baseline:
  - `AGENTS.md`: commit `95fcdb199f70a42be2ee0358b119d8915912267a`, blob `80569edc6949f99a0c9b5457e213b26fbeeb0c31`.
  - Charter C-0.9.0: commit `18a813318193440e5535a51575b590846c0d3af7`, blob `29972e2b6d5699ec6a168e09d024288b8b1fed90`.
  - B1-1.1.0: commit `bbd5988b4d804cba86a51ced0c7a19c564d5c166`, blob `38f7df43743634b66be92f331d973484c3064d8b`.
  - Evaluation E-0.7.0: commit `bbd5988b4d804cba86a51ced0c7a19c564d5c166`, blob `50e128b7f16d4069f9ec9c730aa161f8391a3d60`.
  - Product Process A-0.8.0: commit `bbd5988b4d804cba86a51ced0c7a19c564d5c166`, blob `30c2c0e6667e9752ffe82eff0485a66c71f2104e`.
  - Process Optimization C-2.2.0: commit `18a813318193440e5535a51575b590846c0d3af7`, blob `825525d137aea3ffc4e0df40b98c88a31d0913f2`.
- Product-owner blobs: capabilities `6c3318f84154f15abc4991ef41d24d31e79c2446`; technical needs `089e10de4ab2342d70708da0c62340b9162b490b`; foundation interview `d598a77e31a6f328f1e42fe2648618e724ec6ff0`; Scene interview `1c9a1553eac3aae4f55af1b9e8a2faa45ebe2056`; lifecycle interview `18103d28a1140f960e3702c740858f8dcc015027`.
- Delivery context only: canonical checkout commit `2160ffeaf53edec7d92905af8daec4a2a1d38183`, roadmap blob `15e57d84fd44aa5bbb1c4974e82618e460f6a634`. It is not product evidence.

The change from historical concept base `0b5cb6952135c957f846b95d344cc032bbf8958f` to this baseline changes no `app/**`, `shell/**`, `platform/**`, `features/**`, `test/**`, requirement, technical-need, or interview blob. It adopts C5 host admission, changes Charter/process authority, and removes the historical concept. Therefore it changes test admission only, not the premise, workload, production route, or oracle. Earlier candidates are not authority and were not reused.

## Interpretation And Production Journey

The narrowest interpretation is insufficient: a durable pointer alone does not prove useful resume. The strongest wording is also not invented: transient pixels need not survive process death. The coherent interpretation across adjacent needs is 100% durable observable-state equivalence at readiness, recovery remaining authoritative after timeout, no late mutation authority, a safely rendered focused Scene, and a visible next mutation that is acknowledged only after durability.

One JUnit UI journey shall use the production composition already owned by `AppBootstrap.openCampaignActivationAsync`, `CampaignDeskHost`, a shown JavaFX `Stage`, real `CampaignRuntime`/SQLite stores, and the actual Scene UI:

1. Create Alpha and Beta through the production Campaign desk; make Beta durable, retain its runtime reference, seed a uniquely visible focused-Scene marker, then switch back to Alpha.
2. Switch from Alpha to the already durable Beta through the real host, hold the published-root readiness terminal, let the configured publication timeout show recovery after Beta's durable pointer commits, then release the terminal callback after revocation.
3. Prove recovery stays rendered and authoritative, the late candidate rejects mutation, and the exact publication/recovery terminal obligations settle.
4. Close the ordinary `AppBootstrap`; require bounded successful termination with no retained coordinator or installation runtime and no test-forced resource close.
5. Create a fresh `AppBootstrap` and production host on the same synthetic installation, call the normal startup resume route once, and require durable Beta, its exact focused Scene marker, positive rendered bounds after production readiness, and no Alpha/stale-root content.
6. Edit the focused Scene through the rendered production UI. Require visible acknowledgement, a successful production mutation result, then close and reopen once more to read back that exact edit.

## Metrics, Controls, And Oracle

Deciding metrics are all-or-nothing:

- recovery-root replacements after timeout: exactly `1`; normal Campaign activations from the revoked late callback: `0`; late-candidate accepted mutations: `0`;
- normal close result: success within `10 s`; retained coordinator/runtime after settlement: `0`;
- fresh startup resume attempts: `1`; resumed Campaign ID/path/generation and focused Scene marker: exact Beta truth;
- safe render: current root is the resumed production `AppShell`, attached to the shown Stage, with positive layout and screen bounds after the real readiness gate;
- next mutation: UI-visible acknowledgement within the existing `TN-21` timeout, production result `SUCCESS`, and exact readback after the second fresh start;
- Alpha/stale marker exposure, cross-Campaign mutation, acknowledged-work loss, uncaught asynchronous failure, or leaked live test handle: `0`.

Positive control: the same production route without the held terminal must activate Beta, render it safely, accept the same Scene edit, close, and resume it exactly. Negative control: a pre-commit rejection must leave Alpha rendered, writable, and durable, proving the oracle does not reject an unrelated safe fallback.

Causal known-bad control: in a disposable evaluator-only checkout, alter only `PublicationAttempt.activateAndCommit` so a revoked late callback invokes `activateVisibleShell` instead of rejecting stale publication authority. The unchanged journey must fail specifically on late mutation authority and/or recovery authority while the positive and unrelated negative controls still pass. The mutation is never committed or handed off. Failure to discriminate restarts concept/oracle work.

## Tool, Risk, Boundary, And Budget

JUnit Jupiter `6.1.2`, JavaFX/Monocle `21.0.2`, SQLite JDBC `3.53.2.0`, existing deterministic latches, production hosts, and semantic/UI readback are suitable and already repository-owned (`build.gradle.kts` blob `4d38ee90920f4b2b8cc3f995650ad406f97aba9f`). No external tool better controls this Java lifecycle interleaving, so no online research or external acquisition is justified; local canonical evidence defines both question and oracle.

The test phase may commit only one test change under `test/app/CampaignRuntimeProductionJourneyTest.java` plus test-harness code in that same file. It may not change shipped source, resources, dependencies, build wiring, product contracts, or durable owner documents. Existing package-private test seams may be called; no new production seam is authorized. A defect-demonstrating red test remains on its handoff branch.

New heavy execution must compile/use adopted `tools/quality/aletheia-c5/host-lease-native` as a finite non-A batch; exit `75` means retry within budget. Freeze: `15 min` wall, one admitted focused-test batch plus one causal-control batch, at most `0.25 CPU-hour`, `100 MiB` retained output, `$0`, synthetic temporary data only, zero network/egress. No rerun or threshold change after a literal product result; infrastructure-only non-admission does not consume the test batch.

Rollback deletes only the temporary synthetic installation and disposable known-bad checkout after proving no live Stage, JavaFX timer, worker, coordinator, runtime, SQLite handle, or host lease remains; it restores the unmodified product commit and retains only literal test evidence. Restart concept if any authority/product blob changes, the production route cannot create the interleaving without a new shipped seam, the known-bad does not discriminate, safe rendering or visible durability cannot be observed, another B1 risk becomes demonstrably higher, or the budget expires. Missing runtime detail is `inconclusive`, never success.
