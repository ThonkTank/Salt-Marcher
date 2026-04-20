Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Mechanical and review-owned enforcement coverage for data and
system architecture.

# Data And System Enforcement Coverage

## Goal

This document maps data-layer, persistencecore, gateway, repository/query, and
system-layer rules to their local quality gates.

## Enforced

- Data feature roots may expose only `<Feature>ServiceContribution.java`
  directly under `src/data/<feature>/`, owned by `build-harness`.
- Feature data implementation may live only under `repository/`, `query/`,
  `gateway/local/`, `gateway/remote/`, `model/`, and `mapper/`; shared
  persistence infrastructure lives under `src/data/persistencecore/sqlite` or
  `src/data/persistencecore/model`, owned by `build-harness`.
- Data code must not depend on presentation, shell, or bootstrap; data model
  types must not depend on domain types; persistencecore must not depend on
  feature-specific data packages or domain types, owned by ArchUnit data rules.
- Data feature code must not reach foreign private data implementation
  packages, owned by ArchUnit `dataFeaturesMustNotReachForeignPrivateDataBuckets`.
- Data code may depend on foreign domain only through foreign root application
  services or `published/` carriers, owned by ArchUnit
  `dataFeaturesMustOnlyUseForeignFeatureApis`.
- Gateway, repository, query adapter, return-type, and public-signature leak
  rules are owned by Error Prone data checkers:
  `DataAdapterGatewayCollaboratorBoundary`,
  `DataAdapterPublicSignatureLeak`, `DataAdapterRoleContract`, and
  `DataGatewayReturnTypeBoundary`.
- Data feature and persistencecore cycles are forbidden through ArchUnit
  `dataFeaturesMustStayCycleFree`.
- Bootstrap stays outside feature code except for the allowed shell host
  composition point, owned by ArchUnit `bootstrapMustStayOutsideFeatureCode`
  and `bootstrapMustOnlyUseAppShellFromShellHost`.

## Source-Pattern Checks

PMD architecture source rules block stable forbidden imports, direct storage
access escapes, and obvious adapter boundary leaks. They do not prove query
efficiency, transaction correctness, or persistence semantics.

## Review-Owned

- whether SQL schemas and migrations express the domain persistence contract
- whether repository/query adapters translate without losing invariants
- whether gateway error handling and transaction boundaries are adequate
- whether persistencecore abstractions remain small enough for the project
