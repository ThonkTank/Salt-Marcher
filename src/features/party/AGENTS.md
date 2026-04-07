# Party Feature

## Purpose

`features.party` owns party data, party mutations, and the public party boundary consumed by shell and encounter-owned features.

## Canonical Types and APIs

- `features.party.api` — public party boundary.
- `PartyApi` — read seam for party state.
- `PartyMutationApi` — mutation seam for party state.

## Where New Code Goes

- Put party reads, writes, and party-owned UI here.

## Forbidden Drift

- Do not let consuming features write party persistence directly.
