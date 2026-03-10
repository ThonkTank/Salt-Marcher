package features.encounter.analysis.application;

import features.encounter.analysis.service.EncounterPartyAnalysisService;

import java.util.logging.Logger;

/**
 * UI-/application-facing facade for encounter party-cache workflows.
 */
public final class EncounterPartyCacheApplicationService {

    private static final Logger LOGGER = Logger.getLogger(EncounterPartyCacheApplicationService.class.getName());

    private EncounterPartyCacheApplicationService() {
        throw new AssertionError("No instances");
    }

    public static void ensureCurrentPartyCacheReadyBestEffort() {
        EncounterPartyAnalysisService.CacheReadiness readiness = EncounterPartyAnalysisService.ensureCacheReady();
        if (readiness == EncounterPartyAnalysisService.CacheReadiness.NOT_READY) {
            refreshCurrentPartyCacheAsyncBestEffort();
        }
    }

    public static void invalidateCurrentPartyCacheBestEffort() {
        boolean invalidated = EncounterPartyAnalysisService.invalidateCurrentPartyCache();
        if (!invalidated) {
            LOGGER.warning(
                    "EncounterPartyCacheApplicationService: encounter party-analysis cache invalidation failed");
        }
    }

    public static void rebuildCurrentPartyCacheAsyncBestEffort() {
        EncounterPartyAnalysisService.rebuildCurrentPartyCacheAsyncBestEffort();
    }

    public static void refreshCurrentPartyCacheAsyncBestEffort() {
        EncounterPartyAnalysisService.refreshCurrentPartyCacheAsyncBestEffort();
    }
}
