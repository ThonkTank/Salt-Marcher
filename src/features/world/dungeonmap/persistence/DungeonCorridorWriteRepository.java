package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.corridor.Corridor;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonCorridorWriteRepository {

    public long insertCorridor(Connection conn, long mapId, Corridor corridor) throws SQLException {
        Corridor resolvedCorridor = Objects.requireNonNull(corridor, "corridor");
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_corridors(dungeon_map_id, level_z, directly_adjacent, routable) VALUES(?, ?, ?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setInt(2, levelOf(resolvedCorridor));
            ps.setInt(3, resolvedCorridor.path().directlyAdjacent() ? 1 : 0);
            ps.setInt(4, resolvedCorridor.path().routable() ? 1 : 0);
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
                "UPDATE dungeon_corridors SET level_z=?, directly_adjacent=?, routable=? WHERE corridor_id=?")) {
            ps.setInt(1, levelOf(resolvedCorridor));
            ps.setInt(2, resolvedCorridor.path().directlyAdjacent() ? 1 : 0);
            ps.setInt(3, resolvedCorridor.path().routable() ? 1 : 0);
            ps.setLong(4, corridorId);
            ps.executeUpdate();
        }
    }

    public void replacePathNodes(Connection conn, long corridorId, CorridorPath path) throws SQLException {
        CorridorPath resolvedPath = path == null ? CorridorPath.empty() : path;
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_path_nodes WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        List<CubePoint> orderedNodes = orderedPathNodes(resolvedPath);
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_path_nodes(corridor_id, sort_order, cell_x, cell_y, cell_z) VALUES(?,?,?,?,?)")) {
            for (int index = 0; index < orderedNodes.size(); index++) {
                CubePoint node = orderedNodes.get(index);
                insert.setLong(1, corridorId);
                insert.setInt(2, index);
                insert.setInt(3, node.x());
                insert.setInt(4, node.y());
                insert.setInt(5, node.z());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void replaceConnections(Connection conn, long corridorId, List<CorridorConnection> connections) throws SQLException {
        try (PreparedStatement deleteEndpoints = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_connection_endpoints"
                        + " WHERE corridor_connection_id IN (SELECT corridor_connection_id FROM dungeon_corridor_connections WHERE corridor_id=?)")) {
            deleteEndpoints.setLong(1, corridorId);
            deleteEndpoints.executeUpdate();
        }
        try (PreparedStatement deleteConnections = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_connections WHERE corridor_id=?")) {
            deleteConnections.setLong(1, corridorId);
            deleteConnections.executeUpdate();
        }
        try (PreparedStatement insertConnection = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_connections(corridor_id, sort_order, cell_x, cell_y, edge_direction) VALUES(?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS);
             PreparedStatement insertEndpoint = conn.prepareStatement(
                     "INSERT INTO dungeon_corridor_connection_endpoints(corridor_connection_id, endpoint_order, endpoint_type, endpoint_id) VALUES(?,?,?,?)")) {
            int sortOrder = 0;
            for (CorridorConnection connection : sanitizedConnections(connections)) {
                VertexEdge edge = singleDoorEdge(connection.door());
                Point2i anchorCell = anchorCell(edge);
                Point2i direction = edge.directionFrom(anchorCell);
                if (anchorCell == null || direction == null) {
                    continue;
                }
                insertConnection.setLong(1, corridorId);
                insertConnection.setInt(2, sortOrder++);
                insertConnection.setInt(3, anchorCell.x());
                insertConnection.setInt(4, anchorCell.y());
                insertConnection.setString(5, directionName(direction));
                insertConnection.executeUpdate();
                long connectionId = generatedId(insertConnection, "dungeon_corridor_connections");
                int endpointOrder = 0;
                for (ConnectionEndpoint endpoint : sanitizedEndpoints(connection.endpoints())) {
                    if (endpoint.type() == null || endpoint.id() == null) {
                        continue;
                    }
                    insertEndpoint.setLong(1, connectionId);
                    insertEndpoint.setInt(2, endpointOrder++);
                    insertEndpoint.setString(3, endpoint.type().name());
                    insertEndpoint.setLong(4, endpoint.id());
                    insertEndpoint.addBatch();
                }
                insertEndpoint.executeBatch();
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

    private static int levelOf(Corridor corridor) {
        if (corridor == null) {
            return 0;
        }
        Set<Integer> levels = corridor.path().levels();
        if (!levels.isEmpty()) {
            return levels.stream().min(Comparator.naturalOrder()).orElse(0);
        }
        return corridor.connections().stream()
                .filter(Objects::nonNull)
                .mapToInt(CorridorConnection::levelZ)
                .min()
                .orElse(0);
    }

    private static List<CubePoint> orderedPathNodes(CorridorPath path) {
        if (path == null) {
            return List.of();
        }
        List<CubePoint> routeNodes = path.route().anchors().stream()
                .map(anchor -> anchor == null ? null : new CubePoint(
                        (anchor.doubledGridPoint().x() - 1) / 2,
                        (anchor.doubledGridPoint().y() - 1) / 2,
                        inferLevel(path)))
                .filter(Objects::nonNull)
                .toList();
        if (!routeNodes.isEmpty()) {
            return routeNodes;
        }
        return orderedCorridorCells(path.cells());
    }

    private static int inferLevel(CorridorPath path) {
        return path == null ? 0 : path.levels().stream().min(Comparator.naturalOrder()).orElse(0);
    }

    private static List<CubePoint> orderedCorridorCells(Set<CubePoint> cells) {
        if (cells == null || cells.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<CubePoint> normalized = new LinkedHashSet<>();
        for (CubePoint cell : cells) {
            if (cell != null) {
                normalized.add(cell);
            }
        }
        if (normalized.isEmpty()) {
            return List.of();
        }
        if (normalized.size() == 1) {
            return List.copyOf(normalized);
        }
        Map<CubePoint, Set<CubePoint>> adjacency = new LinkedHashMap<>();
        for (CubePoint cell : normalized) {
            adjacency.put(cell, new LinkedHashSet<>());
        }
        for (CubePoint left : normalized) {
            for (CubePoint right : normalized) {
                if (left == right || left.z() != right.z()) {
                    continue;
                }
                if (Math.abs(left.x() - right.x()) + Math.abs(left.y() - right.y()) == 1) {
                    adjacency.get(left).add(right);
                }
            }
        }
        CubePoint start = normalized.stream()
                .filter(cell -> adjacency.getOrDefault(cell, Set.of()).size() <= 1)
                .min(CubePoint.POINT_ORDER)
                .orElse(normalized.stream().min(CubePoint.POINT_ORDER).orElse(null));
        if (start == null) {
            return List.copyOf(normalized);
        }
        ArrayList<CubePoint> ordered = new ArrayList<>();
        LinkedHashSet<CubePoint> remaining = new LinkedHashSet<>(normalized);
        CubePoint previous = null;
        CubePoint current = start;
        while (current != null && remaining.remove(current)) {
            ordered.add(current);
            CubePoint next = adjacency.getOrDefault(current, Set.of()).stream()
                    .filter(candidate -> !Objects.equals(candidate, previous))
                    .filter(remaining::contains)
                    .min(CubePoint.POINT_ORDER)
                    .orElse(null);
            previous = current;
            current = next;
        }
        if (!remaining.isEmpty()) {
            ordered.addAll(remaining.stream().sorted(CubePoint.POINT_ORDER).toList());
        }
        return List.copyOf(ordered);
    }

    private static List<CorridorConnection> sanitizedConnections(List<CorridorConnection> connections) {
        if (connections == null || connections.isEmpty()) {
            return List.of();
        }
        ArrayList<CorridorConnection> result = new ArrayList<>();
        for (CorridorConnection connection : connections) {
            if (connection != null) {
                result.add(connection);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<ConnectionEndpoint> sanitizedEndpoints(List<ConnectionEndpoint> endpoints) {
        if (endpoints == null || endpoints.isEmpty()) {
            return List.of();
        }
        ArrayList<ConnectionEndpoint> result = new ArrayList<>();
        for (ConnectionEndpoint endpoint : endpoints) {
            if (endpoint != null) {
                result.add(endpoint);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static VertexEdge singleDoorEdge(Door door) {
        if (door == null || door.edges().size() != 1) {
            return null;
        }
        return door.edges().iterator().next();
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
