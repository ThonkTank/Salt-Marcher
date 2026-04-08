package features.world.dungeon.dungeonmap.repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Repository-owned dungeon-map rehydration from direct persisted structure owners.
 *
 * <p>Selection and fallback policy belong to loading workflows. This repository only assembles the authoritative map
 * snapshot for a requested persisted map.
 */
public final class DungeonMapRepository {

    private final features.world.dungeon.dungeonmap.cluster.repository.DungeonClusterRepository clusterRepository;
    private final features.world.dungeon.repository.DungeonRoomRepository roomRepository;
    private final features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository corridorRepository;
    private final features.world.dungeon.repository.DungeonStairRepository stairRepository;
    private final features.world.dungeon.repository.DungeonTransitionRepository transitionRepository;
    private final features.world.dungeon.dungeonmap.application.DungeonMapApplicationService mapApplicationService;

    public DungeonMapRepository() {
        this(
                new features.world.dungeon.dungeonmap.cluster.repository.DungeonClusterRepository(),
                new features.world.dungeon.repository.DungeonRoomRepository(),
                new features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository(),
                new features.world.dungeon.repository.DungeonStairRepository(),
                new features.world.dungeon.repository.DungeonTransitionRepository(),
                new features.world.dungeon.dungeonmap.application.DungeonMapApplicationService());
    }

    public DungeonMapRepository(
            features.world.dungeon.dungeonmap.cluster.repository.DungeonClusterRepository clusterRepository,
            features.world.dungeon.repository.DungeonRoomRepository roomRepository,
            features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository corridorRepository,
            features.world.dungeon.repository.DungeonStairRepository stairRepository,
            features.world.dungeon.repository.DungeonTransitionRepository transitionRepository,
            features.world.dungeon.dungeonmap.application.DungeonMapApplicationService mapApplicationService
    ) {
        this.clusterRepository = java.util.Objects.requireNonNull(clusterRepository, "clusterRepository");
        this.roomRepository = java.util.Objects.requireNonNull(roomRepository, "roomRepository");
        this.corridorRepository = java.util.Objects.requireNonNull(corridorRepository, "corridorRepository");
        this.stairRepository = java.util.Objects.requireNonNull(stairRepository, "stairRepository");
        this.transitionRepository = java.util.Objects.requireNonNull(transitionRepository, "transitionRepository");
        this.mapApplicationService = java.util.Objects.requireNonNull(mapApplicationService, "mapApplicationService");
    }

    public features.world.dungeon.dungeonmap.model.DungeonMap loadMap(Connection conn, long mapId) throws SQLException {
        requireConnection(conn);
        String mapName = loadMapName(conn, mapId);
        if (mapName == null) {
            return null;
        }
        return loadMap(conn, new features.world.dungeon.catalog.application.DungeonMapCatalogEntry(mapId, mapName));
    }

    public features.world.dungeon.dungeonmap.model.DungeonMap loadMap(Connection conn, features.world.dungeon.catalog.application.DungeonMapCatalogEntry map) throws SQLException {
        requireConnection(conn);
        if (map == null || map.mapId() <= 0) {
            return null;
        }
        return loadMap(conn, map.mapId(), map.name());
    }

    /**
     * Parent-owned rewrite tail for cluster commits: room metadata stays in the room owner, then the canonical
     * map repository rebuilds one authoritative snapshot from persisted owners.
     */
    public features.world.dungeon.dungeonmap.model.DungeonMap persistClusterRoomRewriteAndReload(
            Connection conn,
            long mapId,
            features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest,
            List<Long> persistedClusterIds
    ) throws SQLException {
        requireConnection(conn);
        if (mapId <= 0 || rewriteRequest == null || !rewriteRequest.hasAffectedRooms()) {
            return loadMap(conn, mapId);
        }
        List<features.world.dungeon.dungeonmap.cluster.model.Cluster> finalClusters = normalizedClusters(rewriteRequest.rewrittenClusters());
        List<Long> resolvedClusterIds = persistedClusterIds == null ? List.of() : List.copyOf(persistedClusterIds);
        if (finalClusters.size() != resolvedClusterIds.size()) {
            throw new IllegalArgumentException("Persisted cluster ids must match rewritten clusters");
        }

        Set<Long> finalRoomIds = roomIds(finalClusters);
        List<Long> removedRoomIds = new ArrayList<>();
        for (Long roomId : roomIds(normalizedClusters(rewriteRequest.originalClusters()))) {
            if (roomId != null && !finalRoomIds.contains(roomId)) {
                removedRoomIds.add(roomId);
            }
        }
        roomRepository.deleteRooms(conn, removedRoomIds);
        for (int i = 0; i < finalClusters.size(); i++) {
            roomRepository.saveRooms(conn, mapId, resolvedClusterIds.get(i), finalClusters.get(i).roomTopology().rooms());
        }
        return loadMap(conn, mapId);
    }

    private features.world.dungeon.dungeonmap.model.DungeonMap loadMap(Connection conn, long mapId, String mapName) throws SQLException {
        List<features.world.dungeon.model.structures.room.Room> roomMetadata = roomRepository.loadRooms(conn, mapId);
        List<features.world.dungeon.dungeonmap.cluster.model.Cluster> clusters = clusterRepository.loadClusters(conn, mapId, roomMetadata);
        Map<Long, Integer> clusterLevels = clusterRepository.loadClusterLevels(conn, mapId);
        features.world.dungeon.dungeonmap.model.DungeonMap roomMap = new features.world.dungeon.dungeonmap.model.DungeonMap(mapId, mapName, List.of(), clusters, List.of(), List.of(), clusterLevels);
        List<features.world.dungeon.dungeonmap.corridor.model.Corridor> corridors = corridorRepository.loadByMap(conn, mapId).stream()
                .map(data -> mapApplicationService.rehydrateCorridor(
                        new features.world.dungeon.dungeonmap.api.RehydrateCorridorRequest(roomMap, data.input(), data.structure())))
                .toList();
        features.world.dungeon.dungeonmap.model.DungeonMap structureMap = new features.world.dungeon.dungeonmap.model.DungeonMap(
                mapId,
                mapName,
                corridors,
                clusters,
                stairRepository.loadByMap(conn, mapId),
                List.of(),
                clusterLevels);
        return new features.world.dungeon.dungeonmap.model.DungeonMap(
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

    private static List<features.world.dungeon.dungeonmap.cluster.model.Cluster> normalizedClusters(List<features.world.dungeon.dungeonmap.cluster.model.Cluster> clusters) {
        if (clusters == null || clusters.isEmpty()) {
            return List.of();
        }
        List<features.world.dungeon.dungeonmap.cluster.model.Cluster> result = new ArrayList<>();
        Set<Long> seenClusterIds = new LinkedHashSet<>();
        for (features.world.dungeon.dungeonmap.cluster.model.Cluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            if (cluster.clusterId() == null) {
                result.add(cluster);
                continue;
            }
            if (seenClusterIds.add(cluster.clusterId())) {
                result.add(cluster);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Set<Long> roomIds(Collection<features.world.dungeon.dungeonmap.cluster.model.Cluster> clusters) {
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (features.world.dungeon.dungeonmap.cluster.model.Cluster cluster : clusters == null ? List.<features.world.dungeon.dungeonmap.cluster.model.Cluster>of() : clusters) {
            if (cluster == null) {
                continue;
            }
            for (features.world.dungeon.model.structures.room.Room room : cluster.roomTopology().rooms()) {
                if (room != null && room.roomId() != null) {
                    result.add(room.roomId());
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
