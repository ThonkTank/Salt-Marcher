package features.world.dungeon.dungeonmap.corridor.repository;

import database.DatabaseManager;
import features.world.dungeon.dungeonmap.corridor.state.PersistReboundCorridorsState;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Canonical corridor-owned rebound persistence boundary for corridor rows and authored input-network metadata only.
 * Structure persistence stays outside this repository so the successor slice does not canonize the legacy combined
 * save path.
 */
@SuppressWarnings("unused")
public final class PersistReboundCorridorsRepository {

    private PersistReboundCorridorsRepository() {
    }

    public static PersistReboundCorridorsState persistReboundCorridors(
            PersistReboundCorridorsState state
    ) throws SQLException {
        PersistReboundCorridorsState resolvedState = PersistReboundCorridorsState.persistReboundCorridors(state);
        if (resolvedState.corridors().isEmpty()) {
            return resolvedState;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return features.world.dungeon.application.support.DungeonTransactionRunner.inTransaction(conn, () -> {
                ArrayList<PersistReboundCorridorsState.CorridorState> persistedCorridors = new ArrayList<>();
                for (PersistReboundCorridorsState.CorridorState corridor : resolvedState.corridors()) {
                    persistedCorridors.add(persistCorridor(conn, resolvedState.mapId(), corridor));
                }
                return new PersistReboundCorridorsState(resolvedState.mapId(), persistedCorridors);
            });
        }
    }

    private static PersistReboundCorridorsState.CorridorState persistCorridor(
            Connection conn,
            long mapId,
            PersistReboundCorridorsState.CorridorState corridor
    ) throws SQLException {
        long structureObjectId = requireStructureObjectId(corridor.structureObjectId());
        Long corridorId = corridor.corridorId();
        if (corridorId == null) {
            corridorId = insertCorridor(conn, mapId, structureObjectId, corridor.levelZ());
        } else {
            updateCorridor(conn, corridorId, structureObjectId, corridor.levelZ());
        }
        PersistReboundCorridorsState.CorridorState persistedCorridor = assignPersistentIds(conn, corridorId, corridor);
        replaceNodes(conn, corridorId, persistedCorridor.nodes());
        replaceSegments(conn, corridorId, persistedCorridor.segments());
        return persistedCorridor;
    }

    private static long insertCorridor(
            Connection conn,
            long mapId,
            long structureObjectId,
            int levelZ
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_corridors(dungeon_map_id, structure_object_id, level_z) VALUES(?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, structureObjectId);
            ps.setInt(3, levelZ);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_corridors insert");
                }
                return rs.getLong(1);
            }
        }
    }

    private static void updateCorridor(
            Connection conn,
            long corridorId,
            long structureObjectId,
            int levelZ
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_corridors SET structure_object_id=?, level_z=? WHERE corridor_id=?")) {
            ps.setLong(1, structureObjectId);
            ps.setInt(2, levelZ);
            ps.setLong(3, corridorId);
            ps.executeUpdate();
        }
    }

    private static void replaceNodes(
            Connection conn,
            long corridorId,
            List<PersistReboundCorridorsState.NodeState> nodes
    ) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_input_nodes WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_input_nodes(node_id, corridor_id, door_id, point_x2, point_y2)"
                        + " VALUES(?,?,?,?,?)")) {
            for (PersistReboundCorridorsState.NodeState node : sanitizedNodes(nodes)) {
                insert.setLong(1, requireId(node.nodeId(), "corridor node"));
                insert.setLong(2, corridorId);
                if (node.doorId() == null) {
                    insert.setNull(3, java.sql.Types.BIGINT);
                    insert.setInt(4, requireCoordinate(node.pointX2(), "pointX2"));
                    insert.setInt(5, requireCoordinate(node.pointY2(), "pointY2"));
                } else {
                    insert.setLong(3, node.doorId());
                    insert.setNull(4, java.sql.Types.INTEGER);
                    insert.setNull(5, java.sql.Types.INTEGER);
                }
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void replaceSegments(
            Connection conn,
            long corridorId,
            List<PersistReboundCorridorsState.SegmentState> segments
    ) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_input_segments WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_input_segments(segment_id, corridor_id, start_node_id, end_node_id)"
                        + " VALUES(?,?,?,?)")) {
            for (PersistReboundCorridorsState.SegmentState segment : sanitizedSegments(segments)) {
                insert.setLong(1, requireId(segment.segmentId(), "corridor segment"));
                insert.setLong(2, corridorId);
                insert.setLong(3, requireId(segment.startNodeId(), "corridor node"));
                insert.setLong(4, requireId(segment.endNodeId(), "corridor node"));
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static PersistReboundCorridorsState.CorridorState assignPersistentIds(
            Connection conn,
            long corridorId,
            PersistReboundCorridorsState.CorridorState corridor
    ) throws SQLException {
        long nextNodeId = nextId(conn, "dungeon_corridor_input_nodes", "node_id");
        long nextSegmentId = nextId(conn, "dungeon_corridor_input_segments", "segment_id");
        ArrayList<PersistReboundCorridorsState.NodeState> nodes = new ArrayList<>();
        ArrayList<Long> generatedNodeIds = new ArrayList<>();
        ArrayList<Map.Entry<Long, Long>> nodeIdRemaps = new ArrayList<>();
        for (PersistReboundCorridorsState.NodeState node : corridor.nodes()) {
            Long nodeId = node.nodeId();
            if (nodeId == null || nodeId <= 0) {
                nodeId = nextNodeId + generatedNodeIds.size();
                generatedNodeIds.add(nodeId);
            }
            if (node.nodeId() != null && node.nodeId() <= 0) {
                nodeIdRemaps.add(Map.entry(node.nodeId(), nodeId));
            }
            nodes.add(new PersistReboundCorridorsState.NodeState(nodeId, node.doorId(), node.pointX2(), node.pointY2()));
        }
        ArrayList<PersistReboundCorridorsState.SegmentState> segments = new ArrayList<>();
        ArrayList<Long> generatedSegmentIds = new ArrayList<>();
        for (PersistReboundCorridorsState.SegmentState segment : corridor.segments()) {
            Long segmentId = segment.segmentId();
            if (segmentId == null || segmentId <= 0) {
                segmentId = nextSegmentId + generatedSegmentIds.size();
                generatedSegmentIds.add(segmentId);
            }
            segments.add(new PersistReboundCorridorsState.SegmentState(
                    segmentId,
                    remapNodeId(segment.startNodeId(), nodeIdRemaps),
                    remapNodeId(segment.endNodeId(), nodeIdRemaps)));
        }
        return new PersistReboundCorridorsState.CorridorState(
                corridorId,
                corridor.structureObjectId(),
                corridor.levelZ(),
                List.copyOf(nodes),
                List.copyOf(segments));
    }

    private static Long remapNodeId(Long nodeId, List<Map.Entry<Long, Long>> remaps) {
        if (nodeId == null) {
            return null;
        }
        for (Map.Entry<Long, Long> remap : remaps) {
            if (nodeId.equals(remap.getKey())) {
                return remap.getValue();
            }
        }
        return nodeId;
    }

    private static long nextId(Connection conn, String table, String column) throws SQLException {
        String sql = "SELECT COALESCE(MAX(" + column + "), 0) + 1 FROM " + table;
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return rs.next() ? rs.getLong(1) : 1L;
        }
    }

    private static List<PersistReboundCorridorsState.NodeState> sanitizedNodes(
            List<PersistReboundCorridorsState.NodeState> nodes
    ) {
        if (nodes == null || nodes.isEmpty()) {
            return List.of();
        }
        return nodes.stream()
                .filter(node -> node != null)
                .sorted(Comparator.comparing(node -> node.nodeId() == null ? Long.MAX_VALUE : node.nodeId()))
                .toList();
    }

    private static List<PersistReboundCorridorsState.SegmentState> sanitizedSegments(
            List<PersistReboundCorridorsState.SegmentState> segments
    ) {
        if (segments == null || segments.isEmpty()) {
            return List.of();
        }
        return segments.stream()
                .filter(segment -> segment != null)
                .sorted(Comparator.comparing(segment -> segment.segmentId() == null ? Long.MAX_VALUE : segment.segmentId()))
                .toList();
    }

    private static long requireStructureObjectId(Long structureObjectId) {
        if (structureObjectId == null || structureObjectId <= 0) {
            throw new IllegalArgumentException("structureObjectId");
        }
        return structureObjectId;
    }

    private static int requireCoordinate(Integer coordinate, String label) {
        if (coordinate == null) {
            throw new IllegalArgumentException(label);
        }
        return coordinate;
    }

    private static long requireId(Long id, String label) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException(label);
        }
        return id;
    }

}
