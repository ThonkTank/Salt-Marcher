package importer;

import features.partyanalysis.api.CreatureAnalysisMaintenanceService.CreatureDataRefreshStatus;
import features.partyanalysis.api.PartyAnalysisCacheService;

/**
 * Reimports crawled monsters from stored HTML and refreshes encounter-analysis caches.
 */
public final class CreatureAnalysisBackfillTool {
    private CreatureAnalysisBackfillTool() {
        throw new AssertionError("No instances");
    }

    public static void main(String[] args) throws Exception {
        try {
            MonsterImportApplicationService.ImportSummary summary =
                    MonsterImportApplicationService.importFromDefaultDirectory();
            PartyAnalysisCacheService cacheService = new PartyAnalysisCacheService();
            var cacheOutcome = cacheService.refreshCacheForCreatureDataChange();
            System.out.println("Creature analysis backfill files=" + summary.fileCount()
                    + ", overridesUpdated=" + summary.overrideSummary().updated()
                    + ", remapped=" + summary.driftCount()
                    + ", cacheRefresh=" + cacheOutcome.name());
            if (cacheOutcome == CreatureDataRefreshStatus.STORAGE_ERROR) {
                System.exit(2);
            }
        } catch (java.io.IOException e) {
            System.err.println(e.getMessage());
            System.err.println("Run MonsterCrawler first (or ./scripts/crawl.sh).");
            System.exit(1);
        }
    }
}
