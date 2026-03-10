package features.encounter.api;

import features.encounter.partyanalysis.application.EncounterPartyAnalysisService;

import java.util.logging.Logger;

/**
 * Public facade for encounter party-cache workflows.
 */
public final class EncounterPartyCacheService implements PartyCacheRefreshPort {

    private static final Logger LOGGER = Logger.getLogger(EncounterPartyCacheService.class.getName());

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
                    "EncounterPartyCacheService: encounter party-analysis cache invalidation failed");
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
