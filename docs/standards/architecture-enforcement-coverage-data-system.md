Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Mechanical and review-owned enforcement coverage for data and
system architecture.

# Data And System Enforcement Coverage

## Goal

This document maps data-layer composition adapters, port adapters, source
adapters, source models, persistencecore, and system-layer rules to their local
quality gates.

## Enforced

- Data feature roots may expose only the composition adapter
  `<Feature>ServiceContribution.java` directly under `src/data/<feature>/`,
  owned by `build-harness`.
- Feature data implementation may live only under current physical adapter
  packages: `repository/` and `query/` for port adapters, `gateway/local/` and
  `gateway/remote/` for source adapters, `model/` for source-local shapes, and
  `mapper/` for optional translation. Shared persistence infrastructure lives
  under `src/data/persistencecore/sqlite` or `src/data/persistencecore/model`,
  owned by `build-harness`.
- Data code must not depend on presentation, shell, or bootstrap; data model
  types must not depend on domain types; persistencecore must not depend on
  feature-specific data packages or domain types, owned by ArchUnit data rules.
- Data feature code must not reach foreign private data implementation
  packages, owned by ArchUnit `dataFeaturesMustNotReachForeignPrivateDataBuckets`.
- Data code may depend on foreign domain only through foreign root application
  services or `published/` carriers, owned by ArchUnit
  `dataFeaturesMustOnlyUseForeignFeatureApis`.
- Source-adapter facade, port-adapter contract, return-type, and
  public-signature leak rules are owned by Error Prone data checkers:
  `DataAdapterGatewayCollaboratorBoundary`,
  `DataAdapterPublicSignatureLeak`, `DataAdapterRoleContract`, and
  `DataGatewayReturnTypeBoundary`. The checker names remain stable, but their
  diagnostics must describe the current source-adapter and port-adapter model.
- Data feature and persistencecore cycles are forbidden through ArchUnit
  `dataFeaturesMustStayCycleFree`.
- Bootstrap stays outside feature code except for the allowed shell host
  composition point, owned by ArchUnit `bootstrapMustStayOutsideFeatureCode`
  and `bootstrapMustOnlyUseAppShellFromShellHost`.

## Source-Pattern Checks

PMD architecture source rules block stable forbidden imports, direct storage
access escapes from port adapters, and obvious adapter boundary leaks. They do
not prove query efficiency, transaction correctness, or persistence semantics.

## Review-Owned

- whether SQL schemas and migrations express the domain persistence contract
- whether repository/query port adapters translate without losing invariants
- whether source-adapter error handling and transaction boundaries are adequate
- whether a source adapter facade ending in `Gateway` is a useful boundary or
  just naming ceremony
- whether persistencecore abstractions remain small enough for the project
