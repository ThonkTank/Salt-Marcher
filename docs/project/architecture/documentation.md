Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Documentation taxonomy, required metadata, and review rules
for all project documentation outside `AGENTS.md`.

# Documentation Standard

## Goal

SaltMarcher documentation must stay small, explicit, and trustworthy. Each
document has one purpose, one audience, and one ownership boundary.

## Required Metadata

Every active document outside `AGENTS.md` must start with:

- `Status`
- `Owner`
- `Last Reviewed`
- `Source of Truth`

Allowed `Status` values:

- `Draft`: target state, proposal, or unstable design
- `Active`: current maintained documentation
- `Deprecated`: superseded or retained only for compatibility

## Placement Rule

Canonical project documentation lives under `docs/`.

- cross-feature or repo-wide canonical truth goes under `docs/project/<type>/`
- feature-owned canonical truth goes under `docs/<feature>/<type>/`
- behavior and UI truth go under `docs/<feature>/requirements/`
- persistence and storage rules go under `docs/<feature>/contract/`
- domain truth goes under `docs/<feature>/domain/`
- feature architecture goes under `docs/<feature>/architecture/`
- temporary rollout notes go under `docs/<feature>/delivery/`
- qualification and traceability truth go under `docs/<feature>/verification/`
- project-wide overviews, decisions, and reusable rules live under the
  matching `docs/project/<type>/` family
- a feature folder may omit document families it does not need, for example a
  generic reusable surface with no write model or persistence truth
- legacy project-wide roots such as `docs/architecture/`, `docs/adr/`,
  `docs/standards/`, and `docs/compat/` are non-canonical and should be
  removed once the owning document exists
- legacy feature-bundle roots such as `docs/features/` are non-canonical and
  should be removed once the owning document exists

If a topic spans several roots, the canonical copy still lives once inside the
owning `docs/<feature>/<type>/` or `docs/project/<type>/` location.

## Canonical Document Types

### Project-wide

- `AGENTS.md`
  Project-wide norms only.
- `docs/project/README.md`
  Entry point into project-wide canonical documentation.
- `docs/project/architecture/*.md`
  Project-wide architecture overviews, ADRs, standards, and architecture
  quality requirements.
- `docs/project/architecture/patterns/*.md`
  Canonical cross-feature layer and layering owner documents.
- `docs/project/architecture/enforcement/*.md`
  Canonical mechanical architecture enforcement documents for the matching
  layer or role owner.
- `docs/project/requirements/*.md`
  Project-wide behavioral obligations when the repository owns them centrally.
- `docs/project/contract/*.md`
  Cross-feature or repo-wide boundary and persistence contracts.
- `docs/project/domain/*.md`
  Shared domain truth when a concept is not owned by one feature alone.
- `docs/project/delivery/*.md`
  Project-wide rollout, migration, or parity sequencing.
- `docs/project/verification/*.md`
  Project-wide qualification, traceability, and proof ownership.
- `/home/aaron/Schreibtisch/projects/references/**`
  Local-only source mirrors and readable extracts governed by the
  Source References Standard, not canonical SaltMarcher policy by themselves.

### Feature-specific

- `docs/<feature>/README.md`
  Entry point for one feature documentation set.
- `docs/<feature>/requirements/*.md`
  Feature behavior, UI-visible states, user flows, and acceptance criteria.
- `docs/<feature>/architecture/*.md`
  Feature-specific architecture boundaries, owners, and decisions.
- `docs/<feature>/contract/*.md`
  Feature boundary, API, message, schema, and persistence contracts.
- `docs/<feature>/domain/*.md`
  Canonical domain truth, ownership, invariants, and derived state.
- `docs/<feature>/delivery/*.md`
  Temporary feature rollout notes and migration risks.
- `docs/<feature>/verification/*.md`
  Feature qualification, traceability, and proof routes.
- not every feature folder must use every family above; use only the canonical
  document types the feature actually owns

## Scope Rules

- `AGENTS.md` must not hold feature-specific designs.
- Architecture standards must not describe one feature's product behavior.
- Project-wide docs under `docs/project/**` must not become a dumping ground
  for feature truth.
- Feature documents must not define project-wide rules.
- ADRs, when used, must record one decision only.
- Delivery documents are temporary and must not become canonical architecture
  sources.
- `/home/aaron/Schreibtisch/projects/references/...` content supports decisions with source evidence; it
  must not define SaltMarcher policy unless a standard, ADR, or feature
  document adopts that interpretation.

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

## Enforcement Notes

Documentation governance is broader than compile-time enforcement.

- The dedicated documentation gate is
  `./gradlew checkDocumentationEnforcement --console=plain`.
- That gate owns focused structural enforcement for governed documentation
  surfaces such as `docs/**`, `src/domain/**/DOMAIN.md`, repo-local
  `AGENTS.md`, and Markdown documentation under `tools/quality/**`.
- Mechanical checks may lint structure when a dedicated docs gate exists.
- Mixed implementation changes that also touch non-documentation code, Gradle,
  or build sources still follow the broader verification path owned by
  `AGENTS.md` and the quality-platform standards.
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

### Verification Template

Use:

- verified sources
- verification methods
- pass or fail criteria
- traceability or proof mapping
- known gaps or review-owned proof
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

## References

- [Project Documentation Entry Point](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/README.md:1)
- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
