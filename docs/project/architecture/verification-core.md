Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Verification-surface ownership and public verification-entry
architecture for SaltMarcher build logic.

# Verification Core Architecture

## Purpose

This document defines the split between runtime wrappers, public Gradle
verification surfaces, and private rule implementation. It reflects the M0
doctrine-removal state: public proof is expressed through retained outcome
surfaces, not through role-family enforcement inventories.

## Public Surfaces

The verification core owns two public verification surfaces:

- `production-handoff`
- `focused-handoff`

`desktop-install` remains a convenience installation entrypoint after a green
handoff, not a public verification surface.

## Layer Responsibilities

### Runtime Wrappers

`tools/gradle/run-staged-verification.sh` and
`tools/gradle/run-observable-gradle.sh` own command ergonomics, observable logs,
project-health preflight routing, elapsed-time readback, task-count readback,
and configuration-cache readback.

Wrappers may know public surface names. They must not choose private rule
classes, private Gradle dependencies, or proof strength from package names.

### Verification Core

`tools/gradle/build-logic` owns the public Gradle task graph:

- production handoff through compile integrity, retained structure checks, and
  hygiene gates
- focused handoff through validated focused path and area properties

`check` may depend on `production-handoff`, but root build scripts must not
reconstruct a second production-code verification graph.

### Rule Implementation

Private implementation lives in build-harness rules, ArchUnit tests, Error
Prone checks, PMD configuration, SpotBugs configuration, typed Gradle tasks,
and behavior harnesses. Private implementation code must not know shell-wrapper
routing or public proof policy.

## Retained Structure Checks

After the form-enforcement removal, retained structure checks include package
cycles, layer dependency direction, build-harness source-layout basics,
behavior-harness registration/map consistency, and quality-hygiene gates.
Documentation proof is owner-named, not a standing public Gradle surface.
Role-family topology and naming-taxonomy checks are not public verification
truth.

## Focused Surface Rules

Focused paths must be repo-relative existing directories with selected-surface
inputs. Empty, missing, file-only, glob-shaped, or mismatched scopes fail
instead of producing a green no-op run.

Focused graph pruning may reduce unrelated task registration, but proof claims
must still report the selected path, area, and command result. A focused run
does not replace broad `production-handoff` where broad production handoff is
required.

## References

- [Quality Platforms Standard](../verification/quality-platforms.md)
- [Quality Platforms Local Entrypoints](../verification/quality-platforms-local-entrypoints.md)
- [Architecture Migration Roadmap](architecture-migration-roadmap.md)
- [Migration Ledger](migration-ledger.md)
