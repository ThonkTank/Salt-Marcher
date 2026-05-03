Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-02
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
public `check*Enforcement` lifecycle task through its descriptor-owned root-host
wiring and any colocated bundle metadata.

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
- `settings.gradle.kts` reconstructing public surface mapping, bundle host scripts, or private rule membership
- root build scripts duplicating the public surface mapping already owned by the
  verification core
- build-harness, PMD, Error Prone, or jQAssistant code knowing staged surface
  names

## Focused Bundle Propagation

Focused bundle selection is computed from the requested public task set during
settings evaluation and then re-exposed through the shared bundle-metadata
script under `tools/quality/enforcement-bundles.gradle.kts`. The build
publishes only three propagated facts to the included builds:

- `saltmarcher.repoRootDir`
- `saltmarcher.focusedEnforcementBundleMode`
- `saltmarcher.activeEnforcementBundleIds`

Included builds consume those facts and MUST NOT reconstruct the root repo state
from composite-root-relative path guessing when the propagated repo root is
available.

## Lazy Wiring And Runtime Constraints

Harness wiring MUST use lazy task APIs such as `register`, `named`,
`configureEach`, and `TaskProvider`.

The verification architecture forbids new `allprojects`, `subprojects`,
`create`, `getByName`, `whenTaskAdded`, `TaskExecutionListener`, or
`buildFinished` usage in harness wiring.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Quality Platforms Local Gates](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-gates.md:1)
