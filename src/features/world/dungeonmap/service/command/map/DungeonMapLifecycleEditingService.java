package features.world.dungeonmap.service.command.map;

import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.repository.map.DungeonMapRepository;
import features.world.dungeonmap.service.command.support.DungeonCampaignPositionEditingSupport;
import features.world.dungeonmap.service.command.support.DungeonEditingTransactions;
import features.world.dungeonmap.service.command.area.AreaAssignmentNormalizationService;
import features.world.dungeonmap.service.topology.DungeonTopologyService;

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
                DungeonCampaignPositionEditingSupport.clearActiveEndpointIfOutsideBounds(conn, mapId, width, height);
                DungeonTopologyService.shrinkMap(conn, mapId, width, height);
            }
            normalizeAreaAssignments(conn, mapId);
        });
    }

    public static void deleteMap(long mapId) throws Exception {
        DungeonEditingTransactions.withConnectionVoid(conn -> DungeonMapRepository.deleteMap(conn, mapId));
    }

    private static void normalizeAreaAssignments(java.sql.Connection conn, long mapId) throws java.sql.SQLException {
        AreaAssignmentNormalizationService.normalizeMapAreas(conn, mapId);
    }
}
