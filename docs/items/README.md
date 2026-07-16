Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Entry point and document map for the Items feature.

# Items Feature README

## Purpose

Items owns a local read-only reference catalog imported explicitly from the
public D&D 5e SRD API. It does not own inventory, loot, assignment, crafting, or
user-authored item state.

## Documentation Set

- [Items Catalog Requirements](requirements/requirements-items-catalog.md)
- [Items Domain Model](domain/domain-items.md)
- [Items Persistence And Import Contract](contract/contract-items-persistence.md)

## Source Boundary

The import is pinned to the public 2014 API at
`https://www.dnd5eapi.co/api/2014`. The API requires no authentication and
exposes GET-only reference data. SaltMarcher stores the imported projection
locally and performs no network requests while browsing the Catalog.

## References

- [D&D 5e SRD API Introduction](https://5e-bits.github.io/docs/introduction)
- [5e-database](https://github.com/5e-bits/5e-database)
- [5e-database License](https://github.com/5e-bits/5e-database/blob/main/LICENSE.md)
