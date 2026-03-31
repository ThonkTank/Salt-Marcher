package features.world.dungeonmap.application.corridor;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.model.structures.corridor.CorridorSegment;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DungeonCorridorEditService {

    private final DungeonMapLoader mapLoader;
    private final DungeonCorridorWriteRepository corridorWriteRepository;

    public DungeonCorridorEditService(
            DungeonMapLoader mapLoader,
            DungeonCorridorWriteRepository corridorWriteRepository
    ) {
        this.mapLoader = Objects.requireNonNull(mapLoader, "mapLoader");
        this.corridorWriteRepository = Objects.requireNonNull(corridorWriteRepository, "corridorWriteRepository");
    }

    public long create(long mapId, Corridor corridor) throws SQLException {
        if (mapId <= 0 || corridor == null) {
            throw new IllegalArgumentException("Corridor create requires map and corridor");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                Corridor persisted = assignPersistentIds(corridor, layout, conn);
                long corridorId = corridorWriteRepository.insertCorridor(conn, mapId, persisted);
                corridorWriteRepository.replaceNodes(conn, corridorId, persisted.nodes());
                corridorWriteRepository.replaceSegments(conn, corridorId, persisted.segments());
                return corridorId;
            });
        }
    }

    public void update(long mapId, Corridor corridor) throws SQLException {
        if (mapId <= 0 || corridor == null || corridor.corridorId() == null) {
            throw new IllegalArgumentException("Corridor update requires persisted corridor");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                if (layout.findCorridor(corridor.corridorId()) == null) {
                    throw new SQLException("Corridor " + corridor.corridorId() + " existiert nicht");
                }
                Corridor persisted = assignPersistentIds(corridor, layout, conn);
                corridorWriteRepository.updateCorridor(conn, corridor.corridorId(), persisted);
                corridorWriteRepository.replaceNodes(conn, corridor.corridorId(), persisted.nodes());
                corridorWriteRepository.replaceSegments(conn, corridor.corridorId(), persisted.segments());
            });
        }
    }

    public void save(long mapId, Corridor corridor) throws SQLException {
        if (corridor == null) {
            return;
        }
        if (corridor.corridorId() == null) {
            create(mapId, corridor);
        } else {
            update(mapId, corridor);
        }
    }

    public void delete(long mapId, long corridorId) throws SQLException {
        if (mapId <= 0 || corridorId <= 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                if (layout.findCorridor(corridorId) == null) {
                    return;
                }
                corridorWriteRepository.deleteCorridor(conn, corridorId);
            });
        }
    }

    private DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        DungeonLayout layout = mapLoader.loadLayout(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }

    private Corridor assignPersistentIds(Corridor corridor, DungeonLayout layout, Connection conn) throws SQLException {
        long nextNodeId = corridorWriteRepository.nextNodeId(conn);
        long nextSegmentId = corridorWriteRepository.nextSegmentId(conn);
        Map<Long, Long> syntheticNodeIds = new LinkedHashMap<>();
        ArrayList<CorridorNode> nodes = new ArrayList<>();
        for (CorridorNode node : corridor.nodes()) {
            Long persistedNodeId = node.nodeId();
            if (persistedNodeId == null || persistedNodeId <= 0) {
                persistedNodeId = nextNodeId++;
            }
            if (node.nodeId() != null && node.nodeId() <= 0) {
                syntheticNodeIds.put(node.nodeId(), persistedNodeId);
            }
            nodes.add(new CorridorNode(
                    persistedNodeId,
                    node.gridX2(),
                    node.gridY2(),
                    node.roomId(),
                    node.roomRelativeCell(),
                    node.roomBoundaryDirection()));
        }
        ArrayList<CorridorSegment> segments = new ArrayList<>();
        for (CorridorSegment segment : corridor.segments()) {
            Long startNodeId = remapNodeId(segment.startNodeId(), syntheticNodeIds);
            Long endNodeId = remapNodeId(segment.endNodeId(), syntheticNodeIds);
            Long persistedSegmentId = segment.segmentId();
            if (persistedSegmentId == null || persistedSegmentId <= 0) {
                persistedSegmentId = nextSegmentId++;
            }
            segments.add(new CorridorSegment(persistedSegmentId, startNodeId, endNodeId));
        }
        return Corridor.resolved(
                corridor.corridorId(),
                layout.mapId(),
                corridor.levelZ(),
                nodes,
                segments,
                layout.rooms().stream()
                        .filter(room -> room != null && room.roomId() != null)
                        .collect(java.util.stream.Collectors.toMap(room -> room.roomId(), room -> room, (left, right) -> left, LinkedHashMap::new)));
    }

    private static Long remapNodeId(Long nodeId, Map<Long, Long> syntheticNodeIds) {
        if (nodeId == null) {
            return null;
        }
        return syntheticNodeIds.getOrDefault(nodeId, nodeId);
    }
}
