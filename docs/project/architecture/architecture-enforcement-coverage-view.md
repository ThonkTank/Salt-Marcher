Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-27
Source of Truth: Mechanical, candidate, and review-owned enforcement coverage
for the cockpit view-layer standard.

# View Enforcement Coverage

## Goal

This document maps the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer.md:1)
to the local gates that block violations today, and it separates already-live
checks from target-state rules that still need harness work.

This document is intentionally honest about drift: the documentation target has
now moved ahead of parts of the live harness. The harness-alignment step comes
after this documentation reset.

## Current Mechanical Coverage

| Current mechanically enforced rule | Owner and blocking task | Notes |
| --- | --- | --- |
| View Java sources live only under active roots, `slotcontent` roots, or legacy primitive roots, with package paths matching file paths. | `build-harness:check`, `architectureTest`, `pmdArchitectureMain`, `checkViewArchitecture`, `compileJava` | Live checks still know about legacy `src/view/primitives/**`; target docs no longer treat that root as canonical. |
| Legacy component-local `View/`, `ViewModel/`, `assembly/`, view `api/`, `Model/`, `Controller/`, and `interactor/` topology is forbidden for active target code. | `build-harness:check`, `architectureTest`, `pmdArchitectureMain`, `checkViewArchitecture`, `compileJava` | Still live. |
| `leftbartabs` and `statetabs` roots define exactly one shell-discovered `*Contribution`, exactly one `*Binder`, and exactly one aggregate `*PresentationModel`. | `build-harness:check` | Still live. |
| `dropdowns` roots define exactly one `*Binder`, exactly one aggregate `*PresentationModel`, and zero or one `*Contribution`. | `build-harness:check` | Still live. |
| Shell-facing contribution entrypoints use `*Contribution`, implement `ShellContribution`, and declare `bind(ShellRuntimeContext)`. | `pmdArchitectureMain`, `checkViewArchitecture`, `architectureTest` | Still live. |
| Contributions stay shell-registration adapters and must not do service lookup. | `compileJava`, `checkViewArchitecture` | Still live. |
| Binders may know shell API, root-local roles, reusable `slotcontent`, and allowed domain boundaries. | `compileJava`, `checkViewArchitecture`, `architectureTest` | Live rules exist, but they do not yet encode the new same-root-versus-reusable distinction precisely. |
| `PresentationModel`s may use JavaFX beans/collections and read-side domain `published/**` carriers, but not shell APIs, data, or `*ApplicationService` types. | `compileJava`, `checkViewArchitecture`, `architectureTest` | Still live. |
| `IntentHandler`s and passive Views stay domain-blind. | `compileJava`, `checkViewArchitecture`, `architectureTest` | Still live at the coarse boundary level. |
| Feature View code must publish details through shell-owned inspector/history APIs rather than direct `COCKPIT_DETAILS` slot content. | `compileJava`, shell runtime validation | Still live. |
| Reflective reach-through under `src/view/**` is forbidden. | `compileJava` | Still live. |

## Target-State Coverage Inventory

| View-layer target rule | Status | Current evidence |
| --- | --- | --- |
| `src/view/primitives/**` is no longer a canonical target root; reusable generic components move under `src/view/slotcontent/primitives/**`. | Candidate | Live layout checks still allow legacy primitive roots. |
| Feature-specific one-off components are colocated under their owning `leftbartabs`, `statetabs`, or `dropdowns` root rather than placed in `slotcontent/**`. | Candidate | No current live gate proves reusable versus feature-specific ownership. |
| `slotcontent/**` is reserved for reusable generic components only. | Candidate | Package shape alone is not yet enforced mechanically. |
| Root-local Binder knowledge of root-local `PresentationModel`, `IntentHandler`, and feature-specific `View` roles is same-package only, with a narrow exception for intentional reusable `slotcontent` dependencies. | Candidate | Current live rules allow broad Binder/view relationships but do not yet encode this sharper package rule. |
| `PresentationModel` knows only read-side `published/**` carrier language from the domain side. | Mechanically Enforced | Current Error Prone, ArchUnit, and jQAssistant checks already reject `*ApplicationService` types and published write/query carriers from `PresentationModel`s. |
| `IntentHandler` knows only its co-located `PresentationModel` plus same-surface support values. | Candidate | Current live rules reject broad forbidden dependencies, but do not yet prove exact co-location. |
| Views react through bindings/listeners to observable `PresentationModel` state and do not use imperative command-style `PresentationModel` interaction. | Review-Owned | Current live gates prove coarse dependencies, not reactive style or absence of imperative interaction. |
| Domain work is triggered through Binder-installed callback seams rather than Binder observation of `PresentationModel` request fields. | Review-Owned | Current live rules do not yet prove this runtime style. |
| Feature-specific `*View`, `*PresentationModel`, and `*IntentHandler` classes may extend reusable generic counterparts from `slotcontent/**`. | Candidate | The target inheritance seam is documented, but no current gate encodes it. |
| Map surfaces own exactly one reusable canvas-facing render-state owner under `slotcontent/**`. | Candidate | Current harness does not yet prove the target shared-map ownership model precisely. |

## Review-Owned Rules

- whether a `slotcontent` component is genuinely reusable rather than a hidden
  feature-specific one-off
- whether Binder wiring reflects the intended user workflow without turning the
  Binder into a long-lived feature orchestrator
- whether each interactive surface uses Binder-installed callbacks rather than
  ad-hoc alternate domain-call paths
- whether passive Views use coherent reactive bindings/listeners instead of
  imperative request-style interaction with `PresentationModel`
- whether map surfaces avoid duplicate render-state owners across active roots
  and reusable `slotcontent`
- whether state-pane precedence behaves correctly at runtime beyond the
  mechanically checked slot and shell API shapes

## Non-Blocking Incubator Checks

The repository contains unregistered incubator Error Prone checkers whose
signal is still heuristic. They remain non-blocking until the next harness step
either sharpens them or replaces them with more precise checks.

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer.md:1)
- [View Layer Role Contracts](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer-role-contracts.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1)
