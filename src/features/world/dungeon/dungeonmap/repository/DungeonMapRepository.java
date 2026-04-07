package features.world.dungeon.dungeonmap.repository;

import features.world.dungeon.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeon.dungeonmap.cluster.repository.DungeonClusterRepository;
import features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.repository.DungeonRoomRepository;
import features.world.dungeon.repository.DungeonStairRepository;
import features.world.dungeon.repository.DungeonTransitionRepository;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.model.structures.room.Room;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

/**
 * Repository-owned dungeon-map rehydration from direct persisted structure owners.
 *
 * <p>Selection and fallback policy belong to loading workflows. This repository only assembles the authoritative map
 * snapshot for a requested persisted map.
 */
public final class DungeonMapRepository {

    private final DungeonClusterRepository clusterRepository = new DungeonClusterRepository();
    private final DungeonRoomRepository roomRepository = new DungeonRoomRepository();
    private final DungeonCorridorRepository corridorRepository = new DungeonCorridorRepository();
    private final DungeonStairRepository stairRepository = new DungeonStairRepository();
    private final DungeonTransitionRepository transitionRepository = new DungeonTransitionRepository();

    public DungeonMap loadMap(Connection conn, long mapId) throws SQLException {
        requireConnection(conn);
        String mapName = loadMapName(conn, mapId);
        if (mapName == null) {
            return null;
        }
        return loadMap(conn, new DungeonMapCatalogEntry(mapId, mapName));
    }

    public DungeonMap loadMap(Connection conn, DungeonMapCatalogEntry map) throws SQLException {
        requireConnection(conn);
        if (map == null || map.mapId() <= 0) {
            return null;
        }
        return loadMap(conn, map.mapId(), map.name());
    }

    private DungeonMap loadMap(Connection conn, long mapId, String mapName) throws SQLException {
        List<Room> roomMetadata = roomRepository.loadRooms(conn, mapId);
        List<Cluster> clusters = clusterRepository.loadClusters(conn, mapId, roomMetadata);
        Map<Long, Integer> clusterLevels = clusterRepository.loadClusterLevels(conn, mapId);
        DungeonMap roomMap = new DungeonMap(mapId, mapName, List.of(), clusters, List.of(), List.of(), clusterLevels);
        List<Corridor> corridors = corridorRepository.loadByMap(conn, roomMap);
        DungeonMap structureMap = new DungeonMap(
                mapId,
                mapName,
                corridors,
                clusters,
                stairRepository.loadByMap(conn, mapId),
                List.of(),
                clusterLevels);
        return new DungeonMap(
                mapId,
                mapName,
                corridors,
                clusters,
                structureMap.stairs(),
                transitionRepository.loadByMap(conn, structureMap),
                clusterLevels);
    }

    private static String loadMapName(Connection conn, long mapId) throws SQLException {
        if (mapId <= 0) {
            return null;
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id, name FROM dungeon_maps WHERE dungeon_map_id=?")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                return rs.getString("name");
            }
        }
    }

    private static void requireConnection(Connection conn) {
        if (conn == null) {
            throw new IllegalArgumentException("conn darf nicht null sein");
        }
    }
}
