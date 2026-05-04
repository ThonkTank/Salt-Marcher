Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-03
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

`tools/gradle/*` owns invocation isolation, observability, log export, retained
failure artifacts, and user-facing command ergonomics.

Runtime wrappers MAY know canonical verification surface names. They MUST NOT
know bundle member tasks, internal rule lists, or architecture-rule ownership.
`tools/gradle/run-staged-verification.sh` forwards one canonical surface name to
one same-named Gradle lifecycle task. `tools/gradle/run-observable-gradle.sh`
remains a generic runtime wrapper for one Gradle invocation.

Runtime wrappers own their invocation defaults for console mode, daemon mode,
and isolated cache/path routing. When callers pass those same Gradle built-in
flags again through the wrapper extra-args channel, the runtime wrapper
sanitizes and logs the duplicate wrapper-owned flags instead of forwarding
conflicting built-in options to Gradle.
Runtime wrappers also own an early local-socket preflight for Gradle startup
requirements. When the environment cannot open the local IPv4 sockets Gradle
needs for file-lock coordination, the wrapper must fail fast with a runtime
diagnostic instead of letting Gradle die later with an internal wildcard-IP
startup error.
Runtime wrappers also own `--continue` policy for public gate entrypoints so
failure aggregation is an explicit runtime decision instead of a hidden
convention-plugin mutation.
The default staged production handoff remains fail-fast. A broader
continue-on-failure sweep is an explicit caller choice through wrapper
arguments, not an implicit property of the public handoff surface itself.

### 2. Verification Core

The included build `tools/gradle/build-logic` owns the declarative public
verification surface model.

Mechanically enforced public lifecycle surfaces are:

- staged lifecycle surfaces: `production-build`, `quality-hygiene`,
  `architecture`, `view-topology`, `docs`, `metrics-report`,
  `desktop-install`, and `production-handoff`
- focused bundle surfaces: `check*Enforcement`
- focused documentation surface: `checkDocumentationEnforcement`

The verification core owns the mapping from a public surface to its underlying
Gradle dependencies. Root build scripts MUST consume this core instead of
reconstructing the surface model themselves.

### 3. Bundle Owners

Each focused enforcement package under `tools/quality/*-enforcement/` owns one
public `check*Enforcement` lifecycle task through descriptor-owned bundle
metadata. Standard bundles are registered centrally by the verification core
from that metadata; explicit exception bundles now expose `rootPluginId`
metadata and keep their custom wiring in dedicated verification-core plugins
inside `tools/gradle/build-logic`.

Bundle owners MAY know their private ArchUnit, Error Prone, PMD,
jQAssistant, or build-harness tasks. They MUST NOT depend on shell wrappers.
They communicate with the verification core only through stable descriptor
metadata and the one public lifecycle task they expose.

### 4. Rule Implementation

Private rule implementation lives in build-harness, PMD rules, Error Prone
rules, ArchUnit suites, jQAssistant rules, typed Gradle tasks, and
bundle-local documentation checks.

Rule engines MUST remain ignorant of staged surfaces, shell wrappers,
production-handoff flows, and runtime UX concerns.

## Dependency Direction

Allowed dependency direction is strictly inward:

- runtime wrappers -> public verification surface names only
- verification core -> root lifecycle tasks, included-build entrypoints, and
  bundle descriptors
- bundle owners -> private rule tasks and bundle-local proof wiring
- rule implementation -> concrete source files, compiled classes, documentation
  inventories, and engine-local support code

Forbidden shortcuts:

- runtime wrappers naming private rule tasks or bundle member lists
- `settings.gradle.kts` reconstructing public surface mapping, exception-bundle plugins, or private rule membership
- root build scripts duplicating the public surface mapping already owned by the
  verification core
- build-harness, PMD, Error Prone, or jQAssistant code knowing staged surface
  names

## Focused Bundle Propagation

Focused bundle selection is computed from the requested public task set during
root settings evaluation by the `saltmarcher.settings` plugin whose binary
artifact is wrapper-published from `tools/gradle/build-logic-settings` into a
tooling-snapshot-keyed local plugin repository. The earlier build-cache,
project-cache, build-directory, repo-root, and generated-catalog propagation
now comes from the repo-local wrapper init script
`tools/gradle/saltmarcher-isolation.init.gradle.kts`. The build publishes only
three focused-selection facts to the included builds:

- `saltmarcher.repoRootDir`
- `saltmarcher.focusedEnforcementBundleMode`
- `saltmarcher.activeEnforcementBundleIds`

Included builds consume those facts and MUST NOT reconstruct the root repo state
from composite-root-relative path guessing when the propagated repo root is
available. Included builds no longer apply a dedicated settings plugin just to
restate isolation logic.
The runtime isolation layer owns three immutable snapshot artifacts with
separate purposes:

- `.gradle/tooling-plugin-repos/<tooling-key>/maven` for the wrapper-published
  binary plugin artifacts from `build-logic-settings` and `build-logic`
- `.gradle/composite-snapshots/<tooling-key>/` for the real runtime included
  builds only
- `.gradle/enforcement-bundle-catalog-snapshots/<descriptor-key>/` for the
  generated descriptor catalog

Settings evaluation and included builds must consume the plugin repo and bundle
catalog when they are available instead of rebuilding plugin source builds or
rescanning `tools/quality/**/bundle.properties` independently.
`SALTMARCHER_TOOLING_PLUGIN_REPO`, `SALTMARCHER_INCLUDED_BUILD_ROOT`, and
`SALTMARCHER_ENFORCEMENT_BUNDLE_CATALOG` therefore point at different immutable
artifacts with different invalidation keys.
Included builds own their technical registration from descriptor metadata such
as source directories, generated service files, PMD support sources, and
build-harness task main classes. The root build likewise owns standard
`check*Enforcement` task registration from descriptor metadata such as
Error Prone checker lists, ArchUnit task shapes, PMD task shapes, and
jQAssistant task shapes. Harness wiring MUST NOT rely on parallel families of
tiny `*-host.gradle.kts` scripts as a second source of truth for the same
metadata.
The remaining root-owned build-harness optional rules are now descriptor-driven
as well: bundles contribute root `architectureCheck` and
`documentationEnforcementCheck` rule classes through explicit
`buildHarnessArchitectureRuleClasses` and
`buildHarnessDocumentationRuleClasses` metadata instead of hidden
`ServiceLoader` resources or hardcoded optional-class tables in the owning
checkers. `build-harness:processResources` is therefore expected to stay
`NO-SOURCE` in steady-state wrapper runs.
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
repo-root owner or descriptor owner declared in that catalog rather than
reconstructing alternative bundle trees per invocation.
`rootPluginId` is now exception-only metadata for bundles whose wiring still
cannot be expressed by the closed standard bundle model, currently the passive
`View` bundle and the styling-layer bundle.

## Lazy Wiring And Runtime Constraints

Harness wiring MUST use lazy task APIs such as `register`, `named`,
`configureEach`, and `TaskProvider`.

The verification architecture forbids new `allprojects`, `subprojects`,
`create`, `getByName`, `whenTaskAdded`, `TaskExecutionListener`, or
`buildFinished` usage in harness wiring.
The wrapper must not globally force `--no-configuration-cache`. Configuration
cache compatibility should be earned and then exposed only on the public
surfaces that have been proven safe.
Wrapper-based runs now default to `--configuration-cache` only for a narrow
safe subset:

- `help --task <anything>`
- `checkDocumentationEnforcement`
- focused public `check*Enforcement` bundle tasks whose owning descriptor has
  no `rootPluginId` and no `jqassistant.*` metadata

Broad staged surfaces, direct low-level investigation tasks, jQAssistant-backed
bundles, and exception bundles remain explicit opt-in surfaces for
configuration-cache use. Callers may still force either behavior with the
normal Gradle CLI flags; explicit `--configuration-cache` or
`--no-configuration-cache` wins over the wrapper default.
Isolation remains the default wrapper mode. When configuration-cache reuse is
active, the wrapper reuses stable snapshot-backed state roots keyed by staged
surface plus requested work signature instead of sharing one coarse state root
across unrelated focused bundle invocations. The wrapper also serializes only
the uncached first writer for a given shared state root through a repo-local
warmup lock so parallel cold starts do not race on the same configuration
state.
Immutable snapshot roots under `.gradle/tooling-plugin-repos/`,
`.gradle/composite-snapshots/`, and
`.gradle/enforcement-bundle-catalog-snapshots/` are bounded
maintenance-owned caches, not unpruned historical records.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Quality Platforms Local Gates](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-gates.md:1)
