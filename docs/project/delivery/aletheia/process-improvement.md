Status: Active
Owner: Aletheia B
Last Reviewed: 2026-07-24
Charter Version: C-0.2.0
Process Version: B-0.3.1
Observes Product Process: A-0.3.2
Evaluation Version: E-0.3.1
Source of Truth: Current temporary proposal protocol for GM-Core process improvement.

# GM-Core Process Improvement

B's authority comes only from the [Program Charter](program-charter.md). B may
observe and propose a process delta. B cannot evaluate or approve its own
delta.

## Observe And Propose

Observe A's actual slice work, independent replay, repair attempts, escapes,
and uncertainty. Keep product truth, process evidence, and process hypotheses
separate. A read-only finding is a hypothesis until a practical reproduction or
binding owner source establishes it. Treat unrelated workspace interference as
separate proof attribution; do not change it or count it as a candidate failure.

Propose a change only after one process failure has been demonstrated on a
frozen historical or current slice. Change one process variable. Freeze the
baseline and candidate revisions, the workload, evidence route, and resource
limit where those affect the comparison. State the prediction, success and
guard conditions, uncertainty, reversible canary, and rollback trigger in the
slice's existing short delivery owner or process-change PR. Do not create a
generic experiment ledger, role report, or JSON contract.

Have an independent agent or human replay the same command, probe, or
counterexample on baseline and candidate and inspect the literal results and
Git/CI state under [Process Evaluation](process-evaluation.md). If comparable
conditions or evidence meaning cannot be established, the trial is
inconclusive. No demonstrated failure requires no process change.

## Independent Verdicts

Both async-boundary proposals are `INCONCLUSIVE` and not adopted.

- **v1:** `/tmp/aletheia-boundary-probe/BoundaryMatrixProbe.java`, SHA-256
  `1361a913b0034cbaa6507ec3327cfdd6527ed8e383c966eb6764165980306816`.
  It combined fixed parameter cases rather than event schedules, omitted
  material retry, cancellation, and counted-settlement behavior, coupled seeds
  with repair and oracle, and reproduced no frozen product failure.
- **v2:** `.aletheia-probe-v2/`; run `python3 -B run_probe.py` there. Bundle
  SHA-256
  `e599993fb31453d9a4116eb4b6ecbd63eab0c844cf072f6910b7c0d9475ae115`;
  fixture SHA-256
  `e38eabcff456f5af2d9c4ecf1f639802517a3717e541ad9fe4c811d0891367a5`;
  V10 trace SHA-256
  `cbd27206573b9e573e6b8b835beda56a48cb6016538a752541be584fb318d750`.
  It enumerated event schedules, but its failing XML was overwritten, no
  pre-repair source hash exists, one baseline order and the failing transition
  were reconstructed, and the mutation source was absent from the mirror
  index. The comparison therefore cannot be independently replayed.

Do not optimize or reinterpret either preflight. Supporting methods remain in
`references/agent-methods/microsoft-chess-systematic-testing.md`,
`references/agent-methods/microsoft-coyote-systematic-testing.md`,
`references/agent-methods/microsoft-p-safe-asynchronous-event-driven-programming.md`,
and `references/agent-methods/foundationdb-simulation-and-testing.md` under the
global mirror governed by [Source References](../../verification/source-references.md).

No Product Process version, running slice pin, product acceptance rule, or
product behavior changes through these proposals.

## Prospective Next-Slice Canary

Wait for a later A slice that changes an asynchronous boundary with at least
two independently advancing events and exposes a reproducible production-route
failure or severe escape before repair. Do not delay A to manufacture this
condition. If the pre-repair candidate cannot be frozen, record no experiment
and wait for another slice.

### Scheduler Selection Hypothesis

Research verdict: `RESEARCH_SUPPORTED; Proposed only, not adopted`.

Test a thin production-route adapter plus Lincheck 3.6 model checking as the
first scheduler candidate. The adapter names semantic events and exposes their
release gates; the independent oracle owns terminal, resource-release, and
cleanup invariants. Lincheck may choose JVM-thread interleavings and emit the
replay trace, but may not replace either adapter or oracle. A custom causal-DAG
enumerator using the unchanged adapter and oracle is only a fallback candidate;
it is not qualified by this research and must pass the same frozen evaluation.

This is a falsifiable hypothesis, not an adopted tool choice. A disposable Java
probe at `.aletheia-tool-probe/` used `Lincheck.runConcurrentTest(...)` to
interleave `CompletableFuture` completion and `ConcurrentLinkedQueue` drain in
Lincheck-managed Java threads. Its suppressed-drain negative control failed
with an interleaving trace and the causally gated control passed. This proves
only those synthetic CF-plus-CLQ interleavings. It does not prove JavaFX, an
external executor, a production route, or a product failure.

The canonical trace digest is computed by parsing
`TEST-probe.AsyncBoundaryProbeTest.xml` as XML, selecting the sole
`/testsuite/system-out` element, taking its decoded character content exactly,
encoding it as UTF-8 without trimming or newline or Unicode normalization, and
then applying SHA-256. The independent evaluator reproduced
`fc4bc5a2ad30c7e6f19bf43f4fbc06d7e84d889109e2495aae1ca4be50288cfa`.
The earlier
`bdddc77da5ce5a120f89ea4e8aa01de6d988de70bbbb31b98d5325f0a10e0c78`
digest did not follow this rule and is invalid.
The full probe was green in 34 seconds; its isolated runtime was 27 jars and 16
MiB. Test-source SHA-256 is
`f3afc4013746b7d0d5c552fac846bbd812834d1213cc9f6fa96871a7933f77c0`.

On the next qualifying frozen slice, keep Lincheck only if the same disposable
adapter can drive the actual `CompletionStage` and JavaFX boundary, reproduce
the already observed failure, detect every applicable negative control, replay
the same failing trace, pass the gated control, and stay within this section's
300-schedule and 45-minute bounds without changing product dependencies or
build files. Any uncontrolled JavaFX/executor callback, non-reproducible trace,
missed control, or rollback residue falsifies the Lincheck choice and triggers
evaluation of the custom DAG fallback under the same freeze. Failure of either
candidate to qualify is not evidence for the other; failure of both is
`INCONCLUSIVE`, not evidence for changing A.

JCStress is not a canary scheduler: its official guidance says most tests are
probabilistic and time-bound. It remains eligible only as supplementary weak
memory stress. Java Pathfinder is not a canary candidate because its separate
Java-bytecode model-checking VM implies integration and rollback cost without
evidence for this production route. That cost judgment is an inference from its
documented installation model, not a SaltMarcher measurement. Lincheck model
checking is deterministic and trace-producing, but assumes sequential
consistency; its stress mode is not reproducible. These limits are preserved in
the global mirror at
`references/agent-methods/openjdk-jcstress.md`,
`references/agent-methods/jetbrains-lincheck.md`,
`references/agent-methods/jetbrains-lincheck-testing-strategies.md`,
`references/agent-methods/jetbrains-lincheck-strategy-options.md`,
`references/agent-methods/lincheck-cav-2023-paper.md`, and
`references/agent-methods/java-pathfinder.md`.

For one qualifying slice:

1. Freeze the pre-repair commit; hashes of all affected source, test, fixture,
   adapter, settings, build, Gradle-wrapper, and resolved dependency files;
   a hash of the selected JDK runtime image; literal JDK and Gradle versions;
   relevant OS, architecture, locale, timezone, JavaFX/headless/display,
   scheduler, and executor settings; exact focused and broad commands; and
   copies plus hashes of their literal console and XML output. A dirty tree,
   overwritten report, or reconstructed transition is not a baseline.
2. Use one disposable adapter that drives the named production route and only
   controls release order for already-admitted events. Baseline and candidate
   use the same pre-repair commit, adapter, fixture, environment, and invariant
   oracle. Baseline replays the fixed route; candidate changes schedule
   selection only. A shadow model is not product evidence.
3. Keep the oracle independent from adapter and scheduler. Count terminal
   observations, retain ownership until resource release succeeds, and retain
   cleanup obligations until cleanup succeeds. Use separate negative controls
   that duplicate or suppress terminal observation, fail or withhold resource
   release, and fail or suppress cleanup completion. Each applicable control
   must make its frozen invariant fail.
4. Before repair, require a concrete candidate trace to reproduce the already
   observed literal failure or invariant breach that baseline misses. After
   repair, rerun the unchanged candidate and controls on the frozen repaired
   commit: the real failure must disappear, controls must remain detectable,
   and focused plus broad proof must remain green.

Stop as `INCONCLUSIVE` or `REJECTED` on a hash or workload mismatch, changed
fixture or oracle, fixed-control finding, missed negative control, proof
regression, more than 300 representative terminal schedules, or more than 45
minutes including evaluator replay. Do not use real user data, external
transmission, or paid services.

Run only in an isolated worktree. A fresh evaluator who authored neither the
adapter nor the repair verifies hashes, reruns baseline, candidate, controls,
and rollback, and alone records the verdict under [Process
Evaluation](process-evaluation.md). Rollback removes the disposable adapter,
instrumentation, generated schedules, and worktree, then confirms the frozen A
commit and main worktree were unchanged. Until an `ADOPTED` verdict, Product
This scheduler proposal does not alter Product Process `A-0.3.2`, any running
slice pin, or A behavior. B stops
this research until a qualifying slice supplies the complete packet.

## Prospective Visible-UI Qualification Hypothesis

Research verdict: `RESEARCH_SUPPORTED; Proposed only, not adopted`.

For a later A slice with visible JavaFX acceptance, test one reversible
three-lane canary on the frozen production route:

1. Drive a shown `Stage` through a Glass robot and assert `Scene` event routing,
   focus owner and traversal, keyboard activation, scroll position, and the
   resulting product state. Direct handler calls and controller invocation are
   not interaction proof.
2. At each required minimum window and text scale, freeze JDK, JavaFX, TestFX,
   Monocle, OS, font set, renderer, output scale, locale, stylesheet, and window
   dimensions. After CSS and layout, assert semantic bounds, overlap, clipping,
   focus visibility, and keyboard reachability; retain a `Scene.snapshot` as a
   review artifact. Pixel comparison is an oracle only under that identical
   rendering freeze and a declared tolerance. Freeze or disable animations,
   caret blink and transitions, then establish an explicit pulse and UI-idle
   condition before every future pixel assertion.
3. Query accessible role, text, help, value, state, and focus attributes where
   applicable. Separately run the packaged application with an exact OS version,
   JavaFX build, screen-reader product and version, and AT configuration, and
   require `Platform.isAccessibilityActive()` to be true.
   A human with assistive technology verifies spoken name, role, state and
   changes, reading and focus order, keyboard-only completion, and recovery.
   Owner visual acceptance at the real minimum window and scale remains
   required. Scene-graph metadata, notification calls, headless snapshots, and
   robot success do not certify screen-reader speech or visual usability. The
   cited Oracle ACR covers Windows and macOS and explicitly excludes UNIX and
   Linux; a Linux target therefore requires its own complete AT evidence and
   cannot inherit that conformance claim.

A disposable probe at `.aletheia-ui-probe/` supports only the automation part.
`./gradlew -p .aletheia-ui-probe test --console=plain --rerun-tasks --no-daemon`
was green in a 31-second warm-cache build with three tests, zero failures or
errors, and 5.664 seconds of test time. It proved real `Scene` key routing,
focus traversal and focused `ScrollPane` paging; a direct handler-call
counterexample; inherited font scaling with computed values `12.000` and
`24.000` pixels at a `0.01` tolerance; bounded layout and snapshot checks; and
accessible text queries. The accessibility-active query ran on the JavaFX
Application Thread. Test-source SHA-256 is
`e3b1858e855a0c8a093c34910adde30b3684034c2655a3f298c757e971adc708`.
The classpath probe emitted JavaFX's unnamed-module warning and ran no packaged
product or assistive technology, so packaging, platform rendering, notification
delivery, and spoken output remain unproved.

The canary must include negative controls for a direct handler call, a skipped
or non-focusable target, an unfocused scroll container, missing accessible
metadata, and text overflow at the minimum viewport. Each corresponding oracle
must fail. A robot route that misses the production action, a control that
passes, an inactive accessibility property during the screen-reader lane,
unstable snapshots outside the freeze, missing owner acceptance, or any product
dependency/build mutation makes the trial `INCONCLUSIVE`. Rollback removes the
disposable test project, screenshots, caches local to it, and AT configuration,
then verifies the frozen product tree is unchanged. An independent evaluator
alone may adopt the delta.

Method evidence is preserved in the global mirror at
`references/quality-platforms/openjfx-platform-accessibility.md`,
`references/quality-platforms/openjfx-node-focus-accessibility.md`,
`references/quality-platforms/openjfx-accessible-attribute.md`,
`references/quality-platforms/openjfx-scene-snapshot.md`,
`references/quality-platforms/openjfx-scrollpane-keyboard.md`,
`references/quality-platforms/oracle-javafx-css-reference.md`,
`references/quality-platforms/oracle-javafx-25-accessibility-conformance.md`,
and `references/quality-platforms/testfx-readme.md`.

## Adopted Compatibility-Baseline Trigger

Independent verdict: `ADOPTED` under Evaluation `E-0.3.1` for Product Process
`A-0.3.2` and later slice starts. It does not repin any running slice; the
Campaign Runtime slice retains its recorded `A-0.3.0` pin.

The binding owner premise for this proposal is that no user-created or other
non-disposable data exists before complete GM-Core feature completion and that
there are no users before then. An internal schema, commit, test fixture, or
development install therefore does not by itself create a legacy-compatibility
obligation. Before the trigger below, A may replace persisted representations
and recreate only data positively identified as disposable development or test
state. This does not relax current product proof, import behavior, or the ban on
modifying unknown or real data.

Add one monotonic compatibility-covenant trigger. It fires only when all of the
following are recorded together:

1. The Charter's complete GM-Core boundary and required owner acceptance have
   passed for the exact candidate.
2. The owner authorizes that candidate for first non-disposable user use or
   distribution, and release evidence identifies the exact commit and artifact.
3. A baseline inventories the candidate's externally durable data surfaces and
   identifies their frozen version or equivalent reader/writer expectation,
   without prescribing their implementation.
4. A production-route fresh-install probe creates representative durable state,
   closes, reopens, and reads it with the released artifact; the literal result
   is retained with the baseline.

Once fired, the trigger cannot be undone by renaming a release or reverting the
process document. Every later change that may encounter data written by a
supported released artifact must either prove the old data remains readable and
preserved or supply and practically replay an explicit upgrade path from the
oldest supported baseline. Destructive recreation then requires the same owner
authority as real-data modification. The rule chooses no storage technology,
schema, retention duration, or version-number syntax.

The independent evaluator qualified the rule with a disposable synthetic
release in an isolated worktree: freeze one candidate artifact and baseline,
create data only through its production route, exercise one compatible and one
deliberately incompatible successor, replay preservation and rollback, and
delete the synthetic data. The evaluator must detect the incompatible successor
and must
also confirm that an earlier internal schema with no non-disposable consumer
does not activate the covenant. Literal replay evidence and the adoption verdict
are owned by [Process Evaluation](process-evaluation.md).

Reopen or roll back the change if non-disposable data or a user already exists
before the declared trigger, any trigger condition can be asserted without its
literal evidence, the synthetic incompatible successor passes, or the canary
cannot restore the frozen artifact and remove only its disposable data. On the
first such finding, stop destructive work, preserve the bytes, and return the
premise to the owner. Before a real trigger, rollback removes the canary and
proposal. After first non-disposable use, rollback may restore software but may
not declare released data disposable; the compatibility obligation is
monotonic.

This trigger is an inference from two independent primary sources. Semantic
Versioning requires an explicit public contract, treats initial development as
unstable, and makes a published version immutable. Android Room's official
migration guidance ties preservation to existing on-device user data, retains
exported schema history, and tests upgrades from older versions. The sources do
not define SaltMarcher's release boundary or persistence design. They are
preserved at
`references/release-engineering/semantic-versioning-2.0.0.md` and
`references/android-platform/android-room-migrating-db-versions.md`.

## Boundary

B supplies the proposal, frozen comparison, and reversible canary. The
[independent process evaluator](process-evaluation.md) performs the replay and
alone records adoption, rejection, or uncertainty. B may not act as evaluator,
approve its own proposal, or reinterpret an inconclusive trial as improvement.
An adopted change increments the affected process version and remains
recoverable through Git. Running slices retain their pinned process unless the
approved canary explicitly includes them.

B may report delayed reopening, unsupported evidence, or bridge construction.
It cannot select a product decision, change product acceptance, grant itself
authority, or certify product or process success.

## References

- [Product Process](product-process.md)
- [Process Evaluation](process-evaluation.md)
- [Agent Instructions](../../architecture/agent-instructions.md)
- [Documentation](../../documentation.md)
- [Quality Platforms](../../verification/quality-platforms.md)
- [Source References](../../verification/source-references.md)
