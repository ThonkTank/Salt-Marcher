Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Mechanical ownership, rule-status vocabulary, and entrypoint
model for build-blocking architecture enforcement on active code surfaces.

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

- a mechanically enforced rule has exactly one primary mechanical owner
- ownership is assigned by rule shape, not by historical placement, temporary
  convenience, or tool-availability bias
- a rule may be documented in a layer standard, but it may only be described as
  mechanically enforced when this standard names both the owner and the
  blocking task
- a review-only rule is still binding architecture guidance; the absence of a
  gate is not permission to ignore it
- blocking rules must stay locally reproducible, deterministic enough for daily
  use, and precise enough that developers can identify the offending surface
  without interpretive archaeology
- the harness must prefer established owners already present in the repository
  over introducing new engines for marginal gain
- when a superseding architecture standard outruns an older mechanical check,
  the standard remains the canonical source of truth and the check must be
  documented as migration debt rather than treated as the real architecture
  model
- the harness enforces stable physical shapes, dependency boundaries, and
  signature contracts; it must not turn optional domain roles or data adapter
  implementation patterns into required concept inventories
- rule identifiers may remain stable across vocabulary resets, but diagnostics
  and coverage documents must use the canonical terms from the current layer
  standards

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

## Detailed Harness Subdocuments

- [Architecture Enforcement Harness Rule Shapes](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness-rule-shapes.md:1)
  defines the rule-shape taxonomy that decides which owner class a new
  mechanical rule belongs to.
- [Architecture Enforcement Harness Operations](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness-operations.md:1)
  defines the detailed mechanical owners, implementation model, execution
  model, blocking entrypoints, diagnostic contract, lifecycle, and review-only
  boundary.

## References

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage.md:1)
- [Architecture Enforcement Harness Rule Shapes](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness-rule-shapes.md:1)
- [Architecture Enforcement Harness Operations](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness-operations.md:1)
