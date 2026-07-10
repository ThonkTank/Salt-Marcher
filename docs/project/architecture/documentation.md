Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-30
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
- architecture decision records live under `docs/project/decisions/`
- a feature folder may omit document families it does not need, for example a
  generic reusable surface with no write model or persistence truth
- legacy project-wide roots such as `docs/architecture/`, `docs/adr/`,
  `docs/standards/`, and `docs/compat/` are non-canonical and should be
  removed once the owning document exists
- legacy feature-bundle roots such as `docs/features/` are non-canonical and
  should be removed once the owning document exists

If a topic spans several roots, the canonical copy still lives once inside the
owning `docs/<feature>/<type>/` or `docs/project/<type>/` location.

## Placement Classes

Before adding or changing documentation, name the artifact class and its home.

- Canonical project truth lives in `docs/project/<type>/`.
- Canonical feature truth lives in `docs/<feature>/<type>/`.
- Operative agent workflow lives in the owning `SKILL.md`.
- Generated implementation evidence lives under `build/agent-pass-logs/`.
- Review verdicts for CRs and planning artifacts live in coordinator-authored
  generated review artifacts, not in chat or Main summaries.
- Durable structural or governance debt lives in the project-health marker and
  register flow.
- External source evidence lives in the workspace reference mirror, not in
  SaltMarcher docs.

Placement decisions must be reasoned by audience, durability, review owner,
operational use, and whether the content defines truth or records evidence.
When a new artifact class appears, extend this taxonomy or route to a narrower
owner before producing more instances.

## Canonical Document Types

### Project-wide

- `AGENTS.md`
  Project-wide norms only.
- `docs/project/README.md`
  Entry point into project-wide canonical documentation.
- `docs/project/architecture/*.md`
  Project-wide architecture overviews, ADRs, standards, and architecture
  quality requirements, including implementation-documentation,
  project-health, and baseline-admission rules.
- `docs/project/architecture/patterns/*.md`
  Retained cross-feature architecture statements that are still valid after
  doctrine removal. The migration roadmap and ledger own source-area
  simplification while the migration is active.
- `docs/project/decisions/*.md`
  Architecture decision records. ADRs are required for R1 architecture
  changes, dependency major upgrades, gate or tooling changes, and channel or
  release policy changes. Each ADR records one decision.
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
- `references/**`
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
- `references/...` content supports decisions with source evidence; it
  must not define SaltMarcher policy unless a standard, ADR, or feature
  document adopts that interpretation.

## Writing Rules

- Separate current state from target state explicitly.
- Prefer stable behavior and ownership language over method-level callchains.
- Use links instead of restating a topic that already has a source of truth.
- Do not mix glossary, architecture, feature spec, and delivery planning in one
  file.
- Split a document when it mixes scopes or crosses the 400-line soft
  threshold; preserve content and cut scope, never facts.
- Keep one language per document. German and English are both allowed.
- Prefer fixed filenames at the owning root over free-form naming.

## Split Rules

Splitting is required when accumulated additions make one document carry
multiple artifact classes, audiences, review owners, field lists, or operative
workflows. Do not wait for one large edit; many small additions that blur the
owner boundary are the normal split signal.

When splitting, keep the entry document as a router, move detailed procedure to
the narrower owner or skill, preserve meaning, and add links in both
directions. Constantly compressing owner documents to fit new workflow detail
is not the default extension strategy.

## Naming And Linking

Use stable, descriptive kebab-case filenames at the owning root. Documents that
route to another owner must link to that owner. Split owner documents must link
back to their entry document. Generated artifact groups must share a stable
slug and maintain the index/backlink rules owned by the Implementation
Artifacts Standard.

`AGENTS.md` must keep the mandatory route to the owner rules a fresh agent
needs before editing governed docs or workflow artifacts.

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
- The gate mechanically blocks missing `docs/**` metadata, forbidden legacy
  documentation roots, and redirect-only source Markdown.
- Markdown files over 400 lines are reported as a size signal, not a build
  failure. File or link a `doc-split` issue for the split work; never omit,
  compress, or relocate documentation because of size.
- The active size-policy roadmap is
  `docs/project/architecture/doc-size-policy-vision-and-roadmap.md`.
- The retired architecture-enforcement inventory family is not a live
  documentation type. Outcome checks are documented through the migration
  roadmap, verification docs, Gradle task wiring, and the tests or harnesses
  that actually run.
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

Required structural templates live in
[Documentation Templates](documentation-templates.md).

## References

- [Project Documentation Entry Point](docs/project/README.md:1)
- [Architecture Overview](docs/project/architecture/overview.md:1)
- [Documentation Templates](documentation-templates.md)
- [Document Split Protocol](doc-split-protocol.md)
- [Implementation Documentation Standard](docs/project/architecture/implementation-documentation.md:1)
- [Work Logs](docs/project/architecture/work-logs.md:1)
