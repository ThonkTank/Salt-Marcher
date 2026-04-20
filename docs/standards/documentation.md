Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
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

## Placement Rule

Feature documentation is co-located by default. Put the canonical document at
the nearest stable code root that owns the topic.

- feature-wide meaning and behavior go under `src/domain/<feature>/`
- UI behavior for a feature tab, runtime state tab, dropdown, detail entry, or
  reusable slotcontent unit goes under the owning `src/view/featuretabs/`,
  `src/view/runtimetabs/`, `src/view/dropdowns/`, or
  `src/view/slotcontent/` surface
- persistence and storage rules go under `src/data/<feature>/`
- system-wide architecture stays centralized under `docs/`

If a topic spans multiple feature roots, the canonical copy lives at the lowest
common owner, usually `src/domain/<feature>/`, and sibling documents link to it
instead of restating it.

## Canonical Document Types

### Project-wide

- `AGENTS.md`
  Project-wide norms only.
- `docs/architecture/overview.md`
  System summary and entry point into architecture docs.
- `docs/standards/*.md`
  Reusable standards. One topic per file.
- `docs/adr/NNN-*.md`
  One architecture decision per file.
- `docs/compat/**`
  Deprecated compatibility stubs that point to canonical documents elsewhere.

### Feature-specific

- `src/domain/<feature>/README.md`
  Map of the feature documentation set.
- `src/domain/<feature>/SPEC.md`
  Behavior, user flows, and acceptance criteria.
- `src/domain/<feature>/DOMAIN.md`
  Canonical truth, ownership, invariants, and derived state.
- `src/view/featuretabs/<tab>/<topic>.md`,
  `src/view/runtimetabs/<state>/<topic>.md`,
  `src/view/dropdowns/<dropdown>/<topic>.md`, or
  `src/view/slotcontent/<slot>/<entry>/<topic>.md`
  UI composition, interactions, and user-visible states for one tab, runtime
  state-panel tab, dropdown window, detail entry, or reusable slotcontent unit.
- `src/data/<feature>/PERSISTENCE.md`
  Persistence contracts, schema ownership, migration rules, and exported
  capabilities.
- `src/domain/<feature>/DELIVERY.md`
  Temporary implementation notes, phasing, and risks.

Additional feature documents are allowed when the topic is distinct and stable,
for example `TESTING.md`, but fixed filenames above are preferred.

## Scope Rules

- `AGENTS.md` must not hold feature-specific designs.
- Architecture standards must not describe one feature's product behavior.
- Feature documents must not define project-wide rules.
- ADRs must record one decision only.
- Delivery documents are temporary and must not become canonical architecture
  sources.
- Central `docs/compat/...` content may exist only as compatibility stubs and
  must not remain canonical.

## Writing Rules

- Separate current state from target state explicitly.
- Prefer stable behavior and ownership language over method-level callchains.
- Use links instead of restating a topic that already has a source of truth.
- Do not mix glossary, architecture, feature spec, and delivery planning in one
  file.
- Split a document once it becomes hard to scan or exceeds roughly 350 lines.
- Keep one language per document. German and English are both allowed.
- Prefer fixed filenames at the owning root over free-form naming.

## Duplication Rules

- A topic may be summarized in several places.
- A topic may be defined in only one place.
- Summaries must link to the canonical document.
- If two documents disagree, the one marked as `Source of Truth` for that topic
  wins and the other must be corrected.
- Compatibility stubs must declare `Deprecated` and point at the co-located
  canonical document.

## Enforcement Notes

Documentation governance is broader than compile-time enforcement.

- Mechanical checks may lint structure when a dedicated docs gate exists.
- Canonical ownership disputes, conflicting truth, and same-change update
  expectations remain review responsibilities unless a specific check is named
  elsewhere.

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

- the write model and the source of domain decisions
- aggregate roots or core objects, including mutation entrypoints when relevant
- derived state
- domain-owned ports and external dependency boundaries
- ownership boundaries
- invariants
- explicit current-state versus target-state framing when implementation lags
- references

### UI Template

Use:

- component purpose
- visible surfaces
- interactions
- visible states
- shortcuts or inspector behavior when relevant

### Persistence Template

Use:

- root contract
- schema ownership
- migration or stability rules
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
