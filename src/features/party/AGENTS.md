# Party Feature

## Purpose

`features.party` owns party membership, character mutations, party progression state, and the public party boundary consumed by shell, encounter, and party-analysis code.

## Canonical Types and APIs

- `PartyObject` - canonical root seam for party reads, writes, rest state, and adventuring-day reads.
- `input/` - canonical request and result carriers for party-owned reads and mutations.
- `features.party.api` - current public compatibility surface for cross-feature party reads and mutations.
- `PartyModule` - shell-facing toolbar entry that hosts the party popup workflow.

## Where New Code Goes

- Put party reads, writes, and party-owned UI workflow behavior in this feature.
- Add new owner-local request and result carriers under `input/`.
- Keep compatibility mapping in `api/`, but do not treat `api/`, `service/`, or `ui/` names as placement precedent for new architecture work.

## Forbidden Drift

- Do not let consuming features write party persistence directly.
- Do not reintroduce `PartyService` as the factual root of party behavior.
- Do not move derived party-analysis policy into `features.party`; keep that in `features.partyanalysis`.
