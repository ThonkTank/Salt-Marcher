# Party Feature

## Purpose

`features.party` owns party data, party mutations, and the public party boundary consumed by shell and encounter-owned features.

## Canonical Types and APIs

- `features.party.api` — current public party compatibility surface. Keep cross-feature access here, but do not treat `api/` as placement precedent for new owner-local code.
- `PartyApi` — current read facade for party state.
- `PartyMutationApi` — current mutation facade for party state.

## Where New Code Goes

- Put party reads, writes, and party-owned UI here.
- Do not use `api` or `service` naming here as the default placement for new touched architecture work.

## Forbidden Drift

- Do not let consuming features write party persistence directly.
