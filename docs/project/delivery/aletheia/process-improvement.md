Status: Active
Owner: Aletheia B
Last Reviewed: 2026-07-26
Charter Version: C-0.3.0
Process Version: B-0.3.4
Observes Product Process: A-0.4.0
Evaluation Version: E-0.3.1
Source of Truth: Current temporary proposal protocol for GM-Core process improvement.

# GM-Core Process Improvement

B's authority comes only from the [Program Charter](program-charter.md). B may
observe and propose a process delta. B cannot evaluate or approve its own
delta.

## Binding Owner Maturity Rule

This rule is owner input, not a B hypothesis or an adopted B process delta.
Every implementation claim is classified as `Rejected`, `Proof of Concept`,
`Preliminary`, or `Final`. `Rejected` work is not a planning dependency;
`Proof of Concept` demonstrates only its bounded experiment; `Preliminary` is
an integrated but still revisable candidate; and `Final` is the rare highest
implementation-quality seal, never product truth. It requires the best
attainable form for current requirements, practical adaptability to plausible
future changes, exhaustion of credible superior alternatives, and an exhausted
dependency horizon. Tests, CI, installation, code presence, or prior investment
do not promote a claim by themselves. A wave may
rely provisionally on non-final work only while naming the practical condition
that reopens it. Practical counterevidence may reopen even `Final`; the label is
never authority to build a bridge around a falsified premise.

## Maturity-Rule Observation

Research verdict: `NO DELTA; owner rule already active in A-0.4.0`.

The maturity classification, reopen boundary, and prohibition on bridges around
non-final work entered A directly through binding owner instruction. Repeating
those same checks as a B candidate would create no distinct process variable
and no comparable baseline/candidate trial. B therefore proposes no maturity-
classification delta now.

B observes future waves for a demonstrated misclassification, delayed reopen,
or premature `Final` decision. In particular, it records evidence when a green
or installed Proof of Concept is promoted without implementation-quality proof,
a Preliminary boundary is preserved through a bridge after its reopen condition
is met, or Final is assigned without exhausting credible superior forms,
plausible future-change scenarios, and the remaining dependency horizon. It
also records false reopening of a fully audited Final boundary when no material
alternative or counterevidence exists.

Only a frozen occurrence of one of those failures can justify research into a
single additional decision aid. A later B proposal must add something not
already required by A-0.4.0, state measurable false-promotion and false-reopen
controls, and undergo independent baseline/candidate evaluation. Until then B
researches classification outcomes without changing A, repinning a slice, or
creating a second maturity gate.

## Observe And Propose

Observe A's actual slice work, independent replay, repair attempts, escapes,
and uncertainty. Keep product truth, process evidence, and process hypotheses
separate. A read-only finding is a hypothesis until a practical reproduction or
binding owner source establishes it. Treat unrelated workspace interference as
separate proof attribution; do not change it or count it as a candidate failure.
When suspected pre-completion legacy work appears, the
[legacy-work search heuristic](#pre-completion-legacy-work-search-heuristic)
helps B gather evidence for the already authorized bridge-construction report.

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

## CI Async-Oracle Incident And Candidate Deltas

Research verdict: `DEMONSTRATED PROCESS FAILURE; two isolated proposals, not
adopted; Product Process A-0.4.0 unchanged`.

Required CI run `30198497562` failed candidate commit `8c3e87369` after the
same commit had passed both the implementing agent's local proof and an
independent frozen replay. The subsequent test-only repair identified two
invalid proof assumptions exposed by a different event schedule:

- `PartyDropdownTest` sent a key through a JavaFX `Robot`, then treated two
  empty JavaFX-queue submissions as proof that native key delivery, editor
  transition, rerender, and focus restoration had all settled. The native
  event queue had no causal completion relationship with that fixed queue
  drain. Commit `a695027af` instead waits for the exact visible terminal state:
  the editor name field owns focus while the roster is inert, or the editor is
  closed and the exact create/edit invoker owns focus.
- `SessionPreparationProductionRouteTest` already proved stale-target rejection
  through unchanged publication revision, unchanged selected Session, and zero
  generation rows. It additionally required a fixture-wide diagnostics list to
  be empty without binding each entry or its settlement window to the stale
  intent. That absence was neither a causal result of the tested operation nor
  necessary for its acceptance claim. Commit `a695027af` removed only that
  non-causal assertion.

Required CI run `30199633707` then failed the test-only repair commit
`a695027af` at `CampaignRuntimeProductionJourneyTest` line 968. That route
asserted a retained cleanup obligation immediately after bounded `close()`
failure, while an automatic daemon cleanup was legitimately free to complete
and clear the retained state before the assertion. The next test-only repair
gates the fifth real late-cleanup attempt with latches, proves retained
ownership while that attempt is causally blocked, releases it in a `finally`
block, and then proves eventual cleanup and the unchanged bounded caller
result. It changes neither product code nor the tested lifecycle behavior.

The two repairs change tests and no product source. This is practical failure
and repair evidence across two independent CI schedules, not a read-only
prediction. The second incident materially strengthens the first: even after
fixed queue draining and a non-causal global absence assertion were removed, a
third test still sampled a legitimate transient state without holding its
cause. The sequence demonstrates that A-0.4.0's general demand for a concrete
oracle and causal negative control does not by itself prevent an asynchronous
test from substituting queue draining, fixture-wide absence, or an ungated
transient sample for operation completion.

The failed workflow retained the run, head SHA, failed test names, and source
locations, but its only proof step is the Gradle command; it has no failure-only
JUnit-result upload. The literal assertion details were therefore unavailable
after the runner ended. That absence must remain recorded as missing evidence;
source inspection may explain the implicated assertion but cannot reconstruct
the lost runtime value.

### Candidate 1: Operation-Scoped Async Terminal Oracle

Research verdict: `PROPOSAL JUSTIFIED; independently evaluate before adoption`.

The one changed process variable is the checkpoint rule for an
acceptance-deciding route that crosses a native-event, UI, executor, callback,
or publication boundary. The candidate requires one operation-scoped terminal
predicate named before execution. The proof waits with an explicit deadline
until that predicate is observed through the production route. A fixed sleep,
fixed count of queue drains or pulses, future completion that does not own the
claimed transitive work, or absence from a fixture-wide diagnostics collector
cannot substitute for that predicate. A shared diagnostics collector is an
oracle only when every admitted producer is bounded to the tested operation
and the route proves that its observation window has settled; otherwise assert
the operation's specific externally visible state and treat unrelated
diagnostics separately.

Evaluate this variable on the frozen `8c3e87369` and `a695027af` routes without
changing product code, fixtures, actions, or acceptance outcomes. The baseline
retains each historical wait and oracle; the candidate changes only terminal-
oracle selection. Run both across the same local headless route and fresh CI
jobs. Applicable negative controls suppress exact focus restoration, restore
focus to the wrong invoker, allow stale-target publication, add an unrelated
fixture diagnostic, release late cleanup before retained ownership is sampled,
and keep that cleanup causally blocked until after the retained-state sample.
The focus and stale-publication controls must fail only their owning operation
oracle; the unrelated diagnostic must not falsify stale-target rejection. An
already released cleanup attempt must not prove retained ownership, while the
causally blocked real attempt must prove retention and must clean up after
release.
Candidate qualification requires the original valid routes to pass, every
applicable control to be discriminated, no product finding to be hidden, and
no unbounded wait. The baseline must also reproduce at least one historical
invalid verdict under the frozen schedule search; otherwise the comparison is
inconclusive rather than evidence for adoption. Different product commits,
missed controls, or changed actions likewise make the comparison inconclusive.
Rollback restores the historical test-only state. Only the independent
evaluator may adopt a later Product Process version.

### Candidate 2: Failure-Only CI Result Retention

Research verdict: `PROPOSAL JUSTIFIED; evaluate separately from Candidate 1`.

The one changed process variable is retention of the already-produced JUnit
XML and relevant test logs when required remote `check` fails. The candidate
does not add a test, reviewer, retry, proof lane, or new acceptance oracle. It
retains failure output with the exact head SHA, command, job environment, and
run identity long enough for independent diagnosis; successful runs need not
upload it. Missing runtime detail remains `unknown` rather than being inferred
from current source.

Compare baseline and candidate workflow runs on one frozen synthetic failing
assertion and one green control under the same commit and job configuration.
The candidate qualifies only if a fresh evaluator can retrieve the literal
failing suite, case, assertion output, and environment from the failed run,
the green verdict and required `check` semantics remain unchanged, retention
is bounded, and rollback removes only the retention step. A retry that replaces
the first failure, an artifact not tied to the exact head, exposure of secrets
or real user data, or any changed test verdict rejects the candidate. This
proposal must not be bundled with Candidate 1 in one evaluation because oracle
validity and diagnostic availability are independent variables.

Neither proposal changes product maturity. In particular, a green rerun or a
better retained report cannot promote `Proof of Concept` or `Preliminary` work
to `Final`; the Charter's best-form, future-change, superior-alternative, and
dependency-horizon conditions remain fully binding.

## Historical Async-Boundary Verdicts

Both earlier scheduler-preflight proposals are `INCONCLUSIVE` and not adopted.

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
commit and main worktree were unchanged. Until an `ADOPTED` verdict, this
scheduler proposal does not alter Product Process `A-0.3.2`, any running slice
pin, or A behavior. B stops this research until a qualifying slice supplies the
complete packet.

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
   applicable. For an intermediate slice, an independent agent separately runs
   the packaged application with an exact OS version, JavaFX build,
   screen-reader product and version, and AT configuration, requires
   `Platform.isAccessibilityActive()` to be true, and records the observable
   production-route result. Automation and this practical agent probe may
   qualify the intermediate slice, but scene-graph metadata, notification
   calls, headless snapshots, robot success, and an active accessibility flag
   do not certify screen-reader speech or visual usability. Accumulate those
   claims for Aaron's final integrated owner test under Product Process
   `A-0.3.3`, where he verifies spoken name, role, state and changes, reading
   and focus order, keyboard-only completion and recovery, plus visual usability
   at the real minimum window and scale. The cited Oracle ACR covers Windows
   and macOS and explicitly excludes UNIX and Linux; a Linux target therefore
   requires its own complete AT evidence and cannot inherit that conformance
   claim.

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
unstable snapshots outside the freeze, a missing required automation or agent
probe, or any product dependency/build mutation makes the trial `INCONCLUSIVE`.
Missing intermediate owner acceptance does not. A speech or visual deviation
in the final integrated owner test reopens every owning slice under Product
Process `A-0.3.3`; it is never overridden by this canary. Rollback removes the
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

## Prospective Proof-Lane Discrimination Canary

Research verdict: `FUTURE CANARY JUSTIFIED; proposed only, not adopted; no A change now`.

M1 exposed two proof-category errors: installed payload identity nearly became
evidence of installed interaction and usability, while personal acceptance
became an intermediate gate. The merged local evidence now states the narrower
truth. `CampaignRuntimeProductionJourneyTest` starts the production-composed
`SaltMarcherApp`, drives a shown JavaFX `Stage`, and observes visible product
state with disposable paths; it does not start the installed desktop launcher.
The packaging tasks build, copy, and register the app image; that establishes
installation and payload identity, not an interaction. Product Process
`A-0.3.3` separately defers personal judgment to the integrated GM-Core exit.

The new M2a slice names production-UI replay, installation proof, and deferred
final interaction acceptance, but it has only frozen its entry decision. It has
not yet produced one comparable packet containing all non-human proof classes.
Changing A again now would therefore optimize wording rather than demonstrate a
behavioral improvement. B waits until M2a retains literal evidence for the
first three lanes below, then runs this canary asynchronously without delaying
or changing A:

1. **Package identity:** the expected candidate payload is the payload copied
   into the declared install root; no launch or interaction claim follows.
2. **Production-composition UI automation:** the production composition is
   driven through a shown UI and its product state is observed; no installed
   launcher claim follows.
3. **Packaged-app agent probe:** an agent starts the installed launcher and
   performs the named interaction against disposable data; no human usability
   or spoken-output claim follows.
4. **Final human judgment:** Aaron judges the integrated installed program's
   usability and assistive-technology output; an agent result cannot satisfy
   this lane, and its deferral does not block an intermediate slice.

The one changed process variable is a four-lane claim classifier attached to
the existing compact slice/PR evidence, not a new ledger or product command.
Freeze the M2a product commit, artifact, exact commands, literal outputs,
environment, acceptance outcome, and required intermediate verdict. Give two
fresh evaluators the unmodified A-0.3.3 wording and two different fresh
evaluators the same packet plus the classifier; no evaluator sees another
verdict. Every evaluator reruns the available first-three-lane routes in the
same isolated candidate state and reports at most 250 words within 15 minutes.

Use four otherwise identical counterexample packets: mismatch only the installed
payload digest; replace only the shown production-composition route with a
direct handler call; replace only packaged-launcher interaction with executable
existence and matching hashes; and replace only Aaron's final observation with
an agent-authored usability claim. The expected failed or unproved lane is,
respectively, 1, 2, 3, and 4. The valid packet must leave lanes 1 through 3
proved, lane 4 deferred, and the technically qualified M2a slice able to
continue.

Measure cross-lane promotions, missed counterexamples, false intermediate
blocks caused by deferred lane 4, evaluator disagreement, elapsed time, and
response length. A candidate is eligible for independent evaluation only when
both candidate evaluators make zero cross-lane promotions, miss zero controls,
and preserve the correct intermediate verdict, while the baseline exhibits at
least one of the two demonstrated error classes and candidate median time adds
no more than three minutes. If both arms are already exact, record `NO DELTA`.

Reject the classifier if it promotes any hash, automation, or agent observation
beyond its lane, accepts synthetic human judgment, misses a counterexample,
reintroduces an intermediate personal gate, or exceeds the resource bound.
Different product commits, commands, outputs, environments, acceptance
outcomes, evaluator contamination, or within-arm disagreement make the trial
`INCONCLUSIVE`. Rollback deletes the disposable packets and classifier, then
confirms the M2a commit and working tree are unchanged. Only a later independent
verdict under Process Evaluation may create a higher Product Process version;
this research does not change A-0.3.3, M2a gates, or product acceptance.

## One-Question Architecture-Probe Research

Research verdict: `METHODS_SUPPORTED; no process delta or adoption candidate`.

Three mechanisms solve different parts of incremental architectural learning:

1. A prioritized quality scenario names the stimulus, response, architectural
   approach, sensitivity, and tradeoff to challenge. SEI's ATAM supports this
   risk selection, but its scenario analysis is not practical product proof.
2. One self-contained vertical change keeps the production route, its use, and
   related test together. Google's small-change guidance supports narrower
   review, lower rejected-work cost, vertical slicing, and simpler rollback;
   smallness alone neither identifies the important uncertainty nor supplies a
   valid oracle.
3. A frozen candidate-versus-control comparison with an explicit verdict and
   rollback isolates one changed variable. Google Cloud uses canary and control
   groups, progressive exposure, synthetic workloads, automatic verdicts, and
   rollback. SaltMarcher has no interchangeable production replicas or users
   before feature completion, so only the controlled-comparison structure is
   transferable; the canary must run on an isolated synthetic production route.

M1 supplies a useful historical calibration case, not a timing comparison.
Commit `77c97f27b` disabled the prepared Campaign shell in
`app/AppBootstrap.java` before publication while the then-current production
journey did not ask whether the active root was enabled. The current slice
identifies a calibration to preserve: run its unchanged visible journey with
only the shell re-enable cause removed, then with that cause restored. If an
independent replay preserves the exact command, candidate commits, and literal
results and observes fail then pass, it can qualify the acceptance-derived
question "after Campaign activation, is the shown shell enabled and operable?"
as an oracle for this one escape. It still cannot show that asking the question
earlier would have reduced rework, because the historical comparison changes
both oracle presence and product revision and cannot replay past timing.

No evaluation under [Process Evaluation](process-evaluation.md) is therefore
requested. Before B may propose any timing delta, it must find a prospectively
selected uncertainty and freeze its canonical acceptance ID and owner, one
implementation-neutral question, the same executable production route and
oracle, the baseline and candidate timing rule, candidate state, resource cap,
and rollback. The comparison must isolate timing rather than adding an oracle
only to one arm. If that cannot be done without changing product work or
withholding useful evidence from A, the timing proposal is not testable and
must be abandoned. Product Process `A-0.3.2` already requires a decisive route
and oracle at slice start, so research alone currently justifies no A change.

Method evidence is preserved at
`references/architecture-specification/sei-atam-collection.md`,
`references/continuous-refactoring/google-small-cls.md`, and
`references/change-governance/google-cloud-approach-to-change.md` in the global
mirror governed by [Source References](../../verification/source-references.md).

## Prospective Repeated-UI Latency Qualification Hypothesis

Research verdict: `RESEARCH_SUPPORTED; Proposed only, not adopted`.

The Campaign Runtime working slice is useful method evidence but not a frozen
process evaluation. Its current-profile warm-switch test separates both switch
directions, performs the binding five warm-ups plus 100 recorded runs per
direction, selects the 95th sorted value, checks every 10-second timeout, and
continues through a visible representative mutation. That is the correct shape
for an early prequalification and repeated-switch soak. It is not `TN-16`
qualification: the fixture is neither independently reproduced `RP-R` nor
`RP-L`, no `RP-H` calibration or supported-OS matrix accompanies it, and its
100-ms `Button.fire()` duration is only synchronous JavaFX-handler occupancy,
not end-to-end interaction feedback.

The current assertion additionally places the one-second threshold on the
combined interval from Campaign action dispatch through the following durable
mutation acknowledgement. The binding text does not currently make the status
of that combined threshold unambiguous. `TN-16` and `QS-05` can be read as
placing the one-second ready budget on the complete consequential path through
the safely rendered and durably preserved next mutation. `TN-15` separately
assigns one second from mutation dispatch to safe-state acknowledgement, which
also supports reading switch latency and mutation acknowledgement as two
separately budgeted operations joined by a zero-violation functional gate. The
first reading prevents a roughly two-second continuation from passing; the
second avoids silently narrowing two explicit budgets and identifies which
obligation failed. Stopping at handler return or durable activation satisfies
neither reading because it declares readiness before operability was proved.

B cannot resolve that owner-semantic dependency through process research. The
running A slice therefore retains its conservative combined one-second check.
Before a later normative qualification, the technical-needs owner must state
whether the combined interval is the `TN-16` latency verdict or only a stronger
guard over separate `TN-16` and `TN-15` verdicts. Observer design can proceed
without prejudging that decision only if it records every boundary needed to
compute both interpretations from the same samples.

One run stopped at `Latency Alpha sample 15` after ten seconds while the
reported durable activation remained `Latency Beta`. The XML retained the
terminal snapshot but no preceding sample values or milestone trace. The
working source and report were not frozen together, so this is product-search
evidence only: it neither identifies whether the product action was admitted
nor demonstrates that a process delta would improve attribution. Do not
average, retry away, or include such a timeout in a percentile; every
correctness, durability, isolation, or timeout violation invalidates the whole
population.

For the first frozen slice that needs repeated visible latency qualification,
evaluate one process variable: replace timed-region JavaFX polling with a
bounded event recorder around the unchanged production route. OpenJFX warns
that many queued `runLater` calls can make the application unresponsive, while
the current polling helper repeatedly schedules work on the JavaFX Application
Thread. A post-layout pulse is a useful milestone because it occurs after CSS
and layout, but official OpenJFX documentation places it before rendering; it
must not become the sole ready oracle. No microbenchmark or direct controller
call may replace the production action, visible target truth, and durable next
mutation.

Freeze the exact candidate commit, clean-tree state, test and fixture hashes,
manifest version, JDK and JavaFX builds, OS and architecture, locale and
timezone, display backend and scale, power mode, background-work category, and
literal command. Before each timed action, establish outside the interval that
the source Campaign is exact, the target differs, the shown target control is
present and enabled, no prior switch is pending, and the chosen environment and
profile calibration still pass. Start at production action dispatch. Record at
least action admission, coordinator phase and generation changes, durable
target activation, exact root replacement, enabled target title and focused
Scene, the first post-layout pulse for that root, representative mutation
dispatch, durable revision, and visible stored acknowledgement. End only when
the unchanged `TN-16` ready oracle passes. Buffer timestamps and states in
memory and write the complete per-sample record after the timed action or in a
failure-safe finalizer; diagnostic output inside the interval is forbidden.

The recorder produces three non-substitutable intervals. Switch-to-render starts
at production action dispatch and stops only after exact target truth, enabled
controls, CSS/layout, and independently calibrated render/presentation evidence
for the new root. The next mutation is then dispatched through its normal
visible route; mutation-to-acknowledgement stops at the truthful visible stored
acknowledgement, with independent durable readback performed after the timed
interval. Switch-through-acknowledgement spans the complete consequential path.
All three are retained per sample so correlated tail cost cannot disappear.

Until the owner resolves the semantic dependency, the report applies the
current conservative combined verdict of one-second p95 and ten seconds per
sample, and separately reports the same thresholds against switch-to-render and
mutation-to-acknowledgement without allowing either to replace the combined
verdict. If the owner later selects the separated interpretation, successful
durable mutation remains a zero-violation gate on the `TN-16` population and
qualifies the earlier render milestone as genuinely ready; if the owner selects
the consequential-path interpretation, the combined endpoint remains the
`TN-16` endpoint. In either case, a crash/power-loss matrix remains necessary
for the full `TN-15` loss verdict.

Keep direction, profile, OS, warm state, and background-work category as
separate populations. Use exactly five unrecorded warm-ups and 100 recorded
runs per population and the canonical 95th sorted value; never add successful
retries to replace a failed run. Preserve ordinal order in the raw record so a
late slowdown or stuck transition remains visible even when p95 passes. A
second unchanged run may test reproducibility, but its values remain a separate
population. Repeated-switch correctness soak, handler-occupancy diagnostics,
and normative latency qualification may share setup, but each keeps its own
verdict and no weaker lane closes a stronger obligation.

### Proposed Paired Optimization Evaluation

Research verdict: `RESEARCH_SUPPORTED; Proposed only, not adopted`.

Do not judge a JavaFX optimization by one before run and one after run. Managed
JVM performance varies across VM invocations because of JIT, scheduling, GC,
and system effects; the preserved Java study recommends warm iterations across
multiple VM invocations and uncertainty-aware comparison. Chromium's production
performance service likewise repeats base and patch arms on the same controlled
device and retains each benchmark run. These sources support replicated matched
arms, not treating one unusually fast or slow run as the effect.

For a later frozen optimization candidate, use five adjacent baseline/candidate
pairs in isolated worktrees. Each arm in each pair starts a new JVM and produces
one complete population per direction: five unrecorded warm-ups and exactly 100
recorded runs with the unchanged oracle, fixture manifest, observer, and
thresholds. Pair the same manifest and environment but use disjoint fixture
copies. Precommit a recorded random seed that counterbalances three `AB` and two
`BA` pair orders; do not reorder after seeing a result. Freeze both commits,
their complete diff, JDK/JavaFX and wrapper hashes, CPU/storage calibration,
display backend, scale, locale, timezone, power mode, and background-work
category. Run no concurrent build or deliberate workload. An environment or
calibration mismatch invalidates the whole trial rather than only its
inconvenient arm; restart later from a new freeze instead of replacing selected
pairs.

The predeclared comparison unit is the population-level p95, not the 100
within-JVM samples as if they were independent process replications. Preserve
both directions; make the primary value for the running slice the worse of the
two combined-path p95 values, while retaining every directional and phase value
for diagnosis. The five paired differences then admit a locally checkable
one-sided sign rule. NIST defines the paired sign statistic as binomial with
`p = 0.5` under no directional difference and excludes ties. Five strict
candidate wins therefore have probability `1/2^5 = 0.03125` under that null.
Only five strict wins support the narrow claim "this candidate repeatedly
reduced the declared p95 statistic". A tie leaves at most four signs and is
`INCONCLUSIVE`, as are mixed signs. Always publish the five baseline values,
five candidate values, paired differences and ratios; the sign rule establishes
directional consistency, not practical effect magnitude or canonical `TN-16`
qualification.

Use a reversible canary before spending the five-pair budget: replay the exact
functional journey, observer controls, one matched warm population, and the
current absolute threshold, but make no improvement claim from it. Stop and
roll back the optimization immediately on any correctness, isolation,
durability, stale-generation, listener-cleanup, or hard-timeout violation; a
missed negative control; changed fixture/oracle; or a candidate absolute-budget
failure when its matching baseline passes. If the baseline itself violates a
hard product oracle, classify the comparison as invalid and route the candidate
through separate repair proof rather than relabeling it as a performance win.

After the canary, acceptance may occur only after all five precommitted pairs;
there is no success peeking or optional extension. A first tie or baseline win
may stop the run early as `INCONCLUSIVE` because the all-five success rule has
already become impossible; early stopping can reject a claim but cannot accept
one. Five baseline wins are symmetric evidence of a regression and trigger
rollback. Mixed results retain the baseline for the performance decision unless
A has an independently proved correctness reason to keep the candidate, in
which case no optimization claim is recorded. Exceeding five pairs, 45 minutes,
or the frozen resource envelope is `INCONCLUSIVE`, not permission to weaken the
oracle or add retries.

The canary baseline uses the frozen polling observer and the candidate changes
only observation to one-shot or otherwise bounded listeners. The same injected
slow-switch, slow-durability, stale-target, suppressed-admission, and
suppressed-acknowledgement controls must respectively fail only the applicable
budget or the shared zero-violation gate in both arms. The candidate observer
must tag every event with the sampled Campaign and activation generation,
register only bounded one-shot listeners, and remove them in a failure-safe
finalizer. Adopt only if it preserves every control verdict, captures a complete
failure trace, emits no unbounded JavaFX work, and an independent evaluator
reproduces the literal results without product or fixture changes. A missed
control, changed route, missing raw record, observer-dependent product verdict,
profile or environment mismatch, or inability to remove all listeners and
artifacts makes the trial `INCONCLUSIVE` and retains the existing process.

This proposal changes no running A slice, `TN-16` threshold, qualification
profile, product behavior, or required `check`. Its primary method evidence is
the binding population and calibration contract in
[Program Technical Needs](../../architecture/program-technical-needs.md), the
production-route/timing distinction in
[Quality Platforms](../../verification/quality-platforms.md), and the preserved
OpenJFX `Platform` and `Scene` API sources at
`references/quality-platforms/openjfx-platform-accessibility.md` and
`references/quality-platforms/openjfx-scene-snapshot.md`. Replicated JVM and
paired-comparison evidence is preserved in the global mirror at
`references/testing-quality/georges-statistically-rigorous-java-performance-evaluation.md`,
`references/testing-quality/chromium-perf-trybots.md`, and
`references/testing-quality/nist-paired-sign-test.md`.

## Foundation-Reopen Triage Method

Research verdict: `METHOD NOTE; no process delta or adoption candidate`.

Product Process `A-0.3.2` already requires A to reopen a root decision when
counterevidence invalidates its premise. It does not operationally identify the
premise shared by a succession of local repairs or say when another local
hypothesis stops being the best next experiment. The current Campaign Runtime
search exposed that gap: a theoretical visible-ready oracle was falsified; the
replacement two-pulse production gate exposed an unstable one-second whole-root
rebuild; and two reversible micro-canaries did not create robust margin before
A reopened the runtime/render-host lifetime decision. Reopening did occur, but
only after the process had supplied no explicit way to distinguish another
local repair from an architectural re-evaluation.

The working tree and intermediate canaries were not frozen as a comparable
baseline/candidate process trial. This observation therefore supports only the
refinable search method below. It does not establish that a different process
would have reopened earlier, request evaluation under [Process
Evaluation](process-evaluation.md), repin the running slice, or change A.

For B's later observation and proposal research, group repair attempts by the
unchanged acceptance scenario and the shared architectural decision on its
causal path. Before each reversible micro-canary, name one local causal claim,
its predicted movement in the unchanged oracle, the guard conditions, and the
rollback. Afterwards classify only what the literal result supports:

- a valid pass with declared guard margin supports the local claim;
- no pass or no declared margin falsifies that local claim;
- an observer, fixture, workload, or oracle change makes attribution
  inconclusive; and
- a practical trace that localizes the dominant failure or cost to a shared
  lifetime, ownership boundary, consistency boundary, or deployment boundary
  marks that decision as the leading architectural sensitivity hypothesis.

Before spending another micro-canary, compare its new local causal claim with
reopening that shared decision. Treat foundational exploration as the default
search direction when one practical probe already attributes the failure to
the shared decision, when two distinct valid local canaries leave the same
oracle failed or without its declared margin, or when the next local repair
would preserve the decision through a bridge, duplicate lifetime, or parallel
truth. This selects the next uncertainty to test; it neither rejects the
foundation nor authorizes a replacement. A may retain it if a direct practical
comparison supplies a current product or quality reason.

The count of two is a bounded search heuristic calibrated to this demonstrated
sequence, not a statistical threshold or adopted Product Process rule. A later
frozen trial would have to change only this triage variable and compare time to
the same valid oracle, discarded work, severe-finding detection, and rollback
cost. Until an independent evaluator qualifies such a candidate, B uses the
method only to investigate delayed reopening and must not direct A, weaken an
oracle, stack failed candidates, or turn prior investment into evidence.

SEI's ATAM supplies the architectural part of the method: prioritized quality
scenarios act as tests of architectural approaches and expose risks,
sensitivity points, and tradeoff points. Google Cloud supplies the reversible
change part: canary and control are compared against health signals, and a
failed signal pauses or rolls back the running change instead of proving it.
Google's small-change guidance supports one self-contained change because a
wrong direction then wastes less work, but it does not imply that indefinitely
many small changes make a wrong direction right. The preserved primary sources
are `references/architecture-specification/sei-atam-collection.md`,
`references/change-governance/google-cloud-approach-to-change.md`, and
`references/continuous-refactoring/google-small-cls.md` in the global mirror.

## Stateful Failure-Chain Preflight Research

Research verdict: `NO DELTA; METHOD NOTE only`.

B's current Campaign Runtime observation reports four distinct severe
hypotheses exposed only in successive review waves: cleanup authority could be
lost, read-side qualification could mutate its source, schema comparison could
miss a semantically relevant dependency form, and a cleanup oracle could cancel
the resource whose terminal release it was meant to observe. The repaired
production routes and negative controls provide useful product-search evidence.
They do not provide a frozen baseline/candidate process comparison: the running
slice is pinned to Product Process `A-0.3.0`, the intermediate candidates and
review conditions were not retained as one replayable workload, and no run
shows that Product Process `A-0.3.2` would have escaped the same findings or
that the method below would have found them earlier. B therefore proposes no
Product Process edit, evaluation, adoption, or running-slice repin.

The newest working-state evidence sharpens the prospective method without
changing that verdict. The production publication route now distinguishes root
swap authorization, visible-readiness observation, cancellation settlement,
recovery publication, detached-root release, and a later healthy mutation. Its
timeout scenario encodes the distinction between cancelling the readiness
observer, proving the published root ready, and proving its resource released.
The close routes separately exercise a synchronous invocation failure, an
exceptional returned attempt, a withheld attempt that settles later, and a fresh
retry after terminal failure while retaining the same cleanup obligation. The
bounded caller result remains terminal even when its retained owner later
finishes cleanup. These are inspectable current-slice calibration routes in
`test/app/CampaignRuntimeProductionJourneyTest.java`,
`test/app/CampaignRuntimeLifecycleTest.java`, and
`test/app/CampaignActivationCoordinatorTest.java`; they are not a frozen
baseline/candidate process comparison and therefore are not an Aletheia process
verdict.

The Session Planner constructor escape is a second calibration of the same
method. The pre-repair source acquired several foreign subscription handles
while constructing the assembly; a later acquisition could throw before the
aggregate was returned, leaving earlier release obligations with no reachable
aggregate owner. The working repair moves acquisition behind complete Campaign
aggregate ownership, retains each returned release handle, resumes start at the
first acquisition that returned no handle, and retains failed release handles
for a later close attempt. Its focused candidate test injects one acquisition
failure and one release failure and checks non-reacquisition plus eventual
single release. The current retained XML is green for 14 Session Planner runtime
mechanism tests, and the independently retained Campaign runtime lifecycle XML
is green for 10 tests including the partial-start ownership route. Both reports
postdate the production and focused-test edits they exercise.

This still establishes no process comparison. There is no retained literal
pre-repair probe output, frozen pre-repair candidate commit, or unchanged
baseline/candidate workload; the candidate test executes only the repaired
state. The source diff can explain the escape but cannot reconstruct the missing
execution. Product Process `A-0.3.2` requires a causal negative control for each
acceptance-deciding oracle where practical, but it does not specifically require
failure after each partial acquisition before an aggregate ownership handoff.
That is a candidate process variable, not proof of a current-process failure:
the running slice is pinned to `A-0.3.0`, and neither `A-0.3.2` nor the candidate
rule was replayed on the frozen escape. B therefore neither changes Product
Process `A-0.3.2` nor requests an evaluation from this observation.

For B's investigation of a later frozen stateful or persistence-heavy slice,
use one bounded preflight around the unchanged acceptance route and oracle.
Trace only its consequential chain: admission, resource acquisition, source
inspection, mutation, commit, publication, cancellation or recovery, release,
and restart/readback. At each applicable boundary name the authority that may
advance it, the resource or durable state still owned, the externally visible
postcondition, and the independent witness that can observe it. A phase label
or returned future is not evidence that its transitive work, cleanup, or
durable effect has settled.

Treat construction or factory return as an ownership handoff, not as a harmless
setup detail. If construction acquires more than one external handle, inject a
failure after each successful acquisition where controllable. Every earlier
obligation must already belong to a reachable owner or be released before the
failed construction returns; no callback from the failed aggregate may remain
observable. A candidate that merely retries construction may duplicate the
earlier handles and does not satisfy this oracle.

For each asynchronous boundary, distinguish the operation attempt from the
obligation it is meant to discharge. The disposable trace records whether an
attempt was never returned, in flight, successful, or exceptional; whether its
resource obligation remains retained, was explicitly transferred, or was
actually released; and whether an observer is attached, cancellation-requested,
or cancellation-settled. Reusing one nonterminal attempt, starting a fresh
attempt after exceptional settlement, and releasing the obligation are three
different claims. Likewise, observer cancellation may stop observation without
establishing either the observed postcondition or resource release. Do not
collapse those states into one `done`, `closed`, or `cancelled` flag.

Exercise every controllable consequential boundary first with a one-shot fault
and then with a fault that remains active. After disabling injection, inspect
the same external invariants: pre-authority source bytes and companions were
not changed, the durable state is entirely old or entirely new as required,
the prior usable state remains usable where the contract requires it, every
acquired resource still has exactly one release authority, and restart/readback
agrees with the terminal result. Add a compound fault only where recovery or
cleanup handles an earlier fault; for example, withhold release while recovery
is already active. This is fail-at-boundary exploration of the named product
chain, not a demand to simulate SQLite internals or enumerate unrelated faults.

Where the production abstraction can express them, the bounded fault packet
uses three distinct terminal shapes at the same boundary: throw before an
attempt is returned, complete the returned attempt exceptionally, and withhold
it past the decision budget before releasing it to a declared late success or
failure. The packet then repeats only the recovery or cleanup fault once and
persistently. Applicable external oracles verify that a nonterminal attempt is
not duplicated, an exceptional terminal attempt permits only the contractually
allowed fresh retry, allocation remains blocked while ownership is unresolved,
and success releases the retained obligation exactly once. If the owner
contract deliberately returns a bounded failure while cleanup continues, late
cleanup must not rewrite that caller result.

Keep the oracle outside the injector, scheduler, and resource under test. The
release authority remains live until release succeeds or an explicit terminal
owner takes it over; timeout, cancellation, and recovery do not satisfy their
own cleanup postcondition. Applicable controls suppress the terminal callback,
make release fail once and persistently, and cancel the initiating observer
before the resource settles. Each must leave the unchanged external oracle
unsatisfied. If the observer's cancellation can itself manufacture the
expected terminal observation, attribution is invalid rather than green.

At parser, schema, manifest, or configuration boundaries, add a small pair of
contract-derived input mutants per material semantic dimension: one different
representation that the owner says is equivalent and one syntactically valid
variant whose semantics the owner says must differ. Both run through the same
production parser and external oracle. A normalized string, mutation score, or
arbitrary text edit cannot decide semantic equivalence. Surviving productive
mutants are concrete test goals; they neither prove that the correct algorithm
was selected nor justify unbounded variant generation.

Before the Compatibility Covenant activates, persistence mutants and
restart/readback probes target only the current direct format and disposable
synthetic state. This method creates no predecessor reader, migration chain, or
legacy-preservation obligation. It also changes neither the process-neutral
Program Charter nor the goal prompt derived from it; any later candidate rule
must live in the separately versioned Product Process.

FoundationDB's preserved primary documentation supports deterministic replay
and intense injected component failures while retaining complementary live
testing. Microsoft's P and Coyote sources support explicit event-state models,
externally stated safety/liveness properties, controlled nondeterminism, and
reproducible failing traces. The Google mutation-testing study supports using a
small number of actionable change-local mutants as test goals and reports
fault coupling for 70% of its studied high-priority bugs, while explicitly
limiting the method for higher-level specification and protocol faults. These
sources justify the search mechanisms, not their effectiveness on SaltMarcher.
The attempt-versus-obligation split above is B's inference from the local
publication and close routes; none of the external sources validates that
taxonomy or its process benefit for this product.
They are preserved under the global mirror at
`references/agent-methods/foundationdb-simulation-and-testing.md`,
`references/agent-methods/microsoft-p-safe-asynchronous-event-driven-programming.md`,
`references/agent-methods/microsoft-coyote-systematic-testing.md`, and
`references/testing-quality/mutation-testing-improve-testing-practices-2103.07189.md`,
with the originals named in each extract.

The first eligible process trial must freeze an actual pre-repair escape under
the then-current Product Process and change only whether this preflight occurs
before broad review. The candidate preflight uses the same consequential-chain
trace, attempt-versus-obligation states, and bounded terminal-shape packet
described above; when the escape crosses construction, its packet also fails
after each acquired external handle and observes callback silence plus exact
release cardinality. The baseline omits only that preflight. Both arms keep the
same product commit, route, oracle, fault packet, review panel, and resource bound.
The independent evaluator compares severe findings discovered before review,
total severe escapes, valid-proof regressions, elapsed effort, and clean
rollback. Until that comparison is replayable and independently adopted, this
note changes no A checkpoint, product proof, review requirement, goal prompt,
or acceptance rule.

## Pre-Completion Legacy-Work Search Heuristic

Research verdict: `METHOD NOTE; no process delta or adoption candidate`.

The binding owner premise, Product Process, and roadmap already state that no
user and no non-disposable legacy data exist before complete GM-Core feature
completion. The existing B boundary already allows B to report bridge
construction. The list below is only a search heuristic for gathering evidence
under those rules. It adds no required checkpoint, classification, A action,
product semantics, destructive authority, or running-slice repin.

When B investigates suspected pre-completion legacy work, useful search leads
include:

- readers, writers, converters, migration chains, compatibility shims, dual
  representations, fallback paths, or version histories whose only consumer is
  an earlier development build, fixture, test database, or internal schema;
- architecture or storage choices retained because changing them would require
  adapting disposable development state;
- tests whose only asserted value is that a newer pre-completion candidate can
  consume state emitted by an older pre-completion candidate; or
- a bridge around a falsified foundational decision when direct replacement
  has not been reconsidered against the current canonical need and practical
  evidence.

A text match is not a finding. A useful report identifies the concrete
consumer, durable baseline, canonical acceptance outcome allegedly requiring
the work, affected slice, and exact bridge or compatibility cost. If the
evidence shows only pre-completion disposable consumers, B reports that evidence
and cites the existing Product Process or roadmap exclusion. A retains its own
authority over the product response. Repetition after the existing rule was
applied could become a demonstrated process failure eligible for a separately
versioned, one-variable proposal under Process Evaluation. A hypothetical risk
or vocabulary match is not such a failure.

Current-format correctness remains in scope. Restart, crash recovery,
transactional integrity, current-format import and export, and semantic
readback are not legacy work merely because they use durable state. Conversely,
calling an old representation a recovery format or future-proofing does not
make its preservation necessary. If the consumer or data provenance is unknown,
or any real/non-disposable data is discovered, B reports the contradiction and
cites the existing owner-data boundary; this method note grants no authority to
classify unknown data as disposable or to choose the response.

Before the trigger, practical counterevidence may reopen any foundational
decision. The re-evaluation compares direct replacement and any bridge against
the current canonical outcomes, quality constraints, and production-route
evidence; prior implementation, documentation, tests, commits, or adaptation
cost carry no compatibility authority. A decision may still be retained for a
current product or quality reason, but that reason must stand without legacy
premises.

The same search evidence changes meaning only after the literal cutover facts
required by the Product Process exist: owner authorization, exact artifact,
durable-surface baseline, and fresh-install create/restart/read proof. Before
those facts, an older internal format is not a released-data baseline. After
them, reports must treat real released data as an input to any reopened
decision. The adopted Product Process, not this heuristic, requires
preservation or a practically proved explicit upgrade path. Fundamental
decisions remain reopenable in both states; reopening never makes released data
disposable.

The heuristic adds no new external premise. Semantic Versioning ties
compatibility meaning to a declared public contract and makes a released
version immutable;
Room's official migration guidance ties migration to preserving user data that
already exists on-device. These sources support the distinction between
internal development and a released consumer but do not choose SaltMarcher's
cutover. That boundary remains owner-given. The preserved sources are
`references/release-engineering/semantic-versioning-2.0.0.md` and
`references/android-platform/android-room-migrating-db-versions.md` in the
global mirror.

### First Applied Audit

A read-only program audit applied the heuristic after the owner clarified the
pre-user boundary. It found executable predecessor-shape work rather than mere
vocabulary: fresh M1 startup still traversed historical Dungeon, Session
Planner, Encounter, and Items schema chains, while later Party, World Planner,
Session Generation, Hex, and Dungeon slices retained predecessor normalization
or conversion fixtures. Aletheia A responded by replacing the M1 startup paths
with direct current-schema construction and fail-closed handling of incomplete
development shapes. The later findings remain evidence to revalidate when
their owning slices open; they are not a compatibility roadmap or permission
to change unrelated product behavior early.

Observation: `no process delta proposed`. The audit found and routed concrete
work while applying the existing Product Process covenant and this search
heuristic. This first application is observational evidence for a later
independent process evaluation; B neither certifies the method nor records an
adoption verdict here.

## Adopted Compatibility-Covenant Proposal

Independent verdict: `ADOPTED` under Evaluation `E-0.3.1` for Product Process
`A-0.3.2` and later slice starts. It does not repin any running slice; the
Campaign Runtime slice retains its recorded `A-0.3.0` pin.

The proposal addressed one demonstrated process failure: the prior Product
Process did not distinguish disposable pre-user development state from data
written for authorized non-disposable use. B proposed one monotonic covenant
and a reversible synthetic-release canary. The independent evaluator adopted
that delta and recorded its literal replay, negative controls, limitations, and
rollback under [Process Evaluation](process-evaluation.md).

The current executable rule now lives only in the
[Product Process Compatibility Covenant](product-process.md#compatibility-covenant).
This section records proposal provenance and verdict history; it MUST NOT be
used as a second trigger definition, compatibility contract, or permission to
modify unknown or real data.

The proposal was informed by two independent primary sources. Semantic
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
