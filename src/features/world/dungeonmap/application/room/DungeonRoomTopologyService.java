package features.world.dungeonmap.application.room;

import features.world.dungeonmap.application.corridor.DungeonCorridorPersistenceService;
import features.world.dungeonmap.application.corridor.DungeonCorridorRoomRewriteService;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.cluster.ClusterRewrite;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorRewriteContext;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.persistence.DungeonRoomGeometryWriteMapper;
import features.world.dungeonmap.persistence.DungeonRoomWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonRoomTopologyService {

    private final DungeonMapLoader mapLoader;
    private final DungeonRoomWriteRepository roomWriteRepository;
    private final DungeonRoomGeometryWriteMapper geometryWriteMapper;
    private final DungeonCorridorPersistenceService corridorPersistenceService;
    private final DungeonCorridorRoomRewriteService corridorRoomRewriteService;

    public DungeonRoomTopologyService(
            DungeonMapLoader mapLoader,
            DungeonRoomWriteRepository roomWriteRepository,
            DungeonRoomGeometryWriteMapper geometryWriteMapper,
            DungeonCorridorPersistenceService corridorPersistenceService,
            DungeonCorridorRoomRewriteService corridorRoomRewriteService
    ) {
        this.mapLoader = Objects.requireNonNull(mapLoader, "mapLoader");
        this.roomWriteRepository = Objects.requireNonNull(roomWriteRepository, "roomWriteRepository");
        this.geometryWriteMapper = Objects.requireNonNull(geometryWriteMapper, "geometryWriteMapper");
        this.corridorPersistenceService = Objects.requireNonNull(corridorPersistenceService, "corridorPersistenceService");
        this.corridorRoomRewriteService = Objects.requireNonNull(corridorRoomRewriteService, "corridorRoomRewriteService");
    }

    public void paint(Connection conn, long mapId, TileShape shape) throws SQLException {
        if (shape == null || shape.size() == 0) {
            return;
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        List<RoomCluster> overlappingClusters = layout.overlappingClusters(shape).stream()
                .sorted(Comparator.comparing(cluster -> cluster.clusterId() == null ? Long.MAX_VALUE : cluster.clusterId()))
                .toList();
        if (overlappingClusters.isEmpty()) {
            createCluster(conn, mapId, shape, nextRoomName(layout, new LinkedHashSet<>()));
            return;
        }

        ClusterRewrite rewrite = overlappingClusters.getFirst().applyPaint(shape, overlappingClusters);
        if (rewrite.isNoOp()) {
            return;
        }

        Map<Long, Corridor> corridorsById = new LinkedHashMap<>(layout.corridorsById());
        Set<Long> affectedCorridorIds = layout.corridorIdsAffectedBy(rewrite);
        // Services orchestrate affected scope and ordering; corridor-local membership rules stay on Corridor.
        corridorsById = corridorRoomRewriteService.applyRoomRewrite(layout, corridorsById, rewrite);
        DungeonLayout rewrittenLayout = layout.applying(rewrite);
        CorridorRewriteContext rewriteContext = new CorridorRewriteContext(
                layout.corridorPlanningInput(),
                rewrittenLayout.corridorPlanningInput(),
                affectedCorridorIds,
                rewrite.deletedClusterIds());
        corridorsById = Corridor.rewriteAll(corridorsById, rewriteContext);

        persistClusterRewrite(conn, mapId, rewrite);
        corridorPersistenceService.persistCorridors(conn, corridorsById);
    }

    public void delete(Connection conn, long mapId, TileShape shape) throws SQLException {
        if (shape == null || shape.size() == 0) {
            return;
        }
        DungeonLayout workingLayout = requireLayout(conn, mapId);
        Map<Long, Corridor> corridorsById = new LinkedHashMap<>(workingLayout.corridorsById());
        Set<String> reservedNames = new LinkedHashSet<>();
        for (Room room : workingLayout.rooms()) {
            if (room != null && room.name() != null && !room.name().isBlank()) {
                reservedNames.add(room.name());
            }
        }

        List<Long> affectedClusterIds = workingLayout.overlappingClusters(shape).stream()
                .map(RoomCluster::clusterId)
                .filter(Objects::nonNull)
                .sorted()
                .toList();
        for (Long clusterId : affectedClusterIds) {
            RoomCluster cluster = workingLayout.findCluster(clusterId);
            if (cluster == null) {
                continue;
            }
            DungeonLayout layoutSnapshot = workingLayout;
            ClusterRewrite rewrite = cluster.applyDelete(shape, () -> nextRoomName(layoutSnapshot, reservedNames));
            if (rewrite.isNoOp()) {
                continue;
            }
            Set<Long> affectedCorridorIds = workingLayout.corridorIdsAffectedBy(rewrite);
            // Services orchestrate the step sequence; reanchor/replan still execute through the corridor rewrite path.
            corridorsById = corridorRoomRewriteService.applyRoomRewrite(workingLayout, corridorsById, rewrite);
            DungeonLayout rewrittenLayout = workingLayout.applying(rewrite);
            CorridorRewriteContext rewriteContext = new CorridorRewriteContext(
                    workingLayout.corridorPlanningInput(),
                    rewrittenLayout.corridorPlanningInput(),
                    affectedCorridorIds,
                    rewrite.deletedClusterIds());
            corridorsById = Corridor.rewriteAll(corridorsById, rewriteContext);

            persistClusterRewrite(conn, mapId, rewrite);
            workingLayout = rewrittenLayout;
        }
        corridorPersistenceService.persistCorridors(conn, corridorsById);
    }

    public void createDefaultRoom(Connection conn, long mapId) throws SQLException {
        createCluster(conn, mapId, TileShape.singleCell(new Point2i(0, 0)), "Eingang");
    }

    public void editBoundary(
            Connection conn,
            long mapId,
            long clusterId,
            VertexEdge edge,
            features.world.dungeonmap.persistence.ClusterBoundaryWrite.Type type,
            boolean deleteBoundary
    ) throws SQLException {
        if (edge == null) {
            return;
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        RoomCluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            return;
        }
        ClusterRewrite rewrite = cluster.editBoundary(edge, type, deleteBoundary);
        if (rewrite == null) {
            return;
        }

        boolean affectsCorridors = !rewrite.affectedRoomIds().isEmpty();
        if (!affectsCorridors) {
            persistClusterRewrite(conn, mapId, rewrite);
            return;
        }

        Map<Long, Corridor> corridorsById = new LinkedHashMap<>(layout.corridorsById());
        Set<Long> affectedCorridorIds = layout.corridorIdsAffectedBy(rewrite);
        corridorsById = corridorRoomRewriteService.applyRoomRewrite(layout, corridorsById, rewrite);
        DungeonLayout rewrittenLayout = layout.applying(rewrite);
        CorridorRewriteContext rewriteContext = new CorridorRewriteContext(
                layout.corridorPlanningInput(),
                rewrittenLayout.corridorPlanningInput(),
                affectedCorridorIds,
                rewrite.deletedClusterIds());
        corridorsById = Corridor.rewriteAll(corridorsById, rewriteContext);

        persistClusterRewrite(conn, mapId, rewrite);
        corridorPersistenceService.persistCorridors(conn, corridorsById);
    }

    private void createCluster(Connection conn, long mapId, TileShape shape, String roomName) throws SQLException {
        long clusterId = roomWriteRepository.insertCluster(conn, mapId, geometryWriteMapper.toClusterGeometry(shape));
        roomWriteRepository.replaceClusterEdges(conn, clusterId, List.of());
        roomWriteRepository.insertRoom(conn, mapId, clusterId, roomName, shape.centerCell());
    }

    private void persistClusterRewrite(Connection conn, long mapId, ClusterRewrite rewrite) throws SQLException {
        if (rewrite == null || rewrite.targetClusterId() == null) {
            return;
        }
        for (Long roomId : rewrite.deletedRoomIds()) {
            if (roomId != null) {
                roomWriteRepository.deleteRoom(conn, roomId);
            }
        }
        if (rewrite.deletesCluster()) {
            roomWriteRepository.deleteCluster(conn, rewrite.targetClusterId());
            return;
        }
        roomWriteRepository.updateClusterGeometry(
                conn,
                rewrite.targetClusterId(),
                geometryWriteMapper.toClusterGeometry(rewrite.clusterShape()));
        roomWriteRepository.replaceClusterEdges(conn, rewrite.targetClusterId(), rewrite.persistedBoundaries());
        for (Room room : rewrite.rooms()) {
            if (room == null) {
                continue;
            }
            if (room.roomId() == null) {
                long roomId = roomWriteRepository.insertRoom(
                        conn,
                        mapId,
                        rewrite.targetClusterId(),
                        room.name(),
                        room.floor().shape().centerCell());
                if (roomId <= 0) {
                    throw new SQLException("Raum konnte nicht angelegt werden");
                }
                continue;
            }
            roomWriteRepository.reassignRoomCluster(conn, room.roomId(), rewrite.targetClusterId());
            roomWriteRepository.updateRoom(conn, room.roomId(), room.name(), room.floor().shape().centerCell());
        }
        for (Long deletedClusterId : rewrite.deletedClusterIds()) {
            if (deletedClusterId != null && !deletedClusterId.equals(rewrite.targetClusterId())) {
                roomWriteRepository.deleteCluster(conn, deletedClusterId);
            }
        }
    }

    private static String nextRoomName(DungeonLayout layout, Set<String> reservedNames) {
        Set<String> used = new LinkedHashSet<>(reservedNames);
        for (Room room : layout.rooms()) {
            if (room != null && room.name() != null && !room.name().isBlank()) {
                used.add(room.name());
            }
        }
        int next = 1;
        while (used.contains("Raum " + next)) {
            next++;
        }
        String result = "Raum " + next;
        used.add(result);
        reservedNames.add(result);
        return result;
    }

    private DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        DungeonLayout layout = mapLoader.loadLayout(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }
}
