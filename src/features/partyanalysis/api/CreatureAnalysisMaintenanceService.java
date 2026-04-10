package features.partyanalysis.api;

import features.partyanalysis.PartyanalysisObject;
import features.partyanalysis.input.RebuildForAnalysisInputChangeInput;
import features.partyanalysis.input.RefreshCacheForCreatureDataChangeInput;
import features.partyanalysis.input.RefreshForAnalysisInputChangeInput;
import features.partyanalysis.input.RefreshForCreatureInput;

import java.sql.Connection;
import java.sql.SQLException;

/**
 * Public maintenance-facing facade for creature-analysis refresh workflows.
 */
@SuppressWarnings("unused")
public final class CreatureAnalysisMaintenanceService {
    private static final PartyanalysisObject PARTY_ANALYSIS_OBJECT = new PartyanalysisObject();

    private CreatureAnalysisMaintenanceService() {
        throw new AssertionError("No instances");
    }

    public static void refreshForCreature(Connection conn, long creatureId) throws SQLException {
        PARTY_ANALYSIS_OBJECT.refreshForCreature(new RefreshForCreatureInput(conn, creatureId));
    }

    public static CreatureDataRefreshStatus refreshCacheForCreatureDataChange() {
        return switch (PARTY_ANALYSIS_OBJECT.refreshCacheForCreatureDataChange(
                new RefreshCacheForCreatureDataChangeInput()).outcome()) {
            case REBUILT -> CreatureDataRefreshStatus.REBUILT;
            case INVALIDATED_NO_ACTIVE_PARTY -> CreatureDataRefreshStatus.INVALIDATED_NO_ACTIVE_PARTY;
            case STORAGE_ERROR -> CreatureDataRefreshStatus.STORAGE_ERROR;
        };
    }

    public static AnalysisInputRefreshStatus refreshForAnalysisInputChange() {
        return switch (PARTY_ANALYSIS_OBJECT.refreshForAnalysisInputChange(
                new RefreshForAnalysisInputChangeInput()).outcome()) {
            case INVALIDATED -> AnalysisInputRefreshStatus.INVALIDATED;
            case REBUILT -> AnalysisInputRefreshStatus.REBUILT;
            case INVALIDATED_NO_ACTIVE_PARTY -> AnalysisInputRefreshStatus.INVALIDATED_NO_ACTIVE_PARTY;
            case STORAGE_ERROR -> AnalysisInputRefreshStatus.STORAGE_ERROR;
        };
    }

    public static AnalysisInputRefreshStatus rebuildForAnalysisInputChange() {
        return switch (PARTY_ANALYSIS_OBJECT.rebuildForAnalysisInputChange(
                new RebuildForAnalysisInputChangeInput()).outcome()) {
            case REBUILT -> AnalysisInputRefreshStatus.REBUILT;
            case INVALIDATED -> AnalysisInputRefreshStatus.INVALIDATED;
            case INVALIDATED_NO_ACTIVE_PARTY -> AnalysisInputRefreshStatus.INVALIDATED_NO_ACTIVE_PARTY;
            case STORAGE_ERROR -> AnalysisInputRefreshStatus.STORAGE_ERROR;
        };
    }

    public enum CreatureDataRefreshStatus {
        REBUILT,
        INVALIDATED_NO_ACTIVE_PARTY,
        STORAGE_ERROR
    }

    public enum AnalysisInputRefreshStatus {
        INVALIDATED,
        REBUILT,
        INVALIDATED_NO_ACTIVE_PARTY,
        STORAGE_ERROR
    }
}
