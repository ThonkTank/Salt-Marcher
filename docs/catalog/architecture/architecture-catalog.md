Status: Active Target
Owner: Catalog Feature
Last Reviewed: 2026-07-17
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

`CatalogSectionFrame` owns only shared table chrome. Provider-specific columns,
commands, and Inspector routes remain injected composition. The controls host
preserves the established Monster filter surface and swaps only the visible
category controls. Catalog writes Encounter pool filters through the partial
pool command and never writes Encounter tuning.

Catalog has no domain, application, or SQLite role because it owns no durable
truth or orchestration. `app` registers Catalog once and does not register the
World Planner contribution. Encounter remains a global state-tab contribution,
and Scene remains its own runtime navigation contribution.

## Enforcement And Rationale

`architectureTest` mechanically enforces cross-feature API-only dependencies
and valid feature roles. UI section completeness, inspector ownership, and
absence of duplicate shell registration are behavior-test and review-owned.
This split keeps aggregation replaceable without moving provider truth into a
new shared layer.

## References

- [Source Architecture](../../project/architecture/source-architecture.md)
- [Feature Boundaries](../../project/architecture/patterns/feature-boundaries.md)
- [Catalog Requirements](../requirements/requirements-catalog.md)
