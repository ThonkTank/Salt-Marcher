package features.world.dungeonmap.service.editing.map;

import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.repository.map.DungeonMapRepository;
import features.world.dungeonmap.service.editing.campaign.DungeonCampaignPositionEditingSupport;
import features.world.dungeonmap.service.editing.DungeonEditingTransactions;
import features.world.dungeonmap.service.editing.AreaAssignmentNormalizationService;
import features.world.dungeonmap.service.integration.campaign.DungeonCampaignStateAdapter;
import features.world.dungeonmap.service.topology.DungeonTopologyService;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

public final class DungeonMapLifecycleEditingService {

    private DungeonMapLifecycleEditingService() {
        throw new AssertionError("No instances");
    }

    public static long createMap(String name, int width, int height) throws Exception {
        return DungeonEditingTransactions.inTransactionRollbackOnSql(conn -> {
            long mapId = DungeonMapRepository.insertMap(conn, new DungeonMap(null, name, width, height));
            normalizeAreaAssignments(conn, mapId);
            return mapId;
        });
    }

    public static void updateMap(long mapId, String name, int width, int height) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlVoid(conn -> {
            DungeonMap existingMap = DungeonMapRepository.findMap(conn, mapId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + mapId));
            DungeonMapRepository.updateMap(conn, mapId, name, width, height);
            if (width < existingMap.width() || height < existingMap.height()) {
                DungeonCampaignPositionEditingSupport.clearActivePositionIfOutsideBounds(conn, mapId, width, height);
                DungeonTopologyService.shrinkMap(conn, mapId, width, height);
            }
            normalizeAreaAssignments(conn, mapId);
        });
    }

    public static void deleteMap(long mapId) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlVoid(conn -> {
            clearCampaignDungeonState(conn, mapId);
            deleteDungeonRows(conn, "dungeon_feature_tiles", mapId);
            deleteDungeonRows(conn, "dungeon_walls", mapId);
            deleteDungeonRows(conn, "dungeon_features", mapId);
            deleteDungeonRows(conn, "dungeon_squares", mapId);
            deleteDungeonRows(conn, "dungeon_rooms", mapId);
            deleteDungeonRows(conn, "dungeon_area_encounter_tables",
                    "WHERE area_id IN (SELECT area_id FROM dungeon_areas WHERE map_id=?)", mapId);
            deleteDungeonRows(conn, "dungeon_areas", mapId);
            deleteDungeonRows(conn, "dungeon_connection_points",
                    "WHERE connection_id IN (SELECT connection_id FROM dungeon_connections WHERE map_id=?)", mapId);
            deleteDungeonRows(conn, "dungeon_connections", mapId);
            deleteDungeonRows(conn, "dungeon_concept_node_positions", mapId);
            deleteDungeonRows(conn, "dungeon_concept_level_connections", mapId);
            deleteDungeonRows(conn, "dungeon_concept_levels", mapId);
            deleteDungeonRows(conn, "dungeon_concept_party_profiles", "WHERE map_id=?", mapId);
            DungeonMapRepository.deleteMap(conn, mapId);
        });
    }

    private static void normalizeAreaAssignments(java.sql.Connection conn, long mapId) throws java.sql.SQLException {
        AreaAssignmentNormalizationService.normalizeMapAreas(conn, mapId);
    }

    private static void clearCampaignDungeonState(Connection conn, long mapId) throws SQLException {
        if (DungeonCampaignStateAdapter.getDungeonMapId(conn)
                .filter(currentMapId -> currentMapId == mapId)
                .isPresent()) {
            DungeonCampaignStateAdapter.clearDungeonPosition(conn);
        }
    }

    private static void deleteDungeonRows(Connection conn, String tableName, long mapId) throws SQLException {
        deleteDungeonRows(conn, tableName, "WHERE map_id=?", mapId);
    }

    private static void deleteDungeonRows(Connection conn, String tableName, String whereClause, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("DELETE FROM " + tableName + " " + whereClause)) {
            ps.setLong(1, mapId);
            ps.executeUpdate();
        }
    }
}
