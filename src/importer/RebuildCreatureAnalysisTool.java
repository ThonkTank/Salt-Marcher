package importer;

import features.partyanalysis.api.CreatureAnalysisMaintenanceService;

public final class RebuildCreatureAnalysisTool {
    private RebuildCreatureAnalysisTool() {
        throw new AssertionError("No instances");
    }

    public static void main(String[] args) {
        CreatureAnalysisMaintenanceService.AnalysisInputRefreshStatus status =
                CreatureAnalysisMaintenanceService.rebuildForAnalysisInputChange();
        System.out.println("Creature analysis rebuild status=" + status.name());
        if (status == CreatureAnalysisMaintenanceService.AnalysisInputRefreshStatus.STORAGE_ERROR) {
            System.exit(2);
        }
    }
}
