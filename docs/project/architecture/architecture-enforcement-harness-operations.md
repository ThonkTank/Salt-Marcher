Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Detailed owner model, implementation model, execution model,
and diagnostic contract for the architecture enforcement harness.

# Architecture Enforcement Harness Operations

## Purpose

This subordinate standard defines how SaltMarcher operates the architecture
enforcement harness after a rule has been classified by shape.

The umbrella harness standard remains the source of truth for the overall
harness purpose, scope, core principles, and shared rule-status vocabulary.

## Mechanical Owners

### `build-harness`

`build-harness` owns repository-topology and presence rules whose truth is most
directly expressed from the file tree: layout, package-path alignment,
feature-root presence, topological bucket names, view-root composition,
persistence schema contracts, and bans on fixture-based harness selftests. It
is not the owner for dependency direction, compiler-resolved signature checks,
semantic role richness, or graph-shaped view topology.

### `PMD architecture`

`PMD architecture` owns Java source conventions and forbidden usage patterns:
root entrypoint contracts, required root methods, thin stateless contribution
roots, shell contribution spec selection, inline styling bans, domain source
token bans, application-layer policy-helper naming bans, setter-style domain
mutation bans, data composition/port-adapter concrete-source bans, and legacy
wiring type bans already modeled at source level. It is not the owner for graph
topology, full compiler-signature checks, semantic adapter adequacy, or package
dependency direction.

### `Error Prone`

`Error Prone` owns compiler-precise source rules that need javac-resolved type
information or public-signature awareness: view-layer dependency bans, shell
API allowlists, public domain-boundary signature purity, domain-wide forbidden
infrastructure dependency references, public domain published-carrier shape,
domain role-shape checks, service-registry registration placement, data-root
service export shape, presentation-state placement, JavaFX API placement
between contributions, Binders, `PresentationModel`-era or legacy
`*ViewModel`-era surfaces, passive views, reusable slotcontent, and
transitional legacy view code, visual-styling exceptions, reflection-bypass
bans, and public API signature leaks from private buckets, including
compiler-visible data port-adapter and source-adapter collaborator boundaries.
It is not the owner for repository topology or broad package graph rules.

### `ArchUnit`

`ArchUnit` owns bytecode-visible dependency direction, foreign-boundary access,
and cycle rules: top-level layer direction, domain and data foreign-feature
access constraints, data gateway/domain independence, and cycle freedom across
domain features, view components, data features, and shell packages. It is not
the owner for file-tree topology, root method contracts, or compiler-precise
public-signature bans.

### `jQAssistant`

`jQAssistant` owns graph-shaped architecture rules where the current enforced
view topology spans buckets and files: contribution-root topology, co-located
presentation-role placement, one passive view per view file, and graph-shaped
cross-component boundaries. The current concrete rules still mostly target
legacy `*ViewModel` names until the harness migrates. It is not the owner for
general domain or data topology, nor for compiler-precise signature and
framework checks that produce better diagnostics inside `compileJava`.

### Gradle-Owned Verification Tasks

Typed Gradle verification tasks in the build logic own repository-wide build
and resource policies that are neither language-level architecture rules nor
external platform reports: centralized stylesheet placement, style-class
selector definitions, FXML view-resource placement and script bans,
compiled-artifact bans, and packaging resources.

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
root `build` task follows the same behavior through Gradle's standard
`build -> check` lifecycle.

The jQAssistant view-architecture entrypoint uses an invocation-local temporary
graph-store directory. Focused compile verification does not run the
jQAssistant view-topology blocker.

Architecture gate diagnostics must come from the current invocation. The
compiler-integrated Error Prone architecture checks, ArchUnit architecture
tests, PMD architecture checks, jQAssistant analysis, and build-harness
architecture checks must not report success by being skipped as `UP-TO-DATE` or
restored from Gradle's build cache.

Architecture gates must also prove that their target surface was actually
loaded. A bytecode or graph gate that checks zero target classes, nodes, or
relationships is a defective gate configuration and must fail through a focused
import or scan smoke check instead of being counted as successful enforcement.

This does not override real task dependencies. For example, bytecode- or
test-output-dependent checks may still be skipped after a failed compile
because their prerequisite output was not produced.

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
  This is the primary blocking entrypoint for keeping active application style
  files centralized in `resources/salt-marcher.css`.
- `./gradlew checkDefinedStyleClassSelectors`
  This is the primary blocking entrypoint for Java-authored style classes that
  must resolve to centralized selectors in `resources/salt-marcher.css`.
- `./gradlew checkViewFxmlResources`
  This is the primary blocking entrypoint for optional FXML view-resource
  placement, controller package ownership, and inline FXML script bans.
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
[Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage.md:1).
Layer-specific enforcement details, including concrete `build-harness`, PMD,
ArchUnit, Error Prone, and Gradle-owned task rule ids for the data, domain,
view, system, passive workbench shell, shell discovery, styling, and
repository surfaces, are recorded there rather than duplicated in this
owner-model document.

This document remains the source of truth for the shared owner model,
execution model, diagnostic contract, lifecycle, and review-only boundary.

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
Stable rule ids are allowed to retain historical names when renaming them would
create avoidable build-logic churn, but their summaries and user-facing
messages should explain the current model.

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

- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1)
- [Architecture Enforcement Harness Rule Shapes](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness-rule-shapes.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
