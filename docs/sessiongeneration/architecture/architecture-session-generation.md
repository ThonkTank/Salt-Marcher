Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Session Generation feature seams, pipeline, dependency
direction, and architecture rationale.

# Session Generation Architecture

## Entity, Stakeholders, And Concerns

This specification describes the `sessiongeneration` feature. It serves
maintainers of the deterministic engine, reference catalog, persistence, and
Session Planner integration. It answers how generation stays reproducible,
diagnosable, non-blocking, UI-free, and isolated from foreign feature truth.

## Target Topology

```text
features/sessiongeneration/api/
features/sessiongeneration/domain/
features/sessiongeneration/application/
features/sessiongeneration/adapter/sqlite/
features/sessiongeneration/SessionGenerationFeature
resources/sessiongeneration/
```

The feature has no JavaFX adapter and contributes no shell surface.
`SessionGenerationFeature` receives platform execution, persistence, and local
diagnostics capabilities from `app` and publishes one `SessionGenerationApi`.
`app` supplies that API explicitly to Session Planner.

## Runtime View

```text
Session Planner JavaFX
  -> Session Planner application
  -> SessionGenerationApi
  -> Session Generation application
  -> catalog port + pure GenerationEngine
  -> generated-run persistence port
  -> immutable GenerationResult
```

Session Planner translates its participant and control state into the public
request. Session Generation does not call Session Planner, Party, Creatures, or
Encounter. Applying a result is a separate Session Planner workflow that calls
Encounter's generated-origin import API and then mutates Session Planner truth.

## Pure Generation Pipeline

The engine retains stage boundaries because their intermediate values are
needed for deterministic diagnosis and parity checks:

1. request normalization and session-context calculation
2. encounter-target allocation
3. role block and encounter-candidate construction
4. deterministic encounter selection, difficulty, and bossiness
5. treasure budget, channel, theme, and slot planning
6. non-magic and magic loot resolution
7. packing
8. reward aggregation and formatting
9. hard audits and warnings

Each stage consumes immutable typed values and returns immutable typed values.
The application layer loads one complete catalog snapshot, invokes the stages,
assigns a run identity only after successful audits, persists the aggregate,
and maps it to the public result. SQL rows and API carriers are translated at
their boundaries and are not domain inputs.

## Boundaries And Dependency Direction

- API depends only on JDK values and feature-neutral asynchronous contracts.
- Domain depends on no API, platform, SQL, JavaFX, shell, or foreign feature.
- Application depends on API, domain, feature-owned ports, execution, and local
  diagnostics; it does not depend on adapters or UI.
- The resource adapter implements the immutable catalog port; the SQLite
  adapter implements only run persistence. Neither contains generation rules.
- Composition is the only place that constructs adapters and application
  services.
- Bundled resources are catalog input. They do not become a second executable
  rules engine.
- All persistence and resource access is off the JavaFX thread.
- The engine and one catalog snapshot are read-only during a run. Late
  asynchronous completion cannot overwrite newer Session Planner preview
  state because Session Planner checks both its active request token and the
  preview fingerprint.

Forbidden shortcuts include direct Session Planner database reads, Encounter
repository use, JavaFX controls in this feature, a shell service locator,
catalog-driven reflection, JSON aggregate storage, and a single generator
method that hides all stage boundaries.

## Decisions And Rationale

- A separate UI-free feature was chosen because generated proposals, reference
  catalogs, and reproducibility are durable concerns distinct from authored
  sessions and saved encounter rosters.
- Session Planner owns the interaction because generation is part of its user
  flow; a second feature tab or ruleset chooser would split one task across
  surfaces.
- The source pipeline is retained as pure stage seams because stage-level
  values localize parity drift and hard-audit failures. The spreadsheet sheet
  layout itself is not reproduced.
- Immutable content-addressed catalog artifacts plus self-contained stored run
  results were chosen instead of duplicating shipped reference rows into the
  user's mutable SQLite database. The artifact address derives from the
  versioned, sorted table inventory and its dimensions and file hashes; source
  workbook hashes and URLs remain provenance rather than runtime identity.
- Reusing the existing Encounter runtime generator was rejected because it
  owns different candidate inputs, tuning, and observable behavior.
- A proof-of-concept compatibility layer was rejected because it would create
  two schemas and two meanings for generation truth before release.

## Quality And Verification

The architecture targets deterministic reproducibility, JavaFX responsiveness,
atomic stored results, local diagnosability, and replaceable catalog content.
For an equal normalized request, engine version, and catalog content hash, a
stage-by-stage comparison must be equal before persistence identity is added.

Target-package dependency direction is mechanically enforced when the feature
is included in `architectureTest`; pure-stage, asynchronous production-route,
and persistence atomicity remain test-owned. The absence of a JavaFX adapter,
foreign implementation imports, proof-of-concept dual reads, and opaque
aggregate payloads is review-owned unless a named gate covers it.

## Sources

- Readable pipeline evidence:
  `/home/aaron/Schreibtisch/projects/references/saltmarcher/session-generation/encounter-loot-generation-design.md`
- Preserved original:
  `/home/aaron/Schreibtisch/projects/references/.tools/markdown/saltmarcher-encounter-loot-generation-design-2026-07-16.md`
- [Requirements](../requirements/requirements-session-generation.md)
- [Domain Model](../domain/domain-session-generation.md)
- [Contract](../contract/contract-session-generation.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
