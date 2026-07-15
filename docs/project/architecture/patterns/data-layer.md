Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Data adapter-zone responsibility during the architecture
migration.

# Data Layer Standard

## Goal

`src/data/**` remains SaltMarcher's outbound adapter zone for persistence,
imports, files, remote systems, and other concrete sources. Data code adapts
sources to domain-owned or migrated feature-owned public boundaries; it does
not own business behavior or presentation behavior.

The architecture migration does not run a per-area simplification cycle over
`src/data/**`. Data code changes only when a migrated area's slimmer boundary
requires an adapter or gateway signature adaptation.

## Responsibilities

- own concrete source mechanics, connection lifecycle, schema interaction,
  transport details, source-local records, and non-trivial source translation
- satisfy public contracts owned by the feature or domain that needs the source
- keep source-local shapes out of inner behavior and presentation code
- keep shared infrastructure generic
- avoid introducing a second business model beside the owning domain or
  migrated feature runtime

## Verification

The required proof route is `check`.

## References

- [Layering Architecture Standard](layering-architecture.md)
- [Quality Platforms Standard](../../verification/quality-platforms.md)
