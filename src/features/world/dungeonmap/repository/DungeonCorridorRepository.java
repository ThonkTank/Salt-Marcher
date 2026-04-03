package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.model.structures.corridor.CorridorSegment;
import features.world.dungeonmap.model.structures.room.Room;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DungeonCorridorRepository {

    public List<Corridor> loadByMap(Connection conn, long mapId, List<Room> rooms) throws SQLException {
        Map<Long, Room> roomsById = indexRoomsById(rooms);
        Map<Long, List<CorridorNode>> nodesByCorridorId = loadGrouped(
                conn,
                "SELECT node.corridor_id, node.corridor_node_id, node.grid_x2, node.grid_y2, corridor.level_z, "
                        + "node.room_id, node.room_cell_x, node.room_cell_y, node.room_edge_direction"
                        + " FROM dungeon_corridor_nodes node"
                        + " JOIN dungeon_corridors corridor ON corridor.corridor_id=node.corridor_id"
                        + " WHERE corridor.dungeon_map_id=?"
                        + " ORDER BY corridor_id, corridor_node_id",
                mapId,
                row -> row.getLong("corridor_id"),
                row -> corridorNodeFromRow(row, roomsById));
        Map<Long, List<CorridorSegment>> segmentsByCorridorId = loadGrouped(
                conn,
                "SELECT corridor_id, corridor_segment_id, start_node_id, end_node_id"
                        + " FROM dungeon_corridor_segments"
                        + " WHERE corridor_id IN (SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, corridor_segment_id",
                mapId,
                row -> row.getLong("corridor_id"),
                row -> new CorridorSegment(
                        row.getLong("corridor_segment_id"),
                        row.getLong("start_node_id"),
                        row.getLong("end_node_id")));
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT corridor_id, dungeon_map_id, level_z"
                        + " FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<Corridor> result = new ArrayList<>();
                while (rs.next()) {
                    long corridorId = rs.getLong("corridor_id");
                    result.add(Corridor.resolved(
                            corridorId,
                            rs.getLong("dungeon_map_id"),
                            rs.getInt("level_z"),
                            nodesByCorridorId.getOrDefault(corridorId, List.of()),
                            segmentsByCorridorId.getOrDefault(corridorId, List.of()),
                            roomsById));
                }
                return result.isEmpty() ? List.of() : List.copyOf(result);
            }
        }
    }

    public Corridor save(Connection conn, Corridor corridor, DungeonLayout layout) throws SQLException {
        // Corridor persistence realizes synthetic editor ids here so application workflows only coordinate validation
        // and transaction scope, not row-identity bookkeeping.
        DungeonLayout resolvedLayout = Objects.requireNonNull(layout, "layout");
        Corridor persisted = assignPersistentIds(conn, corridor, resolvedLayout);
        long mapId = resolvedLayout.mapId();
        Long corridorId = persisted.corridorId();
        if (corridorId == null) {
            corridorId = insertCorridor(conn, mapId, persisted);
            persisted = resolvedLayout.resolveCorridor(corridorId, persisted.levelZ(), persisted.nodes(), persisted.segments());
        } else {
            updateCorridor(conn, corridorId, persisted);
        }
        replaceNodes(conn, corridorId, persisted.nodes(), resolvedLayout, persisted.levelZ());
        replaceSegments(conn, corridorId, persisted.segments());
        return persisted;
    }

    public void delete(Connection conn, long corridorId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_corridors WHERE corridor_id=?")) {
            ps.setLong(1, corridorId);
            ps.executeUpdate();
        }
    }

    private long insertCorridor(Connection conn, long mapId, Corridor corridor) throws SQLException {
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

    private void updateCorridor(Connection conn, long corridorId, Corridor corridor) throws SQLException {
        Corridor resolvedCorridor = Objects.requireNonNull(corridor, "corridor");
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_corridors SET level_z=? WHERE corridor_id=?")) {
            ps.setInt(1, resolvedCorridor.levelZ());
            ps.setLong(2, corridorId);
            ps.executeUpdate();
        }
    }

    private void replaceNodes(Connection conn, long corridorId, List<CorridorNode> nodes, DungeonLayout layout, int levelZ) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_nodes WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        Map<Long, Room> roomsById = indexRoomsById(Objects.requireNonNull(layout, "layout").rooms());
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_nodes("
                        + "corridor_node_id, corridor_id, grid_x2, grid_y2, room_id, room_cell_x, room_cell_y, room_edge_direction"
                        + ") VALUES(?,?,?,?,?,?,?,?)")) {
            for (CorridorNode node : sanitizedNodes(nodes)) {
                bindNode(insert, corridorId, node, roomsById, levelZ);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private void replaceSegments(Connection conn, long corridorId, List<CorridorSegment> segments) throws SQLException {
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

    private Corridor assignPersistentIds(Connection conn, Corridor corridor, DungeonLayout layout) throws SQLException {
        Corridor resolvedCorridor = Objects.requireNonNull(corridor, "corridor");
        long nextNodeId = nextId(conn, "dungeon_corridor_nodes", "corridor_node_id");
        long nextSegmentId = nextId(conn, "dungeon_corridor_segments", "corridor_segment_id");
        Map<Long, Long> syntheticNodeIds = new LinkedHashMap<>();
        ArrayList<CorridorNode> nodes = new ArrayList<>();
        for (CorridorNode node : resolvedCorridor.nodes()) {
            Long persistedNodeId = node.nodeId();
            if (persistedNodeId == null || persistedNodeId <= 0) {
                persistedNodeId = nextNodeId++;
            }
            if (node.nodeId() != null && node.nodeId() <= 0) {
                syntheticNodeIds.put(node.nodeId(), persistedNodeId);
            }
            nodes.add(new CorridorNode(
                    persistedNodeId,
                    node.point2x(),
                    node.roomId(),
                    node.roomCell(),
                    node.roomBoundaryDirection()));
        }
        ArrayList<CorridorSegment> segments = new ArrayList<>();
        for (CorridorSegment segment : resolvedCorridor.segments()) {
            Long startNodeId = remapNodeId(segment.startNodeId(), syntheticNodeIds);
            Long endNodeId = remapNodeId(segment.endNodeId(), syntheticNodeIds);
            Long persistedSegmentId = segment.segmentId();
            if (persistedSegmentId == null || persistedSegmentId <= 0) {
                persistedSegmentId = nextSegmentId++;
            }
            segments.add(new CorridorSegment(persistedSegmentId, startNodeId, endNodeId));
        }
        return layout.resolveCorridor(resolvedCorridor.corridorId(), resolvedCorridor.levelZ(), nodes, segments);
    }

    private static Long remapNodeId(Long nodeId, Map<Long, Long> syntheticNodeIds) {
        if (nodeId == null) {
            return null;
        }
        return syntheticNodeIds.getOrDefault(nodeId, nodeId);
    }

    private static void bindNode(
            PreparedStatement ps,
            long corridorId,
            CorridorNode node,
            Map<Long, Room> roomsById,
            int levelZ
    ) throws SQLException {
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
            CellCoord roomCell = requiredRoomCell(node, roomsById, levelZ);
            ps.setLong(5, node.roomId());
            ps.setInt(6, roomCell.x());
            ps.setInt(7, roomCell.y());
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
                .thenComparing(CorridorNode::point2x, GridPoint2x.ORDER));
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

    private static Map<Long, Room> indexRoomsById(Collection<Room> rooms) {
        if (rooms == null || rooms.isEmpty()) {
            return Map.of();
        }
        Map<Long, Room> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room != null && room.roomId() != null) {
                result.put(room.roomId(), room);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static CorridorNode corridorNodeFromRow(ResultSet row, Map<Long, Room> roomsById) throws SQLException {
        Long roomId = nullableLong(row, "room_id");
        CellCoord roomCell = roomId != null && row.getObject("room_cell_x") != null
                ? new CellCoord(row.getInt("room_cell_x"), row.getInt("room_cell_y"))
                : null;
        return new CorridorNode(
                row.getLong("corridor_node_id"),
                GridPoint2x.raw(row.getInt("grid_x2"), row.getInt("grid_y2")),
                roomId,
                roomCell,
                row.getString("room_edge_direction") == null
                        ? null
                        : CardinalDirection.valueOf(row.getString("room_edge_direction").trim().toUpperCase(java.util.Locale.ROOT)));
    }

    private static CellCoord requiredRoomCell(CorridorNode node, Map<Long, Room> roomsById, int levelZ) throws SQLException {
        if (node == null || !node.isRoomBound()) {
            return null;
        }
        Room room = roomsById.get(node.roomId());
        if (room == null) {
            throw new SQLException("Corridor node references missing room " + node.roomId());
        }
        var floor = room.structure().floorAtLevel(levelZ);
        if (floor == null) {
            throw new SQLException("Corridor node references room without floor at level " + levelZ);
        }
        if (!room.structure().cellCoordsAtLevel(levelZ).contains(node.roomCell())) {
            throw new SQLException("Corridor node references cell outside room at level " + levelZ);
        }
        return node.roomCell();
    }

    private static <K, V> Map<K, List<V>> loadGrouped(
            Connection conn,
            String sql,
            long mapId,
            ResultSetMapper<K> keyExtractor,
            ResultSetMapper<V> valueExtractor
    ) throws SQLException {
        Map<K, List<V>> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    K key = keyExtractor.map(rs);
                    V value = valueExtractor.map(rs);
                    if (value != null) {
                        result.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
                    } else {
                        result.computeIfAbsent(key, ignored -> new ArrayList<>());
                    }
                }
            }
        }
        return result;
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    @FunctionalInterface
    private interface ResultSetMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }
}
