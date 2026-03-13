package features.world.dungeonmap.service.editing.topology;

import features.world.dungeonmap.model.domain.DungeonLinkAnchor;
import features.world.dungeonmap.model.editing.DungeonSquarePaint;
import features.world.dungeonmap.model.editing.DungeonWallEdit;
import features.world.dungeonmap.repository.connection.DungeonPassageRepository;
import features.world.dungeonmap.service.topology.DungeonLinkIntegrityService;
import features.world.dungeonmap.service.editing.campaign.DungeonCampaignPositionEditingSupport;
import features.world.dungeonmap.service.editing.DungeonEditingTransactions;
import features.world.dungeonmap.service.editing.AreaAssignmentNormalizationService;
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
        AreaAssignmentNormalizationService.normalizeMapAreas(conn, mapId);
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
