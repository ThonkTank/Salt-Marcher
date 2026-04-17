# SaltMarcher Working Constitution

This file defines the project-wide documentation and architecture governance for
SaltMarcher. It is intentionally short. It does not hold feature-specific
specifications, long-form target designs, or implementation plans.

## Purpose

SaltMarcher keeps documentation by document type, not by convenience. Each
topic has one canonical home, and every other document may only summarize or
link to it.

Use the documentation tree in this order:

1. `AGENTS.md` for project-wide norms and documentation governance.
2. `docs/architecture/overview.md` for the system shape and major boundaries.
3. `docs/architecture/standards/*.md` for reusable standards.
4. `docs/adr/*.md` for individual architecture decisions.
5. `docs/features/<feature>/*.md` for feature-specific behavior and design.

## Core Terms

- `Feature`: a project-local vertical slice with view, domain, and data code.
- `Feature API`: the public backend boundary of a feature below the view layer.
- `Shell Contribution`: a feature entrypoint that registers UI content with the
  passive shell.
- `Persistence Contribution`: a feature entrypoint that registers exported
  persistence capabilities.
- `Canonical Truth`: the authored state that is allowed to persist.
- `Derived State`: any state rebuilt deterministically from canonical truth.
- `Source of Truth`: the single document that is authoritative for a topic.

## Hard Rules

- `AGENTS.md` contains project-wide rules only.
- System-wide architecture decisions are recorded as ADRs under `docs/adr/`.
- Feature requirements and designs live under `docs/features/<feature>/`.
- Every non-ADR document outside `AGENTS.md` must declare `Status`, `Owner`,
  `Last Reviewed`, and `Source of Truth`.
- Documents must clearly distinguish current state from target state.
- A topic may be summarized in multiple places, but it may be defined in only
  one place.
- Documents above roughly 350 lines must be split by purpose.
- Hypothetical method-level callchains do not belong in product or UI specs.
- A change that introduces or alters behavior, architecture, or ownership must
  update the corresponding documentation in the same change.

## Document Types

- `docs/architecture/overview.md`
  Current system-wide architecture summary.
- `docs/architecture/standards/*.md`
  Reusable standards such as documentation rules, repository structure, shell
  registration, and quality tooling.
- `docs/adr/NNN-*.md`
  One architecture decision per file.
- `docs/features/<feature>/overview.md`
  Entry point for a feature's documentation set.
- `docs/features/<feature>/spec.md`
  Product and behavior specification.
- `docs/features/<feature>/domain.md`
  Canonical domain model, ownership, invariants, and derived-state rules.
- `docs/features/<feature>/ui.md`
  UI structure, interaction model, and user-visible states.
- `docs/features/<feature>/delivery.md`
  Temporary implementation plan, risks, and phased rollout notes.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/documentation.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [Shell And Discovery Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1)
- [ADR 001: Documentation Governance](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/001-documentation-governance.md:1)
- [ADR 002: Passive Shell And Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)
