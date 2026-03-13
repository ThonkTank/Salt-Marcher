package features.world.dungeonmap.service.editing;

import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.repository.DungeonPassageRepository;
import features.world.dungeonmap.service.linking.DungeonLinkIntegrityService;
import features.world.dungeonmap.service.topology.DungeonAreaNormalizationService;
import features.world.dungeonmap.service.topology.DungeonTopologyService;

import java.sql.Connection;
import java.sql.PreparedStatement;
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
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT passage_id FROM dungeon_passages WHERE map_id=? AND x=? AND y=? AND direction=?")) {
            for (DungeonWallEdit edit : edits) {
                if (!edit.wallPresent()) {
                    continue;
                }
                ps.setLong(1, mapId);
                ps.setInt(2, edit.x());
                ps.setInt(3, edit.y());
                ps.setString(4, edit.direction().dbValue());
                try (var rs = ps.executeQuery()) {
                    while (rs.next()) {
                        long passageId = rs.getLong("passage_id");
                        DungeonLinkIntegrityService.deleteLinksTouchingAnchor(conn, DungeonLinkAnchor.passage(passageId));
                        DungeonPassageRepository.deletePassage(conn, passageId);
                    }
                }
            }
        }
    }
}
