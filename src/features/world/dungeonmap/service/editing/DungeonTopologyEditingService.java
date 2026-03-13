package features.world.dungeonmap.service.editing;

import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.repository.DungeonPassageRepository;
import features.world.dungeonmap.service.linking.DungeonLinkIntegrityService;
import features.world.dungeonmap.service.topology.DungeonAreaNormalizationService;
import features.world.dungeonmap.service.topology.DungeonTopologyService;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

public final class DungeonTopologyEditingService {

    private DungeonTopologyEditingService() {
        throw new AssertionError("No instances");
    }

    public static void applySquareEditsAndReconcileState(long mapId, List<DungeonSquarePaint> edits) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlVoid(conn -> {
            DungeonCampaignPositionEditingSupport.clearInvalidActiveEndpointAfterEdits(conn, mapId, edits);
            DungeonTopologyService.applySquareEdits(conn, mapId, edits);
            normalizeAreaAssignments(conn, mapId);
        });
    }

    public static void applyWallEdits(long mapId, List<DungeonWallEdit> edits) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> {
            deletePassagesReplacedByWalls(conn, mapId, edits);
            DungeonTopologyService.applyWallEdits(conn, mapId, edits);
        });
    }

    private static void normalizeAreaAssignments(Connection conn, long mapId) throws SQLException {
        DungeonAreaNormalizationService.normalizeMapAreas(conn, mapId);
    }

    private static void deletePassagesReplacedByWalls(Connection conn, long mapId, List<DungeonWallEdit> edits) throws SQLException {
        for (DungeonWallEdit edit : edits) {
            if (!edit.wallPresent()) {
                continue;
            }
            for (long passageId : DungeonPassageRepository.findIdsByEdge(conn, mapId, edit.x(), edit.y(), edit.direction())) {
                DungeonLinkIntegrityService.deleteLinksTouchingAnchor(conn, DungeonLinkAnchor.passage(passageId));
                DungeonPassageRepository.deletePassage(conn, passageId);
            }
        }
    }
}
