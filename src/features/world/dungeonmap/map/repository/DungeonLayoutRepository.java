package features.world.dungeonmap.map.repository;

import features.world.dungeonmap.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeonmap.map.cluster.repository.DungeonClusterRepository;
import features.world.dungeonmap.map.corridor.repository.DungeonCorridorRepository;
import features.world.dungeonmap.map.model.DungeonLayout;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonStairRepository;
import features.world.dungeonmap.repository.DungeonTransitionRepository;
import features.world.dungeonmap.map.cluster.model.RoomCluster;
import features.world.dungeonmap.map.corridor.model.Corridor;
import features.world.dungeonmap.model.structures.room.Room;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

/**
 * Repository-owned dungeon layout rehydration from direct persisted structure owners.
 *
 * <p>Selection and fallback policy belong to loading workflows. This repository only assembles a layout for a
 * requested persisted map.
 */
public final class DungeonLayoutRepository {

    private final DungeonClusterRepository clusterRepository = new DungeonClusterRepository();
    private final DungeonRoomRepository roomRepository = new DungeonRoomRepository();
    private final DungeonCorridorRepository corridorRepository = new DungeonCorridorRepository();
    private final DungeonStairRepository stairRepository = new DungeonStairRepository();
    private final DungeonTransitionRepository transitionRepository = new DungeonTransitionRepository();

    public DungeonLayout loadLayout(Connection conn, long mapId) throws SQLException {
        requireConnection(conn);
        String mapName = loadMapName(conn, mapId);
        if (mapName == null) {
            return null;
        }
        return loadLayout(conn, new DungeonMapCatalogEntry(mapId, mapName));
    }

    public DungeonLayout loadLayout(Connection conn, DungeonMapCatalogEntry map) throws SQLException {
        requireConnection(conn);
        if (map == null || map.mapId() <= 0) {
            return null;
        }
        return loadLayout(conn, map.mapId(), map.name());
    }

    private DungeonLayout loadLayout(Connection conn, long mapId, String mapName) throws SQLException {
        List<Room> roomMetadata = roomRepository.loadRooms(conn, mapId);
        List<RoomCluster> clusters = clusterRepository.loadClusters(conn, mapId, roomMetadata);
        Map<Long, Integer> clusterLevels = clusterRepository.loadClusterLevels(conn, mapId);
        DungeonLayout roomLayout = new DungeonLayout(mapId, mapName, List.of(), clusters, List.of(), List.of(), clusterLevels);
        List<Corridor> corridors = corridorRepository.loadByMap(conn, roomLayout);
        DungeonLayout structureLayout = new DungeonLayout(
                mapId,
                mapName,
                corridors,
                clusters,
                stairRepository.loadByMap(conn, mapId),
                List.of(),
                clusterLevels);
        return new DungeonLayout(
                mapId,
                mapName,
                corridors,
                clusters,
                structureLayout.stairs(),
                transitionRepository.loadByMap(conn, structureLayout),
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
