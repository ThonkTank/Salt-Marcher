package features.world.dungeonmap.service.command.feature;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureTile;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.repository.feature.DungeonAreaRepository;
import features.world.dungeonmap.repository.feature.DungeonFeatureRepository;
import features.world.dungeonmap.repository.feature.DungeonFeatureTileRepository;
import features.world.dungeonmap.repository.map.DungeonRoomRepository;
import features.world.dungeonmap.service.command.support.DungeonEditingTransactions;
import features.world.dungeonmap.service.command.area.AreaAssignmentNormalizationService;
import features.world.dungeonmap.service.topology.DungeonTopologyService;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

public final class DungeonFeatureEditingService {

    private DungeonFeatureEditingService() {
        throw new AssertionError("No instances");
    }

    public static void updateRoomMetadata(long roomId, String name, String description) throws Exception {
        DungeonEditingTransactions.withConnectionVoid(conn -> DungeonRoomRepository.updateRoomMetadata(conn, roomId, name, description));
    }

    public static long saveArea(DungeonArea area) throws Exception {
        return DungeonEditingTransactions.inTransactionRollbackOnSql(conn -> DungeonAreaRepository.upsertArea(conn, area));
    }

    public static void deleteArea(long areaId) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlVoid(conn -> {
            var existingArea = DungeonAreaRepository.findArea(conn, areaId);
            if (existingArea.isEmpty()) {
                return;
            }
            DungeonAreaRepository.deleteArea(conn, areaId);
            normalizeAreaAssignments(conn, existingArea.get().mapId());
        });
    }

    public static long saveFeature(DungeonFeature feature) throws Exception {
        return DungeonEditingTransactions.withConnection(conn -> DungeonFeatureRepository.upsertFeature(conn, feature));
    }

    public static void deleteFeature(long featureId) throws Exception {
        DungeonEditingTransactions.withConnectionVoid(conn -> DungeonFeatureRepository.deleteFeature(conn, featureId));
    }

    public static void addSquareToFeature(long featureId, long squareId) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> {
            Optional<DungeonFeature> feature = DungeonFeatureRepository.findFeature(conn, featureId);
            if (feature.isEmpty()) {
                throw new IllegalArgumentException("Unknown dungeon feature: " + featureId);
            }
            DungeonFeatureTileRepository.addTile(conn, featureId, squareId);
            DungeonTopologyService.validateFeatureFootprintConnected(
                    DungeonFeatureTileRepository.getTilesForFeature(conn, featureId));
        });
    }

    public static void removeSquareFromFeature(long featureId, long squareId) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> {
            DungeonFeatureTileRepository.removeTile(conn, featureId, squareId);
            List<DungeonFeatureTile> remainingTiles = DungeonFeatureTileRepository.getTilesForFeature(conn, featureId);
            if (remainingTiles.isEmpty()) {
                DungeonFeatureRepository.deleteFeature(conn, featureId);
            } else {
                DungeonTopologyService.validateFeatureFootprintConnected(remainingTiles);
            }
        });
    }

    public static void assignRoomArea(long roomId, long areaId) throws Exception {
        if (areaId <= 0) {
            throw new IllegalArgumentException("areaId must be persisted");
        }
        DungeonEditingTransactions.inTransactionRollbackOnSqlVoid(conn -> assignRoomAreaWithinMap(conn, roomId, areaId));
    }

    private static void assignRoomAreaWithinMap(Connection conn, long roomId, long areaId) throws SQLException {
        DungeonRoom room = DungeonRoomRepository.findRoom(conn, roomId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon room: " + roomId));
        DungeonArea area = DungeonAreaRepository.findArea(conn, areaId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon area: " + areaId));
        if (room.mapId() != area.mapId()) {
            throw new IllegalArgumentException(
                    "Dungeon room " + roomId + " cannot be assigned to area " + areaId + " from a different map");
        }
        DungeonRoomRepository.assignRoomArea(conn, roomId, areaId);
        normalizeAreaAssignments(conn, room.mapId());
    }

    private static void normalizeAreaAssignments(Connection conn, long mapId) throws SQLException {
        AreaAssignmentNormalizationService.normalizeMapAreas(conn, mapId);
    }
}
