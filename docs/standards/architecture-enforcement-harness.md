Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: Mechanical ownership, execution model, rule-status vocabulary,
and review-only boundary for build-blocking architecture enforcement on active
code surfaces.

# Architecture Enforcement Harness Standard

## Goal

SaltMarcher uses one explicit mechanical enforcement harness for architecture
rules on active code surfaces.

The harness exists to answer four questions without ambiguity:

- which documented rules are mechanically enforced today
- which engine owns each mechanically enforced rule
- through which blocking task a violation breaks local quality
- which documented rules remain intentionally review-owned

This standard defines the harness model itself. It does not replace the layer
standards as the source of architectural intent, and it does not replace
`quality-platforms.md` as the operating guide for tasks and GitHub Actions.

## Scope

The harness covers active code and build-owned resource surfaces:

- `bootstrap/**`
- `shell/**`
- `src/view/**`
- `src/domain/**`
- `src/data/**`
- `resources/**` where a rule is enforced by a build-owned verifier
- Gradle-owned repository policy surfaces that directly guard those code models

This standard does not make documentation or agent-instruction artifacts part
of the blocker model. Those surfaces remain governed by their own standards and
review rules unless a future explicit decision expands the harness scope.
Narrow machine-readable metadata in co-located feature documents may be checked
when an active code-surface rule needs it; for example, the domain context
marker in `src/domain/<feature>/DOMAIN.md` supports the `src/domain/**`
bounded-context model without making general prose documentation part of the
harness.

## Core Principles

- A mechanically enforced rule has exactly one primary mechanical owner.
- Ownership is assigned by rule shape, not by historical placement, temporary
  convenience, or tool availability bias.
- A rule may be documented in a layer standard, but it may only be described as
  mechanically enforced when this standard names both the owner and the
  blocking task.
- A review-only rule is still binding architecture guidance. The absence of a
  gate is not permission to ignore it.
- Blocking rules must stay locally reproducible, deterministic enough for daily
  use, and precise enough that developers can identify the offending surface
  without interpretive archaeology.
- The harness must prefer established owners already present in the repository
  over introducing new engines for marginal gain.
- When a superseding architecture standard outruns an older mechanical check,
  the standard remains the canonical source of truth and the check must be
  documented as migration debt rather than treated as the real architecture
  model.

## Rule Status Vocabulary

Every architecture rule named in a standard belongs to exactly one status:

- `Enforced`
  A primary owner and blocking task are named here, and the rule is expected to
  fail local quality when violated.
- `Candidate`
  The rule is intended for future mechanical ownership, but SaltMarcher has not
  yet accepted a stable blocker for it. Candidate rules are not described as
  already enforced.
- `Review-Only`
  The rule is binding architecture guidance that currently relies on review,
  manual inspection, or targeted design judgment rather than a blocking gate.

Layer standards should use `Verification Notes`, `Enforcement Notes`, or
`Review-Only Rules` sections to summarize the rule status relevant to that
layer, while this document remains the canonical source for the shared status
model.

## Rule Shape Taxonomy

SaltMarcher assigns mechanical ownership by the dominant shape of the rule.

### Repository Topology And Presence Rules

These rules are defined by file placement, allowed buckets, package-path
alignment, or required roots and schema declarations.

### Source Policy Rules

These rules inspect Java source structure, naming, required methods, and
forbidden textual or AST-local usage patterns without full compiler type
resolution across public signatures.

### Compiler-Precise Rules

These rules require javac-resolved types, signature visibility, or precise
referenced-type analysis.

### Bytecode Dependency Rules

These rules are about package-level dependency direction, boundary crossing,
and cycles visible after compilation.

### Graph Topology Rules

These rules are whole-slice or whole-codebase structural constraints that are
most naturally expressed as graph queries rather than per-file checks.

### Gradle-Owned Build And Resource Rules

These rules are repository policy checks expressed most naturally as typed
Gradle verification tasks over files, resources, or packaging metadata.

## Mechanical Owners

### `build-harness`

`build-harness` owns repository-topology and presence rules whose truth is most
directly expressed from the file tree: layout, package-path alignment,
feature-root presence, topological bucket names, persistence schema contracts,
and bans on fixture-based harness selftests. It is not the owner for dependency
direction, compiler-resolved signature checks, or graph-shaped view topology.

### `PMD architecture`

`PMD architecture` owns Java source conventions and forbidden usage patterns:
root entrypoint contracts, required root methods, thin stateless contribution
roots, shell contribution spec selection, inline styling bans, domain source
token bans, application-layer policy-helper naming bans, setter-style domain
mutation bans, data role source-mechanics bans, and legacy wiring type bans
already modeled at source level. It is not the owner for graph topology, full
compiler-signature checks, or package dependency direction.

### `Error Prone`

`Error Prone` owns compiler-precise source rules that need javac-resolved type
information or public-signature awareness: MVVM dependency bans, `ViewModel/`
framework independence, shell API allowlists, public domain-boundary signature
purity, public domain api carrier shape, domain service/factory statelessness,
service-registry registration placement, presentation-state placement,
JavaFX API placement between `View/`, `ViewModel/`, and transitional
composition code, visual-styling exceptions, reflection-bypass bans, and public
API signature leaks from private buckets, including compiler-visible data
adapter collaborator boundaries. It is not the owner for repository topology or
broad package graph rules.

### `ArchUnit`

`ArchUnit` owns bytecode-visible dependency direction, foreign-boundary access,
and cycle rules: top-level layer direction, domain and data foreign-feature
access constraints, and cycle freedom across domain features, view components,
data features, and shell packages. It is not the owner for file-tree topology,
root method contracts, or compiler-precise public-signature bans.

### `jQAssistant`

`jQAssistant` owns graph-shaped architecture rules where the current enforced
view model spans buckets and files: declarative MVVM bucket topology,
view-component root count, declared Shared View Component shape, and
graph-shaped cross-component boundaries. It is not the owner for general domain
or data topology, nor for compiler-precise signature and framework checks that
produce better diagnostics inside `compileJava`.

### Gradle-Owned Verification Tasks

Typed Gradle verification tasks in the build logic own repository-wide build
and resource policies that are neither language-level architecture rules nor
external platform reports: centralized stylesheet placement, style-class
selector definitions, compiled-artifact bans, and packaging resources.

## Implementation Model

The mechanical owner model is also the implementation boundary for future
checks. A new rule must be classified by rule shape before code is written, and
the implementation must land in the owning engine rather than in the most
convenient existing file.

`build-harness` uses a small internal rule API for repository-topology and
presence rules: `ArchitectureChecker` orchestrates rule groups,
`ArchitectureContext` provides repository facts, and concrete rule groups emit
violations through `ViolationSink`. New `build-harness` rules should be added
to the narrow rule group that owns the affected surface, or to a new named rule
group when the existing groups would become mixed-purpose.

The Gradle convention plugin remains the public quality-gate wiring surface,
but its implementation is organized by policy area rather than by historical
task-registration order. Keep invocation policy, compiler gates, graph gates,
metric/report gates, resource-policy gates, and the central aggregate visually
separate when extending the build logic.

## Execution Model

The harness uses existing blocking entrypoints. It does not define a new
mandatory top-level gate name.

Invocations that request any documented local quality or architecture gate
enable Gradle continue-on-failure behavior. A run still fails when any blocking
check fails, but Gradle must execute all independent checks that are not blocked
by failed task dependencies before printing the combined failure summary. The
root `build` task follows the same behavior through Gradle's standard `build ->
check` lifecycle.

The jQAssistant view-architecture entrypoint uses an invocation-local temporary
graph-store directory. Focused compile verification does not run the
jQAssistant view-topology blocker.

Architecture gate diagnostics must come from the current invocation. The
compiler-integrated Error Prone architecture checks, ArchUnit architecture
tests, PMD architecture checks, jQAssistant analysis, and build-harness
architecture checks must not report success by being skipped as `UP-TO-DATE` or
restored from Gradle's build cache.

This does not override real task dependencies. For example, bytecode- or
test-output-dependent checks may still be skipped after a failed compile because
their prerequisite output was not produced.

### First Blocking Entry Point

- `./gradlew compileJava`
  This is the earliest blocking entrypoint for compiler-resolved view, domain,
  and data architecture. It runs `Error Prone`.

### Explicit View-Architecture Entry Point

- `./gradlew checkViewArchitecture`
  This is the explicit reporting entrypoint for the current graph-shaped
  view-topology blocker.

### Explicit Non-View Architecture Aggregate

- `./gradlew checkArchitecture`
  This aggregates:
  - `architectureTest`
  - `pmdArchitectureMain`
  - `:build-harness:check`

### Local Full Blocker

- `./gradlew check`
  This is the local blocking aggregate for the architecture harness plus
  adjacent blocking quality gates wired into the repository. It runs the
  current `jQAssistant` view-topology blocker through
  `checkViewArchitecture`.

### Explicit Gradle-Owned Resource Entry Points

- `./gradlew checkCentralizedStylesheets`
  This is the primary blocking entrypoint for centralized stylesheet placement.
- `./gradlew checkDefinedStyleClassSelectors`
  This is the primary blocking entrypoint for Java-authored style classes that
  must resolve to centralized selectors in `resources/*.css`.
- `./gradlew checkNoCompiledArtifactsInSource`
  This is the primary blocking entrypoint for compiled-artifact bans in active
  source roots.
- `./gradlew checkDesktopPackagingInputs`
  This is the primary blocking entrypoint for required desktop packaging
  resources and metadata.

`check` is broader than the architecture harness. It also runs quality gates
such as duplicate detection or complexity verification that are important for
local blocking quality but are not the primary owner of a layer-model rule.

## Coverage Matrix By Surface

The per-surface rule-status matrix lives in the
[Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1).
Layer-specific enforcement details, including concrete `build-harness`, PMD,
ArchUnit, Error Prone, and Gradle-owned task rule IDs for the data, domain,
view, system, passive workbench shell, shell discovery, styling, and repository
surfaces, are recorded there rather than duplicated in this owner-model
document.

This document remains the source of truth for the shared owner model,
rule-status vocabulary, execution model, diagnostic contract, lifecycle, and
review-only boundary.

## Diagnostic Contract

Every harness owner should emit diagnostics that make the violated contract
actionable.

The preferred diagnostic shape is:

- stable rule identifier or rule name
- offending source or repository location
- short statement of the expected architectural boundary
- short statement of the actual violating condition
- enough wording to guide a first repair without re-reading multiple standards

Where the engine allows it, diagnostics should use the canonical architecture
terms already present in the layer standards rather than tool-internal jargon.

## Rule Lifecycle

When SaltMarcher promotes a documented rule into the harness, the change should
follow one explicit lifecycle:

1. define the rule in the owning architecture standard
2. classify it as `Review-Only` or `Candidate` until a stable owner exists
3. identify the dominant rule shape
4. assign exactly one primary mechanical owner
5. wire the rule into an existing blocking task, or explicitly document why a
   new task is necessary
6. update this standard and the owning layer standard in the same change
7. only then describe the rule as `Enforced`

SaltMarcher should not describe aspirational future checks as if they already
block local quality.

## Review-Only Boundary

The harness intentionally does not attempt to mechanize every architectural
judgment.

Rules stay review-owned when one of the following is true:

- the rule depends on deep semantic intent rather than stable structural shape
- the likely false-positive cost is too high for a daily blocker
- the existing engines can express the rule only by obscuring the real
  violation behind brittle heuristics
- the rule is better treated as design review than as repository policy

When a layer standard names review-owned rules, that is a governance boundary,
not a backlog omission.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/data-layer.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/styling.md:1)
- [ADR 003: Architecture Rule Ownership By Enforcement Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/003-architecture-rule-ownership.md:1)
- [ADR 006: Layered View-Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/006-jqassistant-owns-view-architecture-enforcement.md:1)
- [ADR 014: Strict Domain-Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/014-strict-domain-layer-enforcement.md:1)
- [ADR 016: Architecture Enforcement Operating Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/016-architecture-enforcement-operating-model.md:1)
