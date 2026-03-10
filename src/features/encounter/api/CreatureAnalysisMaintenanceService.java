package features.encounter.api;

import features.encounter.partyanalysis.application.EncounterPartyAnalysisService;
import features.encounter.partyanalysis.service.CreatureStaticAnalysisService;

import java.sql.Connection;
import java.sql.SQLException;

/**
 * Public maintenance-facing facade for encounter creature-analysis refresh workflows.
 */
public final class CreatureAnalysisMaintenanceService {

    private CreatureAnalysisMaintenanceService() {
        throw new AssertionError("No instances");
    }

    public static void refreshForCreature(Connection conn, long creatureId) throws SQLException {
        CreatureStaticAnalysisService.refreshForCreature(conn, creatureId);
    }

    public static CreatureDataRefreshStatus refreshCacheForCreatureDataChange() {
        return switch (EncounterPartyAnalysisService.refreshCacheForCreatureDataChange()) {
            case REBUILT -> CreatureDataRefreshStatus.REBUILT;
            case INVALIDATED_NO_ACTIVE_PARTY -> CreatureDataRefreshStatus.INVALIDATED_NO_ACTIVE_PARTY;
            case STORAGE_ERROR -> CreatureDataRefreshStatus.STORAGE_ERROR;
        };
    }

    public enum CreatureDataRefreshStatus {
        REBUILT,
        INVALIDATED_NO_ACTIVE_PARTY,
        STORAGE_ERROR
    }
}
