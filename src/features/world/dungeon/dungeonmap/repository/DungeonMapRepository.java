package features.world.dungeon.dungeonmap.repository;

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
     * Parent-owned room rewrite persistence for cluster commits. Reloading the authoritative map stays a separate
     * map-owner step so the cluster tail can normalize room fallout before rebound reconciliation.
     */
    public void persistClusterRewriteRooms(
            Connection conn,
            features.world.dungeon.dungeonmap.state.PersistClusterRewriteRoomsState state
    ) throws SQLException {
        requireConnection(conn);
        features.world.dungeon.dungeonmap.state.PersistClusterRewriteRoomsState resolvedState =
                features.world.dungeon.dungeonmap.state.PersistClusterRewriteRoomsState.persistClusterRewriteRooms(state);
        if (resolvedState.rewrittenClusters().isEmpty() && resolvedState.removedRoomIds().isEmpty()) {
            return;
        }
        roomRepository.deleteRooms(conn, resolvedState.removedRoomIds());
        for (features.world.dungeon.dungeonmap.state.PersistClusterRewriteRoomsState.ClusterState cluster : resolvedState.rewrittenClusters()) {
            roomRepository.saveRooms(
                    conn,
                    resolvedState.mapId(),
                    cluster.clusterId(),
                    cluster.rooms().stream()
                            .map(DungeonMapRepository::roomStateToRoom)
                            .toList());
        }
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

    private static features.world.dungeon.model.structures.room.Room roomStateToRoom(
            features.world.dungeon.dungeonmap.state.PersistClusterRewriteRoomsState.RoomState room
    ) {
        java.util.LinkedHashMap<Integer, features.world.dungeon.geometry.GridPoint> anchorsByLevel = new java.util.LinkedHashMap<>();
        for (features.world.dungeon.dungeonmap.state.PersistClusterRewriteRoomsState.LevelAnchorState anchor : room.levelAnchors()) {
            anchorsByLevel.put(anchor.levelZ(), new features.world.dungeon.geometry.GridPoint(anchor.anchorX2(), anchor.anchorY2(), anchor.levelZ()));
        }
        List<features.world.dungeon.model.structures.room.RoomExitNarration> exitNarrations = room.exitNarrations().stream()
                .map(exitNarration -> new features.world.dungeon.model.structures.room.RoomExitNarration(
                        exitNarration.levelZ(),
                        new features.world.dungeon.geometry.GridPoint(
                                exitNarration.roomCellX() * 2,
                                exitNarration.roomCellY() * 2,
                                exitNarration.levelZ()),
                        features.world.dungeon.geometry.CardinalDirection.valueOf(exitNarration.direction()),
                        exitNarration.description()))
                .toList();
        return new features.world.dungeon.model.structures.room.Room(
                room.roomId(),
                room.name(),
                anchorsByLevel,
                new features.world.dungeon.model.structures.room.RoomNarration(
                        room.visualDescription(),
                        exitNarrations));
    }
}
