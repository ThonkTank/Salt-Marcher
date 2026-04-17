Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: Documentation taxonomy, required metadata, and review rules for
all project documentation outside `AGENTS.md`.

# Documentation Standard

## Goal

SaltMarcher documentation must stay small, explicit, and trustworthy. Each
document has one purpose, one audience, and one ownership boundary.

## Required Metadata

Every document outside `AGENTS.md` and `docs/adr/` must start with:

- `Status`
- `Owner`
- `Last Reviewed`
- `Source of Truth`

Allowed `Status` values:

- `Draft`: target state, proposal, or unstable design
- `Active`: current maintained documentation
- `Deprecated`: superseded or retained only for compatibility

## Canonical Document Types

### Project-wide

- `AGENTS.md`
  Project-wide norms only.
- `docs/architecture/overview.md`
  System summary and entry point into architecture docs.
- `docs/architecture/standards/*.md`
  Reusable standards. One topic per file.
- `docs/adr/NNN-*.md`
  One architecture decision per file.

### Feature-specific

- `docs/features/<feature>/overview.md`
  Map of the feature documentation set.
- `docs/features/<feature>/spec.md`
  Behavior, user flows, and acceptance criteria.
- `docs/features/<feature>/domain.md`
  Canonical truth, ownership, invariants, and derived state.
- `docs/features/<feature>/ui.md`
  UI composition, interactions, and user-visible states.
- `docs/features/<feature>/delivery.md`
  Temporary implementation notes, phasing, and risks.

Additional feature documents are allowed when the topic is distinct and stable,
for example `persistence.md` or `testing.md`.

## Scope Rules

- `AGENTS.md` must not hold feature-specific designs.
- Architecture standards must not describe one feature's product behavior.
- Feature documents must not define project-wide rules.
- ADRs must record one decision only.
- Delivery documents are temporary and must not become canonical architecture
  sources.

## Writing Rules

- Separate current state from target state explicitly.
- Prefer stable behavior and ownership language over method-level callchains.
- Use links instead of restating a topic that already has a source of truth.
- Do not mix glossary, architecture, feature spec, and delivery planning in one
  file.
- Split a document once it becomes hard to scan or exceeds roughly 350 lines.
- Keep one language per document. German and English are both allowed.

## Duplication Rules

- A topic may be summarized in several places.
- A topic may be defined in only one place.
- Summaries must link to the canonical document.
- If two documents disagree, the one marked as `Source of Truth` for that topic
  wins and the other must be corrected.

## Review Rules

Any PR that changes behavior, ownership, architecture, or long-lived workflow
must update documentation in the same change.

Reviewers must check:

- Is the document type correct?
- Does the document declare the right status?
- Does another document already own this topic?
- Does the change introduce conflicting truth?
- Are links and references updated?

## Required Templates

### Architecture Standard Template

Use:

- purpose
- rules
- allowed exceptions
- verification or enforcement notes
- references

### Feature Spec Template

Use:

- goal
- non-goals
- primary user flows
- acceptance criteria
- open questions or deferred concerns

### Domain Template

Use:

- canonical truth
- derived state
- aggregates or core objects
- ownership boundaries
- invariants
- references

### ADR Template

Use:

- title
- status
- date
- context
- decision
- consequences
- alternatives considered
- related documents
