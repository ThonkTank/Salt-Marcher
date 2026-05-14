Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-10
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

Runtime wrappers own their invocation defaults for console mode and
wrapper-based failure aggregation. When callers pass those same Gradle built-in
flags again through the wrapper extra-args channel, the runtime wrapper
sanitizes and logs the duplicate wrapper-owned flags instead of forwarding
conflicting built-in options to Gradle. Daemon selection now follows Gradle's
normal behavior unless the caller explicitly passes `--daemon` or
`--no-daemon`.
`tools/gradle/run-observable-gradle.sh` defaults wrapper-based runs to Gradle
`--continue` so long handoff and investigation runs report the full current
failure set. Callers that need first-failure diagnosis MAY pass wrapper option
`--fail-fast`; the wrapper then omits its default `--continue` and rejects a
contradictory extra Gradle `--continue`. This policy is global to the runtime
wrapper and MUST NOT be computed from private task names, bundle member tasks,
topology-task patterns, PMD enforcement patterns, internal rule lists, or
architecture-rule ownership.
Direct raw Gradle use of the same public surfaces does not inherit wrapper
defaults automatically.

### 2. Verification Core

The included build `tools/gradle/build-logic` owns the declarative public
verification surface model.

Mechanically enforced public verification surfaces are:

- documentation surface: `checkDocumentationEnforcement`
- production-code surface: `production-handoff`

`desktop-install` remains a convenience installation entrypoint, not a public
verification surface. Root-owned hygiene and architecture tasks such as
`checkNoDeadCode`, `architectureTest`, and
`:build-harness:architectureCheck` remain internal dependencies behind
`production-handoff` and `check`; they are not focused enforcement bundles and
not a second public API.

The verification core owns the mapping from a public surface to its underlying
Gradle dependencies. Root build scripts MUST consume this core instead of
reconstructing the surface model themselves.
The shared root-owned hygiene owners behind `production-handoff` are declared
in one typed verification lifecycle catalog. `production-handoff` MUST consume
that catalog instead of attaching shared owners from separate plugin or
root-build locations. `check` MAY remain the conventional Gradle build-health
aggregate, but it must route through `production-handoff` instead of
reconstructing a second production-code check graph.
All current harness checks that inspect production source, compiled production
classes, production topology, layer boundaries, role placement, or generic
architecture behavior and are not documentation checks belong behind
`production-handoff` directly. `architectureTest`, the coalesced
`:build-harness:allBuildHarnessTopologyCheck`, and
`:build-harness:architectureCheck` are technical dependencies of that one
production-code surface, not separate public owners or alternate handoff
entries. Layer-surface topology tasks remain focused diagnostic dependencies of
their matching technical layer surfaces.

### 3. Bundle Owners

Each focused enforcement owner contributes one typed bundle descriptor to the
central registry, not one physical `tools/quality/*-enforcement/` package and
not one canonical public entrypoint. Standard bundles are registered centrally
by the verification core from that registry, and the verification core then
groups them behind technical layer surfaces that feed `production-handoff`.
Bundles with small local extras such as stylesheet or FXML checks still
register through the same standard verification-core path instead of through
dedicated root plugins. The View model behind the View layer-surface
dependencies has exactly two technical owners: the closed-world build-harness
topology core and the shared Error Prone View core. The verification core MUST
NOT open a second alternative View structure through extra public role-local
entrypoints, a third shared core, or bundle-specific root-launcher families.
Physical module layout and owner-document splits therefore do not need to map
1:1 to the internal technical owner shape as long as the production-handoff
surface truth and the two-owner View model stay unchanged.

Bundle owners MAY know their private ArchUnit, Error Prone, or build-harness
rule metadata. They MUST NOT depend on shell wrappers. They communicate with the
verification core only through stable typed registry metadata, their internal
bundle-selector tasks, their bundle-local lifecycle tasks, and any explicitly
declared report-only sibling surfaces. Build-harness owner metadata is
coalesced by the verification core before Gradle execution: broad
`production-handoff` runs active topology rules once through one build-harness
task, while technical layer surfaces keep one focused topology task for
diagnosis. Role-local owner splits MUST NOT create one runnable build-harness
JVM scan per owner document.
The public `checkDocumentationEnforcement` surface consumes the root
documentation check plus the coalesced per-surface documentation tasks; those
surface tasks remain private dependencies and MUST NOT become public
documentation proof entrypoints.

Root-owned hygiene gates that are not bundle-specific MUST stay registered in
the verification core itself. They MUST NOT be back-ported into fake
focused bundles just to reuse the bundle registry.

### 4. Rule Implementation

Private rule implementation lives in build-harness, Error Prone rules,
ArchUnit suites, typed Gradle tasks, and the generic documentation-coverage
catalog plus the small set of remaining custom documentation rules.

Rule engines MUST remain ignorant of public surface routing, shell wrappers,
production-handoff flows, and runtime UX concerns.

## Dependency Direction

Allowed dependency direction is strictly inward:

- runtime wrappers -> public verification surface names plus the
  `desktop-install` convenience entrypoint only
- verification core -> `production-handoff`,
  `checkDocumentationEnforcement`, included-build entrypoints, and
  enforcement specs
- bundle owners -> private rule tasks and typed proof wiring
- rule implementation -> concrete source files, compiled classes, documentation
  inventories, and engine-local support code

Forbidden shortcuts:

- runtime wrappers naming private rule tasks or bundle member lists
- `settings.gradle.kts` reconstructing public surface mapping, exception-bundle plugins, or private rule membership
- root build scripts duplicating the public surface mapping already owned by the
  verification core
- build-harness, Error Prone, or ArchUnit code knowing public surface
  names

## Focused Surface Propagation

Focused verification selection is computed from requested production-handoff,
technical layer-surface, or bundle-selector task names during root settings
evaluation by the `saltmarcher.settings` plugin from
`tools/gradle/build-logic-settings`. Technical layer surfaces expand to their
owning bundle ids there, and direct internal bundle-selector task requests are
still translated to the same bundle-id set. Those selector tasks stay
technical implementation seams, not a second public verification API. The
settings plugin also classifies the requested surface into the engines that
the task graph can consume. Focused surfaces MUST NOT include build-harness,
quality-rules, or Error Prone included builds, and MUST NOT register
jQAssistant engine tasks, unless the selected surface or active bundle
descriptors require that engine. The build publishes three focused-selection
facts to the included builds:

- `saltmarcher.repoRootDir`
- `saltmarcher.focusedEnforcementBundleMode`
- `saltmarcher.activeEnforcementBundleIds`

The root build also publishes internal request-scope booleans for
build-harness, quality-rules, quality-rules-errorprone included builds,
jQAssistant task registration, and discovery requests. Those booleans are
graph-pruning facts, not public verification surfaces and not proof-strength
modifiers.

Included builds consume those facts and MUST NOT reconstruct the root repo
state from alternative checkout-relative guessing when the propagated repo root
is available. Project-build plugin code likewise MUST NOT re-derive focused
surface or bundle selection from `StartParameter` task names once the
settings-owned selection facts were published.
Included builds own their technical registration from typed registry metadata
and explicit engine-owned hosts such as build-harness rule classes, Error
Prone checker lists, ArchUnit include patterns, and generic
documentation-coverage spec ids or custom-task kinds. Build-harness
registration groups active bundle metadata by technical layer surface and rule
kind before registering tasks. Harness wiring MUST NOT rely on
bundle-derived filesystem scans, parallel families of tiny launcher mains,
role-local build-harness launcher tasks, or `*-host.gradle.kts` scripts as a
second source of truth for the same metadata.
Shared verification task registration inside `tools/gradle/build-logic` should
flow through typed plugin or extension APIs rather than through untyped
`extra[...]` function exports between precompiled script plugins.
Production-handoff, documentation enforcement, and technical layer surfaces
should register through typed registry providers rather than by matching task
names at configuration time. Bundle-owned verification tasks remain
implementation details behind those surfaces unless a task is explicitly
documented here or in `quality-platforms-local-entrypoints.md` as a public
focused utility gate.
Physical build-harness bundle metadata MUST NOT require historic role-local
task-name fields. Build-harness task names are owned by technical layer
surfaces, except for the coalesced all-topology task and explicit root or
utility gates registered by the verification core.
The remaining root-owned build-harness optional architecture rules are now
registry-driven as well: bundles contribute root `architectureCheck` rule
classes through explicit `buildHarnessArchitectureRuleClasses` metadata
instead of hidden bundle README inventories or hardcoded optional-class tables
in the owning checkers. Documentation metadata uses
`buildHarnessDocumentationRuleClasses` and
`buildHarnessDocumentationCoverageSpecIds` for the coalesced per-surface
documentation tasks behind `checkDocumentationEnforcement`; root
`documentationEnforcementCheck` stays limited to root documentation rules.
Focused build-harness tasks should execute through the generic
`ArchitectureCheckMain` or `DocumentationCheckMain` paths with task-local
rule-class lists or coverage spec ids instead of one bundle-specific Java
launcher per focused task.
`build-harness:processResources` is therefore expected to stay `NO-SOURCE` in
steady-state wrapper runs.
Error Prone checker discovery is likewise centralized: the host
`quality-rules-errorprone` artifact owns the single
`META-INF/services/com.google.errorprone.bugpatterns.BugChecker` registry and
bundle-local service files are not part of the intended model.
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

Request-aware wiring MAY omit unrelated included builds and engine task
registration for a focused invocation. This is configuration-graph pruning
only: if a public surface names a check as part of its proof route, that check
must still be present when that surface is requested.

The verification architecture forbids new `allprojects`, `subprojects`,
`create`, `getByName`, `whenTaskAdded`, `TaskExecutionListener`, or
`buildFinished` usage in harness wiring.
The wrapper must not globally force `--no-configuration-cache`. Configuration
cache compatibility should be earned inside the actual task graph and surfaced
through normal Gradle behavior, not through a second same-worktree isolation
layer. Focused and documentation surfaces may use Gradle configuration-cache
reuse when their task graph is compatible. Broad `production-handoff` must not
claim configuration-cache reuse while third-party tasks such as OpenRewrite's
`rewriteDryRun` prevent cache storage; the uncached graph still remains the
public handoff path. Parallel local safety now comes from linked git worktrees
on separate branches, not from wrapper-managed cache or build-directory
rewriting.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Quality Platforms Local Gates](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-gates.md:1)
- [Quality Platforms Local Entrypoints](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-entrypoints.md:1)
