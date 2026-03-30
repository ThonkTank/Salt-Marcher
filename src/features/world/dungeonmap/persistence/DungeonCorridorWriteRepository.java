package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.GridAnchor;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorEndpointBinding;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class DungeonCorridorWriteRepository {

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

    public void replaceRoomMembers(Connection conn, long corridorId, List<Long> roomIds) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_room_members WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_room_members(corridor_id, sort_order, room_id) VALUES(?,?,?)")) {
            int sortOrder = 0;
            for (Long roomId : sanitizedRoomIds(roomIds)) {
                insert.setLong(1, corridorId);
                insert.setInt(2, sortOrder++);
                insert.setLong(3, roomId);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void replacePoints(Connection conn, long corridorId, List<? extends GridAnchor> points) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_points WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_points(corridor_id, sort_order, anchor_kind, grid_x2, grid_y2) VALUES(?,?,?,?,?)")) {
            int sortOrder = 0;
            for (GridAnchor point : sanitizedPoints(points)) {
                Point2i doubledPoint = point.doubledGridPoint();
                insert.setLong(1, corridorId);
                insert.setInt(2, sortOrder++);
                insert.setString(3, point.kind().name());
                insert.setInt(4, doubledPoint.x());
                insert.setInt(5, doubledPoint.y());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void replaceEndpointBindings(Connection conn, long corridorId, List<CorridorEndpointBinding> endpointBindings) throws SQLException {
        try (PreparedStatement deleteTargets = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_endpoint_binding_targets"
                        + " WHERE corridor_endpoint_binding_id IN (SELECT corridor_endpoint_binding_id FROM dungeon_corridor_endpoint_bindings WHERE corridor_id=?)")) {
            deleteTargets.setLong(1, corridorId);
            deleteTargets.executeUpdate();
        }
        try (PreparedStatement deleteBindings = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_endpoint_bindings WHERE corridor_id=?")) {
            deleteBindings.setLong(1, corridorId);
            deleteBindings.executeUpdate();
        }
        try (PreparedStatement insertBinding = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_endpoint_bindings(corridor_id, sort_order, terminal_kind, cell_x, cell_y, edge_direction) VALUES(?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS);
             PreparedStatement insertTarget = conn.prepareStatement(
                     "INSERT INTO dungeon_corridor_endpoint_binding_targets(corridor_endpoint_binding_id, endpoint_order, endpoint_type, endpoint_id) VALUES(?,?,?,?)")) {
            int sortOrder = 0;
            for (CorridorEndpointBinding binding : sanitizedBindings(endpointBindings)) {
                VertexEdge edge = binding.boundaryEdge();
                Point2i anchorCell = anchorCell(edge);
                Point2i direction = edge == null ? null : edge.directionFrom(anchorCell);
                if (anchorCell == null || direction == null) {
                    continue;
                }
                insertBinding.setLong(1, corridorId);
                insertBinding.setInt(2, sortOrder++);
                insertBinding.setString(3, binding.terminal().name());
                insertBinding.setInt(4, anchorCell.x());
                insertBinding.setInt(5, anchorCell.y());
                insertBinding.setString(6, directionName(direction));
                insertBinding.executeUpdate();
                long bindingId = generatedId(insertBinding, "dungeon_corridor_endpoint_bindings");
                int endpointOrder = 0;
                for (ConnectionEndpoint endpoint : binding.endpoints()) {
                    if (endpoint == null || endpoint.type() == null || endpoint.id() == null) {
                        continue;
                    }
                    insertTarget.setLong(1, bindingId);
                    insertTarget.setInt(2, endpointOrder++);
                    insertTarget.setString(3, endpoint.type().name());
                    insertTarget.setLong(4, endpoint.id());
                    insertTarget.addBatch();
                }
                insertTarget.executeBatch();
            }
        }
    }

    public void deleteCorridor(Connection conn, long corridorId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_corridors WHERE corridor_id=?")) {
            ps.setLong(1, corridorId);
            ps.executeUpdate();
        }
    }

    private static long generatedId(PreparedStatement ps, String table) throws SQLException {
        try (ResultSet rs = ps.getGeneratedKeys()) {
            if (!rs.next()) {
                throw new SQLException("No key returned for " + table + " insert");
            }
            return rs.getLong(1);
        }
    }

    private static List<Long> sanitizedRoomIds(List<Long> roomIds) {
        if (roomIds == null || roomIds.isEmpty()) {
            return List.of();
        }
        ArrayList<Long> result = new ArrayList<>();
        for (Long roomId : roomIds) {
            if (roomId != null) {
                result.add(roomId);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<GridAnchor> sanitizedPoints(List<? extends GridAnchor> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        ArrayList<GridAnchor> result = new ArrayList<>();
        for (GridAnchor point : points) {
            if (point != null) {
                result.add(point);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<CorridorEndpointBinding> sanitizedBindings(List<CorridorEndpointBinding> endpointBindings) {
        if (endpointBindings == null || endpointBindings.isEmpty()) {
            return List.of();
        }
        ArrayList<CorridorEndpointBinding> result = new ArrayList<>();
        for (CorridorEndpointBinding endpointBinding : endpointBindings) {
            if (endpointBinding != null) {
                result.add(endpointBinding);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Point2i anchorCell(VertexEdge edge) {
        if (edge == null) {
            return null;
        }
        return edge.touchingCells().stream()
                .min(Point2i.POINT_ORDER)
                .orElse(null);
    }

    private static String directionName(Point2i direction) {
        return switch (direction.x() + "," + direction.y()) {
            case "0,-1" -> "NORTH";
            case "1,0" -> "EAST";
            case "0,1" -> "SOUTH";
            case "-1,0" -> "WEST";
            default -> throw new IllegalArgumentException("Unbekannte Corridor-Kantenrichtung: " + direction);
        };
    }
}
