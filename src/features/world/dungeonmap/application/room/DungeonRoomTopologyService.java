package features.world.dungeonmap.application.room;

import features.world.dungeonmap.application.corridor.DungeonCorridorBindingReanchorService;
import features.world.dungeonmap.application.corridor.DungeonCorridorRoomReconcileService;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.structures.cluster.ClusterRewrite;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;
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
    private final DungeonCorridorWriteRepository corridorWriteRepository;
    private final DungeonCorridorRoomReconcileService corridorRoomReconcileService;
    private final DungeonCorridorBindingReanchorService corridorBindingReanchorService;

    public DungeonRoomTopologyService(
            DungeonMapLoader mapLoader,
            DungeonRoomWriteRepository roomWriteRepository,
            DungeonRoomGeometryWriteMapper geometryWriteMapper,
            DungeonCorridorWriteRepository corridorWriteRepository,
            DungeonCorridorRoomReconcileService corridorRoomReconcileService,
            DungeonCorridorBindingReanchorService corridorBindingReanchorService
    ) {
        this.mapLoader = Objects.requireNonNull(mapLoader, "mapLoader");
        this.roomWriteRepository = Objects.requireNonNull(roomWriteRepository, "roomWriteRepository");
        this.geometryWriteMapper = Objects.requireNonNull(geometryWriteMapper, "geometryWriteMapper");
        this.corridorWriteRepository = Objects.requireNonNull(corridorWriteRepository, "corridorWriteRepository");
        this.corridorRoomReconcileService = Objects.requireNonNull(corridorRoomReconcileService, "corridorRoomReconcileService");
        this.corridorBindingReanchorService = Objects.requireNonNull(corridorBindingReanchorService, "corridorBindingReanchorService");
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
        Long mergedReplacementRoomId = mergedReplacementRoomId(rewrite);
        if (mergedReplacementRoomId != null && !rewrite.mergedRoomIds().isEmpty()) {
            corridorsById = corridorRoomReconcileService.reassignMergedRoomCorridors(
                    corridorsById,
                    rewrite.mergedRoomIds(),
                    mergedReplacementRoomId);
        }

        DungeonLayout rewrittenLayout = layout.applying(rewrite);
        corridorsById = corridorBindingReanchorService.reanchorBindings(
                layout,
                rewrittenLayout,
                corridorsById,
                rewrite.affectedRoomIds(),
                rewrite.affectedClusterIds(),
                rewrite.deletedClusterIds());
        corridorsById = replanCorridors(rewrittenLayout, corridorsById);

        persistClusterRewrite(conn, mapId, rewrite);
        persistCorridors(conn, corridorsById);
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
            for (Long deletedRoomId : rewrite.deletedRoomIds()) {
                corridorsById = corridorRoomReconcileService.removeRoomFromCorridors(corridorsById, deletedRoomId);
            }
            for (Map.Entry<Long, List<Room>> entry : rewrite.splitFragmentsBySourceRoomId().entrySet()) {
                if (entry.getValue().size() > 1) {
                    corridorsById = corridorRoomReconcileService.reconcileSplitRoomCorridors(
                            workingLayout,
                            corridorsById,
                            entry.getKey(),
                            entry.getValue());
                }
            }

            DungeonLayout rewrittenLayout = workingLayout.applying(rewrite);
            corridorsById = corridorBindingReanchorService.reanchorBindings(
                    workingLayout,
                    rewrittenLayout,
                    corridorsById,
                    rewrite.affectedRoomIds(),
                    rewrite.affectedClusterIds(),
                    rewrite.deletedClusterIds());
            corridorsById = replanCorridors(rewrittenLayout, corridorsById);

            persistClusterRewrite(conn, mapId, rewrite);
            workingLayout = rewrittenLayout;
        }
        persistCorridors(conn, corridorsById);
    }

    public void createDefaultRoom(Connection conn, long mapId) throws SQLException {
        createCluster(conn, mapId, TileShape.singleCell(new Point2i(0, 0)), "Eingang");
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

    private Map<Long, Corridor> replanCorridors(DungeonLayout layout, Map<Long, Corridor> corridorsById) {
        Map<Long, Corridor> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Corridor> entry : corridorsById.entrySet()) {
            Corridor corridor = entry.getValue();
            result.put(entry.getKey(), corridor == null ? null : corridor.replanned(layout.corridorPlanningInput()));
        }
        return Map.copyOf(result);
    }

    private void persistCorridors(Connection conn, Map<Long, Corridor> corridorsById) throws SQLException {
        for (Corridor corridor : corridorsById.values()) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            if (!corridor.isPersistable()) {
                corridorWriteRepository.deleteCorridor(conn, corridor.corridorId());
                continue;
            }
            corridorWriteRepository.replaceCorridorRooms(conn, corridor.corridorId(), corridor.roomIds());
            corridorWriteRepository.replaceCorridorWaypoints(conn, corridor.corridorId(), corridor.bindings().waypoints());
            corridorWriteRepository.replaceCorridorDoorBindings(conn, corridor.corridorId(), corridor.bindings().doorBindings());
        }
    }

    private static Long mergedReplacementRoomId(ClusterRewrite rewrite) {
        Set<Long> replacementIds = rewrite.replacedRoomIds().entrySet().stream()
                .filter(entry -> rewrite.mergedRoomIds().contains(entry.getKey()))
                .map(Map.Entry::getValue)
                .filter(Objects::nonNull)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        return replacementIds.size() == 1 ? replacementIds.iterator().next() : null;
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
