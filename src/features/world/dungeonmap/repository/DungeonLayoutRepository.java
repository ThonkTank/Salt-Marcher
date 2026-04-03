package features.world.dungeonmap.repository;

import features.world.dungeonmap.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeonmap.catalog.persistence.DungeonMapCatalogRepository;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.sql.Connection;
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
        DungeonStorageSupport.ensureReady(conn);
        List<DungeonMapCatalogEntry> maps = DungeonMapCatalogRepository.listMaps(conn);
        DungeonMapCatalogEntry map = findMap(maps, mapId);
        if (map == null) {
            return null;
        }
        try {
            return loadLayout(conn, map);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    public DungeonLayout loadLayout(Connection conn, DungeonMapCatalogEntry map) throws SQLException {
        if (conn == null) {
            throw new IllegalArgumentException("conn darf nicht null sein");
        }
        DungeonStorageSupport.ensureReady(conn);
        if (map == null) {
            return null;
        }
        return loadLayoutOrThrow(conn, map);
    }

    public DungeonLayout loadFirstUsableLayout(Connection conn) throws SQLException {
        if (conn == null) {
            throw new IllegalArgumentException("conn darf nicht null sein");
        }
        DungeonStorageSupport.ensureReady(conn);
        for (DungeonMapCatalogEntry map : DungeonMapCatalogRepository.listMaps(conn)) {
            if (map == null) {
                continue;
            }
            try {
                return loadLayoutOrThrow(conn, map);
            } catch (RuntimeException exception) {
                // Loading workflows own the user-facing fallback message. The repository only skips unusable maps here.
            }
        }
        return null;
    }

    private DungeonLayout loadLayoutOrThrow(Connection conn, DungeonMapCatalogEntry map) throws SQLException {
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

    private static DungeonMapCatalogEntry findMap(List<DungeonMapCatalogEntry> maps, long mapId) {
        for (DungeonMapCatalogEntry map : maps) {
            if (map.mapId() == mapId) {
                return map;
            }
        }
        return null;
    }
}
