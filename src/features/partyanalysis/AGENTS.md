# Party Analysis Feature

## Purpose

`features.partyanalysis` owns derived party-analysis reads, caches, and analysis workflows consumed by encounter and party-owned features.

## Canonical Types and APIs

- `features.partyanalysis.api` — public party-analysis boundary.
- `PartyAnalysisReadApi` — read seam for analysis output.
- `PartyAnalysisCacheService` — cache refresh seam exported to consumers that need analysis freshness.

## Where New Code Goes

- Put party-analysis computation, persistence, and cache refresh behavior here.

## Forbidden Drift

- Do not move encounter-specific policy into the party-analysis API seam.
- Do not let consuming features maintain their own parallel analysis cache.
