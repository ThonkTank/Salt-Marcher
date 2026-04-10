package features.partyanalysis.api;

import features.partyanalysis.PartyanalysisObject;
import features.partyanalysis.input.EnsureCacheReadyInput;
import features.partyanalysis.input.InvalidateCurrentPartyCacheInput;
import features.partyanalysis.input.RebuildCurrentPartyCacheAsyncBestEffortInput;
import features.partyanalysis.input.RefreshCurrentPartyCacheAsyncBestEffortInput;

import java.util.logging.Logger;

/**
 * Public facade for party-analysis cache workflows triggered by party mutations.
 */
@SuppressWarnings("unused")
public final class PartyAnalysisCacheService implements PartyCacheRefreshPort {
    private static final Logger LOGGER = Logger.getLogger(PartyAnalysisCacheService.class.getName());
    private static final PartyanalysisObject PARTY_ANALYSIS_OBJECT = new PartyanalysisObject();

    public void ensureCurrentPartyCacheReadyBestEffort() {
        EnsureCacheReadyInput.CacheReadiness readiness =
                PARTY_ANALYSIS_OBJECT.ensureCacheReady(new EnsureCacheReadyInput()).readiness();
        if (readiness == EnsureCacheReadyInput.CacheReadiness.NOT_READY) {
            refreshCurrentPartyCacheAsyncBestEffort();
        }
    }

    public void invalidateCurrentPartyCacheBestEffort() {
        InvalidateCurrentPartyCacheInput.Status status =
                PARTY_ANALYSIS_OBJECT.invalidateCurrentPartyCache(new InvalidateCurrentPartyCacheInput()).status();
        if (status != InvalidateCurrentPartyCacheInput.Status.SUCCESS) {
            LOGGER.warning(
                    "PartyAnalysisCacheService: party-analysis cache invalidation failed");
        }
    }

    public void rebuildCurrentPartyCacheAsyncBestEffort() {
        PARTY_ANALYSIS_OBJECT.rebuildCurrentPartyCacheAsyncBestEffort(new RebuildCurrentPartyCacheAsyncBestEffortInput());
    }

    @Override
    public void refreshCurrentPartyCacheAsyncBestEffort() {
        PARTY_ANALYSIS_OBJECT.refreshCurrentPartyCacheAsyncBestEffort(
                new RefreshCurrentPartyCacheAsyncBestEffortInput());
    }

    public CreatureAnalysisMaintenanceService.CreatureDataRefreshStatus refreshCacheForCreatureDataChange() {
        return CreatureAnalysisMaintenanceService.refreshCacheForCreatureDataChange();
    }
}
