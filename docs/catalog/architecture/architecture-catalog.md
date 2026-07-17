Status: Active Target
Owner: Catalog Feature
Last Reviewed: 2026-07-16
Source of Truth: Catalog presentation boundary and dependency direction.

# Catalog Architecture

## Stakeholders And Concerns

Players need one predictable reference workspace. Feature maintainers need
domain ownership to remain local, while UI maintainers need a single place to
compose reference sections. The primary risks are Catalog becoming a shared
domain, importing foreign JavaFX adapters, or reintroducing synchronous I/O.

## Context And Boundaries

`features/catalog` owns one JavaFX adapter and one feature-root composition
entry point. It consumes only foreign `feature.api` models and commands.
Provider-owned inspector actions are passed into Catalog by `app`; Catalog
does not import their adapters. Items callbacks are returned asynchronously and
are dispatched to JavaFX before view mutation.

Catalog composes provider dependencies as `CatalogDataSources` and outward UI
routes as `CatalogActionRoutes`; raw positional callback lists are forbidden.
Its typed `CatalogSectionId` coordinator owns seven persistent presentation
sections. Every section exposes one controls root, one content root, and
idempotent activation/deactivation hooks. The fixed section rail and active
controls are rendered in `COCKPIT_CONTROLS`; the active section content is
rendered in `COCKPIT_MAIN`. Section labels are display text, never selection
identity or branching keys.

Creature browsing uses the request/response `CreatureCatalogQueryApi`. Each
Catalog query owns its completion and Catalog discards late results by its
local request revision. Scene and World Planner consume the separately
refreshed `CreatureReferenceIndexModel`; they MUST NOT issue or publish Catalog
page queries. This split prevents one feature's search lifecycle from replacing
another feature's visible rows.

Catalog has no domain, application, or SQLite role because it owns no durable
truth or orchestration. `app` registers Catalog once and does not register the
World Planner contribution. Encounter remains a global state-tab contribution,
and Scene remains its own runtime navigation contribution.

Section nodes remain alive while the user switches sections, preserving
filters, selection, paging, and drafts. Monster table columns are configured
once; result publication updates rows and restores selection by creature id.
Nested section `TabPane`s and controls embedded in main content are forbidden.

## Enforcement And Rationale

`architectureTest` mechanically enforces cross-feature API-only dependencies
and valid feature roles. UI tests own section completeness, common slot
placement, state preservation, stable Monster columns, and Scene/Catalog query
independence. Inspector ownership and absence of duplicate shell registration
remain behavior-test and review-owned.
This split keeps aggregation replaceable without moving provider truth into a
new shared layer.

## References

- [Source Architecture](../../project/architecture/source-architecture.md)
- [Feature Boundaries](../../project/architecture/patterns/feature-boundaries.md)
- [Catalog Requirements](../requirements/requirements-catalog.md)
