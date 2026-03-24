package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import features.world.dungeonmap.model.structures.room.RoomNarration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DungeonRoomWriteRepository {

    public long insertCluster(Connection conn, long mapId, ClusterGeometryWrite geometry) throws SQLException {
        return insertCluster(conn, mapId, geometry, 0);
    }

    public long insertCluster(Connection conn, long mapId, ClusterGeometryWrite geometry, int levelZ) throws SQLException {
        ClusterGeometryWrite resolvedGeometry = geometry == null
                ? new ClusterGeometryWrite(new Point2i(0, 0), Map.of())
                : geometry;
        long clusterId;
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_room_clusters(dungeon_map_id, center_x, center_y, level_z) VALUES(?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setInt(2, resolvedGeometry.center().x());
            ps.setInt(3, resolvedGeometry.center().y());
            ps.setInt(4, levelZ);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_room_clusters insert");
                }
                clusterId = rs.getLong(1);
            }
        }
        replaceClusterVertices(conn, clusterId, resolvedGeometry.relativeVerticesByLevel());
        return clusterId;
    }

    public void updateClusterGeometry(Connection conn, long clusterId, ClusterGeometryWrite geometry) throws SQLException {
        updateClusterGeometry(conn, clusterId, geometry, primaryLevel(geometry == null ? Map.of() : geometry.relativeVerticesByLevel(), 0));
    }

    public void updateClusterGeometry(Connection conn, long clusterId, ClusterGeometryWrite geometry, int levelZ) throws SQLException {
        ClusterGeometryWrite resolvedGeometry = geometry == null
                ? new ClusterGeometryWrite(new Point2i(0, 0), Map.of())
                : geometry;
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_room_clusters SET center_x=?, center_y=?, level_z=? WHERE cluster_id=?")) {
            ps.setInt(1, resolvedGeometry.center().x());
            ps.setInt(2, resolvedGeometry.center().y());
            ps.setInt(3, levelZ);
            ps.setLong(4, clusterId);
            ps.executeUpdate();
        }
        replaceClusterVertices(conn, clusterId, resolvedGeometry.relativeVerticesByLevel());
    }

    public void deleteCluster(Connection conn, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_room_clusters WHERE cluster_id=?")) {
            ps.setLong(1, clusterId);
            ps.executeUpdate();
        }
    }

    public void replaceClusterEdges(
            Connection conn,
            long clusterId,
            Point2i clusterCenter,
            int levelZ,
            List<ClusterBoundaryWrite> boundaries
    ) throws SQLException {
        List<ClusterBoundaryWrite> sanitized = boundaries == null ? List.of() : boundaries.stream()
                .filter(java.util.Objects::nonNull)
                .toList();
        Point2i resolvedCenter = clusterCenter == null ? new Point2i(0, 0) : clusterCenter;
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_cluster_edges WHERE cluster_id=? AND level_z=?")) {
            delete.setLong(1, clusterId);
            delete.setInt(2, levelZ);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_cluster_edges(cluster_id, level_z, cell_x, cell_y, edge_direction, edge_type)"
                        + " VALUES(?,?,?,?,?,?)")) {
            for (ClusterBoundaryWrite boundary : sanitized) {
                Point2i relativeCell = boundary.cell().subtract(resolvedCenter);
                insert.setLong(1, clusterId);
                insert.setInt(2, levelZ);
                insert.setInt(3, relativeCell.x());
                insert.setInt(4, relativeCell.y());
                insert.setString(5, directionName(boundary.direction()));
                insert.setString(6, boundary.type().name());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void replaceClusterEdges(
            Connection conn,
            long clusterId,
            Point2i clusterCenter,
            Map<Integer, List<ClusterBoundaryWrite>> boundariesByLevel
    ) throws SQLException {
        Map<Integer, List<ClusterBoundaryWrite>> resolvedBoundariesByLevel = boundariesByLevel == null ? Map.of() : Map.copyOf(boundariesByLevel);
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_cluster_edges WHERE cluster_id=?")) {
            delete.setLong(1, clusterId);
            delete.executeUpdate();
        }
        for (Map.Entry<Integer, List<ClusterBoundaryWrite>> entry : resolvedBoundariesByLevel.entrySet()) {
            if (entry == null || entry.getKey() == null) {
                continue;
            }
            replaceClusterEdges(conn, clusterId, clusterCenter, entry.getKey(), entry.getValue());
        }
    }

    public long insertRoom(Connection conn, long mapId, long clusterId, String name, Point2i anchor) throws SQLException {
        return insertRoom(conn, mapId, clusterId, name, anchor, 0);
    }

    public long insertRoom(Connection conn, long mapId, long clusterId, String name, Point2i anchor, int levelZ) throws SQLException {
        return insertRoom(conn, mapId, clusterId, name, Map.of(levelZ, anchor), levelZ);
    }

    public long insertRoom(
            Connection conn,
            long mapId,
            long clusterId,
            String name,
            Map<Integer, Point2i> anchorsByLevel
    ) throws SQLException {
        return insertRoom(conn, mapId, clusterId, name, anchorsByLevel, primaryLevel(anchorsByLevel, 0));
    }

    public long insertRoom(
            Connection conn,
            long mapId,
            long clusterId,
            String name,
            Map<Integer, Point2i> anchorsByLevel,
            int levelZ
    ) throws SQLException {
        Map<Integer, Point2i> resolvedAnchors = normalizedAnchorsByLevel(anchorsByLevel, levelZ);
        Point2i primaryAnchor = resolvedAnchors.getOrDefault(levelZ, new Point2i(0, 0));
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, component_x, component_y, level_z) VALUES(?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, clusterId);
            ps.setString(3, name);
            ps.setInt(4, primaryAnchor.x());
            ps.setInt(5, primaryAnchor.y());
            ps.setInt(6, levelZ);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_rooms insert");
                }
                long roomId = rs.getLong(1);
                replaceRoomFloors(conn, roomId, resolvedAnchors);
                return roomId;
            }
        }
    }

    public void updateRoomPosition(Connection conn, long roomId, Point2i anchor) throws SQLException {
        updateRoomPosition(conn, roomId, Map.of(0, anchor), 0);
    }

    public void updateRoomPosition(Connection conn, long roomId, Map<Integer, Point2i> anchorsByLevel) throws SQLException {
        updateRoomPosition(conn, roomId, anchorsByLevel, primaryLevel(anchorsByLevel, 0));
    }

    public void updateRoomPosition(
            Connection conn,
            long roomId,
            Map<Integer, Point2i> anchorsByLevel,
            int levelZ
    ) throws SQLException {
        Map<Integer, Point2i> resolvedAnchors = normalizedAnchorsByLevel(anchorsByLevel, levelZ);
        Point2i primaryAnchor = resolvedAnchors.getOrDefault(levelZ, new Point2i(0, 0));
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET component_x=?, component_y=?, level_z=? WHERE room_id=?")) {
            ps.setInt(1, primaryAnchor.x());
            ps.setInt(2, primaryAnchor.y());
            ps.setInt(3, levelZ);
            ps.setLong(4, roomId);
            ps.executeUpdate();
        }
        replaceRoomFloors(conn, roomId, resolvedAnchors);
    }

    public void updateRoom(Connection conn, long roomId, String name, Point2i anchor) throws SQLException {
        updateRoom(conn, roomId, name, anchor, 0);
    }

    public void updateRoom(Connection conn, long roomId, String name, Point2i anchor, int levelZ) throws SQLException {
        updateRoom(conn, roomId, name, Map.of(levelZ, anchor), levelZ);
    }

    public void updateRoom(
            Connection conn,
            long roomId,
            String name,
            Map<Integer, Point2i> anchorsByLevel
    ) throws SQLException {
        updateRoom(conn, roomId, name, anchorsByLevel, primaryLevel(anchorsByLevel, 0));
    }

    public void updateRoom(
            Connection conn,
            long roomId,
            String name,
            Map<Integer, Point2i> anchorsByLevel,
            int levelZ
    ) throws SQLException {
        Map<Integer, Point2i> resolvedAnchors = normalizedAnchorsByLevel(anchorsByLevel, levelZ);
        Point2i primaryAnchor = resolvedAnchors.getOrDefault(levelZ, new Point2i(0, 0));
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET name=?, component_x=?, component_y=?, level_z=? WHERE room_id=?")) {
            ps.setString(1, name);
            ps.setInt(2, primaryAnchor.x());
            ps.setInt(3, primaryAnchor.y());
            ps.setInt(4, levelZ);
            ps.setLong(5, roomId);
            ps.executeUpdate();
        }
        replaceRoomFloors(conn, roomId, resolvedAnchors);
    }

    public void replaceRoomNarration(Connection conn, long roomId, RoomNarration narration) throws SQLException {
        RoomNarration resolvedNarration = narration == null ? RoomNarration.empty() : narration;
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET visual_description=? WHERE room_id=?")) {
            ps.setString(1, resolvedNarration.visualDescription());
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_exit_descriptions WHERE room_id=?")) {
            delete.setLong(1, roomId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_exit_descriptions(room_id, cell_x, cell_y, edge_direction, description, sort_order)"
                        + " VALUES(?,?,?,?,?,?)")) {
            int sortOrder = 0;
            for (RoomExitNarration exitNarration : resolvedNarration.exitNarrations()) {
                insert.setLong(1, roomId);
                insert.setInt(2, exitNarration.roomCell().x());
                insert.setInt(3, exitNarration.roomCell().y());
                insert.setString(4, directionName(exitNarration.direction()));
                insert.setString(5, exitNarration.description());
                insert.setInt(6, sortOrder++);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void reassignRoomCluster(Connection conn, long roomId, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET cluster_id=? WHERE room_id=?")) {
            ps.setLong(1, clusterId);
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
    }

    public void deleteRoom(Connection conn, long roomId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_rooms WHERE room_id=?")) {
            ps.setLong(1, roomId);
            ps.executeUpdate();
        }
    }

    public void replaceRoomFloors(Connection conn, long roomId, Map<Integer, Point2i> anchorsByLevel) throws SQLException {
        Map<Integer, Point2i> resolvedAnchors = normalizedAnchorsByLevel(anchorsByLevel, primaryLevel(anchorsByLevel, 0));
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_floors WHERE room_id=?")) {
            delete.setLong(1, roomId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_floors(room_id, level_z, anchor_x, anchor_y) VALUES(?,?,?,?)")) {
            for (Map.Entry<Integer, Point2i> entry : resolvedAnchors.entrySet().stream()
                    .sorted(Map.Entry.comparingByKey())
                    .toList()) {
                insert.setLong(1, roomId);
                insert.setInt(2, entry.getKey());
                insert.setInt(3, entry.getValue().x());
                insert.setInt(4, entry.getValue().y());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private void replaceClusterVertices(Connection conn, long clusterId, Map<Integer, List<Point2i>> relativeVerticesByLevel) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_cluster_vertices WHERE cluster_id=?")) {
            delete.setLong(1, clusterId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_cluster_vertices(cluster_id, level_z, vertex_index, relative_x, relative_y)"
                        + " VALUES(?,?,?,?,?)")) {
            for (Map.Entry<Integer, List<Point2i>> entry : relativeVerticesByLevel.entrySet()) {
                List<Point2i> relativeVertices = entry.getValue() == null ? List.of() : entry.getValue();
                for (int i = 0; i < relativeVertices.size(); i++) {
                    Point2i vertex = relativeVertices.get(i);
                    insert.setLong(1, clusterId);
                    insert.setInt(2, entry.getKey());
                    insert.setInt(3, i);
                    insert.setInt(4, vertex.x());
                    insert.setInt(5, vertex.y());
                    insert.addBatch();
                }
            }
            insert.executeBatch();
        }
    }

    private static Map<Integer, Point2i> normalizedAnchorsByLevel(Map<Integer, Point2i> anchorsByLevel, int fallbackLevel) {
        Map<Integer, Point2i> result = new LinkedHashMap<>();
        if (anchorsByLevel != null) {
            for (Map.Entry<Integer, Point2i> entry : anchorsByLevel.entrySet()) {
                if (entry == null || entry.getKey() == null) {
                    continue;
                }
                result.put(entry.getKey(), entry.getValue() == null ? new Point2i(0, 0) : entry.getValue());
            }
        }
        if (result.isEmpty()) {
            result.put(fallbackLevel, new Point2i(0, 0));
        } else if (!result.containsKey(fallbackLevel)) {
            result.put(fallbackLevel, result.values().iterator().next());
        }
        return Map.copyOf(result);
    }

    private static int primaryLevel(Map<Integer, ?> valuesByLevel, int fallbackLevel) {
        if (valuesByLevel == null || valuesByLevel.isEmpty()) {
            return fallbackLevel;
        }
        return valuesByLevel.keySet().stream()
                .filter(java.util.Objects::nonNull)
                .mapToInt(Integer::intValue)
                .min()
                .orElse(fallbackLevel);
    }

    private static String directionName(Point2i direction) {
        return switch (direction.x() + "," + direction.y()) {
            case "0,-1" -> "NORTH";
            case "1,0" -> "EAST";
            case "0,1" -> "SOUTH";
            case "-1,0" -> "WEST";
            default -> throw new IllegalArgumentException("Unbekannte Kantenrichtung: " + direction);
        };
    }
}
