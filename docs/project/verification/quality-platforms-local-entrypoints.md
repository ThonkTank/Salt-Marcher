Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-24
Source of Truth: Aggregate entrypoints, staged handoff routing, and local
invocation policy for SaltMarcher quality platforms.

# Quality Platforms Local Entrypoints

## Purpose

This subordinate standard owns local aggregate entrypoints and local invocation
policy beneath the umbrella
[Quality Platforms Standard](docs/project/verification/quality-platforms.md:1).
Individual local gate behavior lives in
[Quality Platforms Local Gates](docs/project/verification/quality-platforms-local-gates.md:1).

## Central Aggregate

`./gradlew check --console=plain` is the local full build-health blocker and
the single central aggregate for repository-owned blocking Gradle checks.

`check` routes through `production-handoff`. It exists for Gradle convention
compatibility; it must not reconstruct or own a second production check graph.

The shared owner list behind `production-handoff` lives in the typed
verification lifecycle catalog; root build scripts must not add those owners
separately.

`pmdStrictMain` and `spotbugsMain` are central blocking gates and may also be
run as focused direct entrypoints. `pmdStrictMain` derives its report from the
`pmdMain` XML result instead of running a second PMD scan. `pmdMain` remains the
direct XML/report producer and diagnostic PMD entrypoint; it is not a hidden
finalizer owner for the production handoff.

## Public Handoff Routes

`tools/gradle/run-staged-verification.sh production-handoff` is the default
implementation-handoff route required by `AGENTS.md` for production-code
changes. The wrapper is runtime-only: it routes the canonical surface name
to the Gradle-owned `production-handoff` lifecycle task after running
repo-owned project-health debt intake for current changed worktree paths.
Owner-area intake remains caller-owned through explicit project-health scan
selectors. The verification core owns the internal phase barriers: compile integrity proves Java and
included-build compilation, structure proves architecture and build-harness
topology, and hygiene aggregates assemble, bundle selectors, and
quality-hygiene tool owners inside Gradle.

For check-only implementation work limited to concrete enforcement packages or
verification-only wiring under `tools/**`, `build.gradle.kts`, or
`settings.gradle.kts`, the narrow local proof route is the documented
`focused-handoff` route when the affected scope can be represented as package
or resource paths. The wrapper forwards only focused paths, optional area ids,
optional compile-integrity intent, and investigation flags; Gradle owns the
diagnostic task selection behind the route. Shared production-code routing
changes still add the required `production-handoff` route. Focused package and
layer-surface tasks remain technical diagnostics, not public proof owners.

`tools/gradle/run-staged-verification.sh focused-handoff --path
<repo-package-or-resource-dir> [--area <area>]` is the package-focused local
development route for scoped implementation work. Additional `--path` values
MAY be supplied for the same focused run. Use it as a fast local proof for
concrete packages or resource directories during scoped check/enforcement or
product-adjacent work when the affected surface is narrow enough to be
validated by the selected focused engines. The wrapper runs project-health
debt intake against focused paths and explicit focused areas before Gradle
starts; unrelated dirty worktree paths are not part of focused intake.

Focused paths are repo-relative package or resource directories such as
`src/domain/encounter` or `src/view/sessionplanner`; ambiguous roots require
explicit `--area <area>`. The optional `--with compile-integrity` flag requests
the normal broad compile integrity checks as Gradle-owned dependencies of the
focused handoff lifecycle task.

`tools/gradle/run-staged-verification.sh focused-handoff --path
src/features/dungeon/runtime --area feature-runtime` is a valid focused route
for feature-runtime source-root placement diagnostics. It selects the
layering-backed `feature-runtime` surface and does not prove internal
feature-runtime topology conformance or passive-carrier mirror absence inside
`src/features/**`.

`focused-handoff` is not a replacement for `production-handoff`, not the proof
route for shared verification-core lifecycle or routing changes, and not enough
for public production-code handoff claims. Production-code changes and shared
verification routing/lifecycle changes still need the broader
`production-handoff` route when `AGENTS.md` requires it.

The Gradle verification core treats an empty focused scope as a failure:
nonexistent paths, files instead of directories, area/path mismatches, and
directories without selected-surface inputs must fail instead of producing a
green no-op run. Handoff text for `focused-handoff` MUST report the literal
paths, selected area, engine surfaces that ran, and any broad supplemental
steps such as `--with compile-integrity`.
The staged wrapper retains the focused paths, selected areas, compile-integrity
request state, Gradle-selected diagnostic surface ids, observable log path, and
observable proof summary in its staged log so handoff reviewers do not need to
reconstruct focused scope from terminal scrollback.

`./gradlew checkDocumentationEnforcement --console=plain` is the focused
`Blocking Local Gate` for Markdown-backed architecture and enforcement
documentation checks. It is intentionally outside `check` and `build` so
documentation-only changes use a narrower proof route.

A completed implementation pass is incomplete until the required
production-code handoff, documented focused-handoff proof for scoped package or
resource work, or documentation-enforcement rerun has completed, or a concrete
blocker has been reported.
For `production-handoff` and `focused-handoff`, the wrapper-owned
project-health debt intake is part of that public proof surface. The wrapper
uses intake-only mode, so it blocks only on matching active registered debt and
does not promote full marker/register synchronization into the wrapper gate. A
matching active debt entry blocks the wrapper before Gradle starts until the
pass resolves it, closes it with evidence, obtains explicit user exclusion, or
reports WIP/blocker.

Public local proof entrypoints are:

- `tools/gradle/run-staged-verification.sh production-handoff`
  Runs the public Gradle `production-handoff` lifecycle task through the
  observable wrapper. The verification core keeps compile integrity, structure,
  and hygiene as internal phase tasks behind that public surface.
- `tools/gradle/run-staged-verification.sh focused-handoff --path
  <repo-package-or-resource-dir> [--area <area>] [--with compile-integrity]`
  Runs the public Gradle `focused-handoff` lifecycle task through the
  observable wrapper. The verification core derives diagnostic surfaces from
  the typed catalog and focused properties; the shell wrapper must not map
  areas to private `check*Enforcement` task names.
- `./gradlew checkDocumentationEnforcement --console=plain`
  Aggregates focused Markdown-backed architecture and enforcement-document
  coverage through `:build-harness:documentationEnforcementCheck` plus the
  coalesced per-surface documentation tasks registered inside build-harness.
Internal `verify*Bundle` selector tasks may still exist for typed harness
selection and internal ownership routing, but they are not public proof
entrypoints and must not replace the canonical production-handoff command
above. Technical layer-surface tasks such as `checkViewEnforcement` may still
exist as diagnostics and focused local rerun points, but they are not separate
public production-code proof owners.
Build-harness topology and documentation metadata is coalesced by layer surface
and rule kind before Gradle execution; role-local owner metadata names are not
public or runnable proof entrypoints unless this document explicitly lists them
as utility gates.
Direct `:build-harness:*BuildHarness*Check`,
`:build-harness:allBuildHarnessTopologyCheck`, and
`:build-harness:architectureCheck` requests are engine-local diagnostics only.
They may be useful when repairing the harness itself, but they do not replace
the public production-handoff or documentation-enforcement proof routes.

Focused investigation entrypoints are `compileJava`, `pmdMain`,
`pmdStrictMain`, `checkRewriteNearMisses`, `spotbugsMain`, `cpdMain`,
`lizardMain`, `ckjmMain`, repository/resource policy checks, technical
`check*Enforcement` layer surfaces, `checkDocumentationEnforcement`, behavior
harness JavaExec tasks such as
`./gradlew dungeonEditorBehaviorHarness --console=plain`, focused Dungeon
Editor suite tasks documented in
`docs/dungeon/verification/verification-dungeon-editor-wide-invariants.md`,
other focused feature or concept harness tasks declared in `build.gradle.kts`,
and the Gradle-owned `focused-handoff` route, each run through its documented
command shape. Investigation tasks are not alternate production-handoff
entries.

Behavior harness entrypoints remain independently runnable proof surfaces. When
a concept depends on another concept, its owning harness or suite registry must
select the dependency automatically, or the implementation handoff must run and
report the dependent harnesses explicitly. The Dungeon Editor
`DungeonEditorBehaviorSuiteHarness` is the target pattern: atomic suites declare
dependencies, alias suites aggregate only, and focused tasks delegate to the
same registry instead of maintaining separate proof order.

## Runtime Wrapper Policy

For wrapper-based local runs, failure aggregation across independent gates is a
runtime-wrapper concern. `tools/gradle/run-observable-gradle.sh` adds Gradle
`--continue` to wrapper-based runs so long handoff and investigation runs
report the full current failure set without moving that policy into the
convention-plugin layer or reconstructing private task families in shell.
Callers that need first-failure diagnosis may pass wrapper option
`--fail-fast` before the task or staged surface name; the wrapper then omits
its default `--continue` and rejects a contradictory extra Gradle `--continue`.

By default, wrapper-based `production-handoff` uses Gradle `--continue` so the
canonical implementation-handoff route reports the broader current failure set.
The verification core orders hygiene work behind marker-backed phase completion
so hygiene owners do not execute after a failed structure phase. The staged
handoff still fails overall when any blocking dependency fails. The command
`tools/gradle/run-staged-verification.sh --fail-fast production-handoff`
preserves the same public surface while omitting the wrapper's default
`--continue`.
Wrapper-based `production-handoff` also requests Gradle configuration cache by
default so compatible broad handoff graphs can store and reuse configuration
state through normal Gradle behavior. Callers may pass an explicit
`--configuration-cache` or `--no-configuration-cache` form after `--` for
investigation; the wrapper then leaves configuration-cache policy caller-owned.
Handoff reports must cite the literal Gradle store or reuse line from the run
log when configuration cache participates.
Direct raw `./gradlew` invocations remain explicit and only aggregate failures
when the caller passes `--continue`.
Observable wrapper logs retain a proof summary at the end of each run:
wrapper elapsed time, the last Gradle actionable-task count line when Gradle
printed one, and the last configuration-cache store or reuse line when Gradle
printed one. Staged wrapper logs copy that observable summary and the observable
log path for public staged surfaces.

Additional Gradle investigation flags may be passed after `--`, but runtime
wrappers own invocation defaults such as `--console=plain`. If callers pass
wrapper-owned runtime flags again through the extra-args channel, the runtime
wrapper ignores them and logs the filtered arguments instead of forwarding
duplicate built-in Gradle options.

When Gradle startup fails with a known environment problem, the observable
runtime wrapper emits a post-failure diagnostic hint from the captured log. For
example, environments without required IPv4 bind support are reported as an
environment issue rather than a checker failure. This hint is not a pre-Gradle
socket preflight.

## Local Concurrent Work

Local Gradle gates do not provide wrapper-managed same-checkout isolation. When
multiple agents work in one checkout, the caller owns write-set coordination:
assign disjoint file scopes, serialize edits to shared files, and report which
paths each agent owned. Linked worktrees or per-agent branches are optional
operator choices only when explicitly requested, not a SaltMarcher governance
requirement.

The harness no longer creates per-invocation `.gradle/isolated-runs/**` roots,
synthetic included-build mirrors, wrapper-published plugin repositories,
generated descriptor snapshots, or wrapper-owned retained-failure export
surfaces.

The verification core still computes focused bundle selection during settings
evaluation and still registers the same technical layer surfaces,
`checkDocumentationEnforcement`, and staged lifecycle tasks. The included
builds and bundle descriptors are resolved directly from the active worktree
layout. Settings evaluation also publishes request-scope engine facts so a
focused task graph includes only the build-harness, quality-rules,
quality-rules-errorprone included builds, plus jQAssistant task registration,
that the selected surface can actually consume. Broad `production-handoff` does
not register jQAssistant tasks by default; direct jQAssistant requests and
focused surfaces still do. This graph pruning does not change the public proof
route or the checks behind a requested surface.
Direct build-harness diagnostics participate in the same focused-selection
mechanism: the settings plugin activates the matching layer-surface bundles, or
all topology-owning bundles for `allBuildHarnessTopologyCheck`, before the
included build registers the requested task.

`./gradlew` now uses Gradle's normal daemon behavior unless the caller
explicitly passes `--daemon` or `--no-daemon`.
`tools/gradle/run-observable-gradle.sh` and
`tools/gradle/run-staged-verification.sh` remain the preferred runtime wrappers
for observability and staged surface routing, but they no longer provide
parallel safety by rewriting Gradle cache or build directories.

Callers may still pass investigation-oriented extra args such as
`--rerun-tasks`, `--stacktrace`, `--info`, or `--scan`, while runtime wrappers
continue to own their invocation defaults and global wrapper-based
`--continue` default. `--fail-fast` remains a wrapper option, not a Gradle
extra argument.

This does not make bytecode-dependent entrypoints source-only. `spotbugsMain`,
`ckjmMain`, and the technical layer surfaces still require current compiled
classes; if `compileJava` fails, those entrypoints may be skipped because
their prerequisite failed.

Local blocking Gradle gates may finish `UP-TO-DATE` or `FROM-CACHE` when their
declared inputs and outputs are unchanged. That reuse comes from normal Gradle
behavior inside the active worktree.
Local jQAssistant store reuse is deliberately up-to-date reuse, not a remote
build-cache contract: scan tasks own bytecode/source scan inputs, while analyze
tasks own rule directories, rule groups, and reports. jQAssistant remains a
direct or focused diagnostic surface rather than a default broad
`production-handoff` dependency.
Focused, documentation, and broad dry-run investigation may also use Gradle's
configuration cache when the selected graph is compatible. Broad
`production-handoff` must report configuration-cache store and reuse literally
instead of assuming reuse from the wrapper.

## Performance Proof Routing

Pull requests labeled `task:performance` must name the performance proof route
used for the changed surface and cite the retained evidence or measurement
artifact. Acceptable review-owned routes include observable/staged Gradle
elapsed-time readback, actionable task-count readback, configuration-cache
store/reuse readback, startup or runtime timing, focused hot-path measurement,
or another concrete owner-approved measurement for the affected path.

The default route is review-owned evidence, not a numeric budget and not a new
CI blocker. Numeric thresholds, budgets, or branch-protection promotion require
an explicit owner decision.

## References

- [Quality Platforms Standard](docs/project/verification/quality-platforms.md:1)
- [Quality Platforms Local Gates](docs/project/verification/quality-platforms-local-gates.md:1)
- [Verification Core Architecture](docs/project/architecture/verification-core.md:1)
