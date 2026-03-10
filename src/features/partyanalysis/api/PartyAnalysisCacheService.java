package features.partyanalysis.api;

import features.partyanalysis.application.EncounterPartyAnalysisService;

import java.util.logging.Logger;

/**
 * Public facade for party-analysis cache workflows triggered by party mutations.
 */
public final class PartyAnalysisCacheService implements PartyCacheRefreshPort {

    private static final Logger LOGGER = Logger.getLogger(PartyAnalysisCacheService.class.getName());

    public void ensureCurrentPartyCacheReadyBestEffort() {
        EncounterPartyAnalysisService.CacheReadiness readiness = EncounterPartyAnalysisService.ensureCacheReady();
        if (readiness == EncounterPartyAnalysisService.CacheReadiness.NOT_READY) {
            refreshCurrentPartyCacheAsyncBestEffort();
        }
    }

    public void invalidateCurrentPartyCacheBestEffort() {
        boolean invalidated = EncounterPartyAnalysisService.invalidateCurrentPartyCache();
        if (!invalidated) {
            LOGGER.warning(
                    "PartyAnalysisCacheService: party-analysis cache invalidation failed");
        }
    }

    public void rebuildCurrentPartyCacheAsyncBestEffort() {
        EncounterPartyAnalysisService.rebuildCurrentPartyCacheAsyncBestEffort();
    }

    @Override
    public void refreshCurrentPartyCacheAsyncBestEffort() {
        EncounterPartyAnalysisService.refreshCurrentPartyCacheAsyncBestEffort();
    }

    public CreatureAnalysisMaintenanceService.CreatureDataRefreshStatus refreshCacheForCreatureDataChange() {
        return CreatureAnalysisMaintenanceService.refreshCacheForCreatureDataChange();
    }
}
