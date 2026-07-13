Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: Encounter behavior proof ownership and requirement-to-proof
mapping.

# Encounter Verification

## Purpose

This document owns durable proof traceability for Encounter behavior. It maps
Encounter requirement IDs to focused production-route proof.

## Verified Sources

- [Encounter Feature Spec](docs/encounter/requirements/requirements-encounter.md:1)
- [Encounter Runtime State UI](docs/encounter/requirements/requirements-encounter-state-tab.md:1)
- [Encounter Persistence Contract](docs/encounter/contract/contract-encounter-persistence.md:1)

## Verification Methods

- `Mechanically Enforced`: `./gradlew encounterStateTabHarness
  --console=plain` runs the shell-bound Encounter state tab route with real
  Encounter, Party, Creature, and persistence services where the harness seeds
  a focused scenario.
- `Mechanically Enforced`: `./gradlew creatureCatalogHarness --console=plain`
  proves creature catalog filtering and encounter-candidate publication used
  by Encounter planning.
- `Review-Owned`: review confirms requirements, contract, domain, and
  verification ownership remain split and do not redefine each other.

## Proof IDs

| Requirement ID | Obligation | Required proof | Current status |
| --- | --- | --- | --- |
| `REQ-encounter-named-plan-save` | Saving the current roster uses the user-entered saved encounter name and shows that name in the saved-plan list. | `encounterStateTabHarness` saves a current roster with a user-entered name and asserts the saved-plan readback shows that name. | Ready |

## Pass Or Fail Criteria

The focused Encounter state-tab harness passes only when each proof ID marked
Ready is exercised through the production Encounter state-tab route. A proof ID
fails if it relies only on fixture selftests, bypasses the Encounter application
service, or asserts persistence rows without visible state-tab readback.

## References

- [Quality Platforms](docs/project/verification/quality-platforms.md:1)
- [Encounter Feature Spec](docs/encounter/requirements/requirements-encounter.md:1)
- [Encounter Runtime State UI](docs/encounter/requirements/requirements-encounter-state-tab.md:1)
