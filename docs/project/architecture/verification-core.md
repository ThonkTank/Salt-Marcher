Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-07
Source of Truth: Verification-surface ownership, layer boundaries, and public
verification-entry architecture for SaltMarcher build logic.

# Verification Core Architecture

## Purpose

This document defines the architecture of SaltMarcher's verification runtime,
verification-core lifecycle surface, focused enforcement bundles, and private
rule engines.

It owns the structural split between runtime wrappers, public Gradle
verification surfaces, bundle-owned focused checks, and private rule
implementation. It does not redefine the detailed proof inventory from
`docs/project/verification/quality-platforms*.md`, and it does not redefine the
layer or role rules owned by `docs/project/architecture/enforcement/`.

## Stakeholders And Concerns

Primary consumers are engineers changing `tools/gradle/**`, `build.gradle.kts`,
`settings.gradle.kts`, `tools/quality/**`, and the verification documentation.

This document answers:

- where public verification surfaces are owned
- which layer may know surface names, bundle descriptors, or concrete rules
- how focused bundle selection is propagated into included builds
- which Gradle/runtime patterns are allowed in the harness wiring

## Current Architecture

SaltMarcher verification is split into four layers.

### 1. Runtime And UX

`tools/gradle/*` owns observability, staged verification routing, and
user-facing command ergonomics.

Runtime wrappers MAY know canonical verification surface names. They MUST NOT
know bundle member tasks, internal rule lists, or architecture-rule ownership.
`tools/gradle/run-staged-verification.sh` forwards one canonical surface name to
one same-named Gradle lifecycle task. `tools/gradle/run-observable-gradle.sh`
remains a generic runtime wrapper for one Gradle invocation.

Runtime wrappers own their invocation defaults for console mode. When callers
pass those same Gradle built-in flags again through the wrapper extra-args
channel, the runtime wrapper sanitizes and logs the duplicate wrapper-owned
flags instead of forwarding conflicting built-in options to Gradle. Daemon
selection now follows Gradle's normal behavior unless the caller explicitly
passes `--daemon` or `--no-daemon`.
Runtime wrappers also own `--continue` policy for public gate entrypoints so
failure aggregation is an explicit runtime decision instead of a hidden
convention-plugin mutation.
The staged production handoff now defaults to continue-on-failure through the
runtime wrapper so the canonical handoff route reports the broad current
failure set in one run. The wrapper still owns that policy rather than the
verification core itself, and direct raw Gradle use of the public surface does
not inherit wrapper defaults automatically.

### 2. Verification Core

The included build `tools/gradle/build-logic` owns the declarative public
verification surface model.

Mechanically enforced public lifecycle surfaces are:

- staged lifecycle surfaces: `production-build`, `quality-hygiene`,
  `architecture`, `view-topology`, `docs`, `metrics-report`,
  `desktop-install`, and `production-handoff`
- canonical layer surfaces: `checkViewEnforcement`,
  `checkDomainEnforcement`, `checkDataEnforcement`,
  `checkShellEnforcement`, `checkBootstrapEnforcement`,
  `checkStylingEnforcement`, and `checkLayeringEnforcement`
- focused documentation surface: `checkDocumentationEnforcement`

Beyond the staged lifecycle names, the verification core also owns direct
root lifecycle tasks that feed those aggregates. These root-owned tasks include
shared hygiene gates such as `checkNoDeadCode`; they are verification
core surfaces, not focused enforcement bundles. Staged surfaces may
also depend on explicitly selected report-only sibling diagnostics when the
standard handoff path should print guidance without changing pass/fail
semantics.

The verification core owns the mapping from a public surface to its underlying
Gradle dependencies. Root build scripts MUST consume this core instead of
reconstructing the surface model themselves.

### 3. Bundle Owners

Each focused enforcement package under `tools/quality/*-enforcement/` owns one
typed bundle descriptor, not one canonical public entrypoint. Standard bundles
are registered centrally by the verification core from that registry, and the
verification core then groups them behind the small layer-surface set. Bundles
with small local extras such as stylesheet or FXML checks still register
through the same standard verification-core path instead of through dedicated
root plugins. The staged `view-topology` surface is intentionally routed to
the dedicated closed-world `checkViewLayerEnforcement` bundle owner rather
than to a second view-specific graph-analysis owner.

Bundle owners MAY know their private ArchUnit, Error Prone, PMD,
jQAssistant, or build-harness tasks. They MUST NOT depend on shell wrappers.
They communicate with the verification core only through stable typed registry
metadata, their bundle-local lifecycle tasks, and any explicitly declared
report-only sibling surfaces.

Root-owned hygiene gates that are not bundle-specific MUST stay registered in
the verification core itself. They MUST NOT be back-ported into fake
focused bundles just to reuse the bundle registry.

### 4. Rule Implementation

Private rule implementation lives in build-harness, PMD rules, Error Prone
rules, ArchUnit suites, jQAssistant rules, typed Gradle tasks, and the generic
documentation-coverage catalog plus the small set of remaining custom
documentation rules.

Rule engines MUST remain ignorant of staged surfaces, shell wrappers,
production-handoff flows, and runtime UX concerns.

## Dependency Direction

Allowed dependency direction is strictly inward:

- runtime wrappers -> public verification surface names only
- verification core -> public layer surfaces, staged surfaces, included-build
  entrypoints, and enforcement specs
- bundle owners -> private rule tasks and typed proof wiring
- rule implementation -> concrete source files, compiled classes, documentation
  inventories, and engine-local support code

Forbidden shortcuts:

- runtime wrappers naming private rule tasks or bundle member lists
- `settings.gradle.kts` reconstructing public surface mapping, exception-bundle plugins, or private rule membership
- root build scripts duplicating the public surface mapping already owned by the
  verification core
- build-harness, PMD, Error Prone, or jQAssistant code knowing staged surface
  names

## Focused Surface Propagation

Focused verification selection is computed from the requested public task set
during root settings evaluation by the `saltmarcher.settings` plugin from
`tools/gradle/build-logic-settings`. Canonical layer surfaces expand to their
owning bundle ids there, and direct bundle-task requests are still translated
to the same bundle-id set. The build publishes only three focused-selection
facts to the included builds:

- `saltmarcher.repoRootDir`
- `saltmarcher.focusedEnforcementBundleMode`
- `saltmarcher.activeEnforcementBundleIds`

Included builds consume those facts and MUST NOT reconstruct the root repo
state from alternative checkout-relative guessing when the propagated repo root
is available. Project-build plugin code likewise MUST NOT re-derive focused
surface or bundle selection from `StartParameter` task names once the
settings-owned selection facts were published.
Included builds own their technical registration from typed registry metadata
and explicit static source roots such as build-harness rule classes, Error
Prone checker lists, ArchUnit task shapes, PMD task shapes, jQAssistant task
shapes, and generic documentation-coverage spec ids or custom-task kinds. A
jQAssistant task shape may declare one local rule
directory or multiple rule directories; the verification core materializes one
effective rules root from that registry metadata instead of forcing bundles
to duplicate shared taxonomy files. Harness wiring MUST NOT rely on parallel
families of tiny launcher mains or `*-host.gradle.kts` scripts as a second
source of truth for the same metadata, and it MUST NOT regenerate a second
snapshot copy of the same registry metadata just to make same-worktree
parallelism safe.
Shared verification task registration inside `tools/gradle/build-logic` should
flow through typed plugin or extension APIs rather than through untyped
`extra[...]` function exports between precompiled script plugins.
Public verification aggregates and canonical layer surfaces should register
through typed registry providers rather than by matching task names at
configuration time.
The remaining root-owned build-harness optional rules are now registry-driven
as well: bundles contribute root `architectureCheck` and
`documentationEnforcementCheck` rule classes and documentation-coverage spec
ids through explicit `buildHarnessArchitectureRuleClasses`,
`buildHarnessDocumentationRuleClasses`, and
`buildHarnessDocumentationCoverageSpecIds` metadata instead of hidden
`ServiceLoader` resources, bundle README inventories, or hardcoded
optional-class tables in the owning checkers. Focused build-harness tasks
should execute through the generic `ArchitectureCheckMain` or
`DocumentationCheckMain` paths with task-local rule-class lists or coverage
spec ids instead of one bundle-specific Java launcher per focused task.
`build-harness:processResources` is therefore expected to stay `NO-SOURCE` in
steady-state wrapper runs.
Focused verification tasks with stable declared inputs and outputs SHOULD use
normal Gradle up-to-date and build-cache behavior instead of forcing fresh
execution every run. Successful unchanged verification results may be reused;
this does not relax blocker semantics because changed or previously failing
runs still execute their owning gates.
That rule now also covers the remaining root-owned verification surfaces such
as `spotbugsMain`, `checkNoCompiledArtifactsInSource`,
`checkDesktopPackagingInputs`, and `:build-harness:architectureCheck`; they
must declare their own deterministic inputs and marker or report outputs
instead of relying on blanket rerun forcing.
Bundle-local wiring that still uses relative source paths must resolve from the
active repo-root owner or descriptor owner declared in the descriptor itself.
Root-plugin escape hatches are no longer part of the intended model. If a
bundle needs extra verification tasks, it should declare them as typed extras
inside the same standard bundle registration path.

## Lazy Wiring And Runtime Constraints

Harness wiring MUST use lazy task APIs such as `register`, `named`,
`configureEach`, and `TaskProvider`.

The verification architecture forbids new `allprojects`, `subprojects`,
`create`, `getByName`, `whenTaskAdded`, `TaskExecutionListener`, or
`buildFinished` usage in harness wiring.
The wrapper must not globally force `--no-configuration-cache`. Configuration
cache compatibility should be earned inside the actual task graph and surfaced
through normal Gradle behavior, not through a second same-worktree isolation
layer. Parallel local safety now comes from linked git worktrees on separate
branches, not from wrapper-managed cache or build-directory rewriting.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Quality Platforms Local Gates](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-gates.md:1)
