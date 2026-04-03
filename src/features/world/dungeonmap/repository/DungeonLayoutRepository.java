package features.world.dungeonmap.repository;

import features.world.dungeonmap.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

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

    private final DungeonRoomRepository roomRepository = new DungeonRoomRepository();
    private final DungeonCorridorRepository corridorRepository = new DungeonCorridorRepository();
    private final DungeonStairRepository stairRepository = new DungeonStairRepository();
    private final DungeonTransitionRepository transitionRepository = new DungeonTransitionRepository();

    public DungeonLayout loadLayout(Connection conn, long mapId) throws SQLException {
        if (conn == null) {
            throw new IllegalArgumentException("conn darf nicht null sein");
        }
        DungeonMapCatalogEntry map = loadMap(conn, mapId);
        if (map == null) {
            return null;
        }
        List<Room> rooms = roomRepository.loadRooms(conn, map.mapId());
        List<RoomCluster> clusters = roomRepository.loadClusters(conn, map.mapId(), rooms);
        Map<Long, Integer> clusterLevels = roomRepository.loadClusterLevels(conn, map.mapId());
        List<Corridor> corridors = corridorRepository.loadByMap(conn, map.mapId(), rooms);
        List<DungeonStair> stairs = stairRepository.loadByMap(conn, map.mapId(), clusters, corridors);
        return new DungeonLayout(
                map.mapId(),
                map.name(),
                corridors,
                clusters,
                stairs,
                transitionRepository.loadByMap(conn, map.mapId()),
                clusterLevels);
    }

    private static DungeonMapCatalogEntry loadMap(Connection conn, long mapId) throws SQLException {
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
                return new DungeonMapCatalogEntry(
                        rs.getLong("dungeon_map_id"),
                        rs.getString("name"));
            }
        }
    }
}
