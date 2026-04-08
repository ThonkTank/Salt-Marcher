# Party Analysis Feature

## Purpose

`features.partyanalysis` owns derived party-analysis reads, caches, and analysis workflows consumed by encounter and party-owned features.

## Canonical Types and APIs

- `features.partyanalysis.api` — current public party-analysis compatibility surface. Keep cross-feature access here, but do not treat `api/` as placement precedent for new owner-local code.
- `PartyAnalysisReadApi` — current read facade for analysis output.
- `PartyAnalysisCacheService` — current cache-refresh facade exported to consumers that need analysis freshness.

## Where New Code Goes

- Put party-analysis computation, persistence, and cache refresh behavior here.
- Do not use `api`, `application`, or `service` naming here as the default placement for new touched architecture work.

## Forbidden Drift

- Do not move encounter-specific policy into the public compatibility surface.
- Do not let consuming features maintain their own parallel analysis cache.
