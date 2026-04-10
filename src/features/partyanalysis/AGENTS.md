# Party Analysis Feature

## Purpose

`features.partyanalysis` owns derived party-analysis reads, caches, and analysis workflows consumed by encounter and party-owned features.

## Canonical Types and APIs

- `PartyanalysisObject` - canonical party-analysis root for cache readiness, refresh/rebuild workflows, generation snapshots, and fallback role classification.
- `features.partyanalysis.input` - canonical owner-local requests and result carriers for the root seam.
- `features.partyanalysis.api` - public compatibility surface for cross-feature consumers; keep access stable here, but do not treat `api/` as placement precedent for new owner-local code.
- `PartyAnalysisReadApi` - compatibility read facade for analysis output.
- `PartyAnalysisCacheService` - compatibility cache-refresh facade exported to consumers that need analysis freshness.
- `CreatureAnalysisMaintenanceService` - compatibility maintenance facade for creature-data and analysis-input refresh flows.

## Where New Code Goes

- Put party-analysis computation, persistence, and cache refresh behavior behind `PartyanalysisObject`.
- Put new owner request and result carriers in `input/`.
- Keep `api/` as compatibility only; do not use `api`, `application`, or `service` naming here as the default placement for new touched architecture work.

## Forbidden Drift

- Do not move encounter-specific policy into the public compatibility surface.
- Do not let consuming features maintain their own parallel analysis cache.
