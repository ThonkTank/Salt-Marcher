package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.LegacyGridPoint2x;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.model.structures.corridor.CorridorSegment;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

public final class DungeonCorridorWriteRepository {

    public long nextNodeId(Connection conn) throws SQLException {
        return nextId(conn, "dungeon_corridor_nodes", "corridor_node_id");
    }

    public long nextSegmentId(Connection conn) throws SQLException {
        return nextId(conn, "dungeon_corridor_segments", "corridor_segment_id");
    }

    public long insertCorridor(Connection conn, long mapId, Corridor corridor) throws SQLException {
        Corridor resolvedCorridor = Objects.requireNonNull(corridor, "corridor");
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_corridors(dungeon_map_id, level_z) VALUES(?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setInt(2, resolvedCorridor.levelZ());
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_corridors insert");
                }
                return rs.getLong(1);
            }
        }
    }

    public void updateCorridor(Connection conn, long corridorId, Corridor corridor) throws SQLException {
        Corridor resolvedCorridor = Objects.requireNonNull(corridor, "corridor");
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_corridors SET level_z=? WHERE corridor_id=?")) {
            ps.setInt(1, resolvedCorridor.levelZ());
            ps.setLong(2, corridorId);
            ps.executeUpdate();
        }
    }

    public void replaceNodes(Connection conn, long corridorId, List<CorridorNode> nodes) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_nodes WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_nodes("
                        + "corridor_node_id, corridor_id, grid_x2, grid_y2, room_id, room_relative_cell_x, room_relative_cell_y, room_edge_direction"
                        + ") VALUES(?,?,?,?,?,?,?,?)")) {
            for (CorridorNode node : sanitizedNodes(nodes)) {
                bindNode(insert, corridorId, node);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void replaceSegments(Connection conn, long corridorId, List<CorridorSegment> segments) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_segments WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_segments(corridor_segment_id, corridor_id, start_node_id, end_node_id) VALUES(?,?,?,?)")) {
            for (CorridorSegment segment : sanitizedSegments(segments)) {
                insert.setLong(1, requiredId(segment.segmentId(), "corridor segment"));
                insert.setLong(2, corridorId);
                insert.setLong(3, segment.startNodeId());
                insert.setLong(4, segment.endNodeId());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void deleteCorridor(Connection conn, long corridorId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_corridors WHERE corridor_id=?")) {
            ps.setLong(1, corridorId);
            ps.executeUpdate();
        }
    }

    private static void bindNode(PreparedStatement ps, long corridorId, CorridorNode node) throws SQLException {
        ps.setLong(1, requiredId(node.nodeId(), "corridor node"));
        ps.setLong(2, corridorId);
        ps.setInt(3, node.point2x().x2());
        ps.setInt(4, node.point2x().y2());
        if (node.roomId() == null) {
            ps.setObject(5, null);
            ps.setObject(6, null);
            ps.setObject(7, null);
            ps.setObject(8, null);
        } else {
            ps.setLong(5, node.roomId());
            ps.setInt(6, node.roomRelativeCell().x());
            ps.setInt(7, node.roomRelativeCell().y());
            ps.setString(8, node.roomBoundaryDirection().name());
        }
    }

    private static long requiredId(Long id, String label) {
        if (id == null) {
            throw new IllegalArgumentException(label + " id is required for persistence");
        }
        return id;
    }

    private static long nextId(Connection conn, String table, String column) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT COALESCE(MAX(" + column + "), 0) + 1 FROM " + table);
             ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                throw new SQLException("No next id returned for " + table);
            }
            return rs.getLong(1);
        }
    }

    private static List<CorridorNode> sanitizedNodes(List<CorridorNode> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            return List.of();
        }
        ArrayList<CorridorNode> result = new ArrayList<>();
        for (CorridorNode node : nodes) {
            if (node != null) {
                result.add(node);
            }
        }
        result.sort(Comparator
                .comparing((CorridorNode node) -> node.nodeId() == null ? Long.MAX_VALUE : node.nodeId())
                .thenComparing(CorridorNode::point2x, LegacyGridPoint2x.POINT_ORDER));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<CorridorSegment> sanitizedSegments(List<CorridorSegment> segments) {
        if (segments == null || segments.isEmpty()) {
            return List.of();
        }
        ArrayList<CorridorSegment> result = new ArrayList<>();
        for (CorridorSegment segment : segments) {
            if (segment != null) {
                result.add(segment);
            }
        }
        result.sort(Comparator
                .comparing((CorridorSegment segment) -> segment.segmentId() == null ? Long.MAX_VALUE : segment.segmentId())
                .thenComparing(CorridorSegment::startNodeId)
                .thenComparing(CorridorSegment::endNodeId));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }
}
