package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.DoorRef;
import features.world.dungeonmap.model.objects.StructureObject;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DungeonCorridorRepository {

    private final DungeonDoorRepository doorRepository = new DungeonDoorRepository();

    public List<Corridor> loadByMap(Connection conn, DungeonLayout roomLayout) throws SQLException {
        DungeonLayout resolvedLayout = Objects.requireNonNull(roomLayout, "roomLayout");
        long mapId = resolvedLayout.mapId();
        Map<Long, List<CorridorNode>> nodesByCorridorId = loadGrouped(
                conn,
                "SELECT node.corridor_id, node.corridor_node_id, node.grid_x2, node.grid_y2, node.door_id"
                        + " FROM dungeon_corridor_nodes node"
                        + " JOIN dungeon_corridors corridor ON corridor.corridor_id=node.corridor_id"
                        + " WHERE corridor.dungeon_map_id=?"
                        + " ORDER BY node.corridor_id, node.corridor_node_id",
                mapId,
                row -> row.getLong("corridor_id"),
                DungeonCorridorRepository::corridorNodeFromRow);
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
        Map<Long, Map<Integer, List<Door>>> doorsByCorridorId = doorRepository.loadCorridorDoorsByCorridorId(conn, mapId);
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT corridor_id, dungeon_map_id, level_z"
                        + " FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<Corridor> result = new ArrayList<>();
                while (rs.next()) {
                    long corridorId = rs.getLong("corridor_id");
                    int levelZ = rs.getInt("level_z");
                    result.add(Corridor.resolved(
                            resolvedLayout,
                            corridorId,
                            levelZ,
                            nodesByCorridorId.getOrDefault(corridorId, List.of()),
                            segmentsByCorridorId.getOrDefault(corridorId, List.of()),
                            doorsByCorridorId.getOrDefault(corridorId, Map.of()).getOrDefault(levelZ, List.of())));
                }
                return result.isEmpty() ? List.of() : List.copyOf(result);
            }
        }
    }

    public Corridor save(Connection conn, Corridor corridor, DungeonLayout layout) throws SQLException {
        DungeonLayout resolvedLayout = Objects.requireNonNull(layout, "layout");
        Corridor persisted = assignPersistentIds(conn, corridor, resolvedLayout);
        long mapId = resolvedLayout.mapId();
        Long corridorId = persisted.corridorId();
        if (corridorId == null) {
            corridorId = insertCorridor(conn, mapId, persisted);
            persisted = resolvedLayout.resolveCorridor(
                    corridorId,
                    persisted.levelZ(),
                    persisted.nodes(),
                    persisted.segments(),
                    persisted.structure().doorsAtLevel(persisted.levelZ()));
        } else {
            updateCorridor(conn, corridorId, persisted);
        }
        deleteNodes(conn, corridorId);
        doorRepository.replaceCorridorDoors(conn, corridorId, persisted.structure());
        insertNodes(conn, corridorId, persisted.nodes(), resolvedLayout, persisted.levelZ());
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

    private void deleteNodes(Connection conn, long corridorId) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_nodes WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
    }

    private void insertNodes(Connection conn, long corridorId, List<CorridorNode> nodes, DungeonLayout layout, int levelZ) throws SQLException {
        DungeonLayout resolvedLayout = Objects.requireNonNull(layout, "layout");
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_nodes("
                        + "corridor_node_id, corridor_id, grid_x2, grid_y2, door_id"
                        + ") VALUES(?,?,?,?,?)")) {
            for (CorridorNode node : sanitizedNodes(nodes)) {
                bindNode(insert, corridorId, node, resolvedLayout, levelZ);
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
        StructureObject persistedStructure = doorRepository.assignPersistentIds(conn, resolvedCorridor.structure());
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
            nodes.add(new CorridorNode(persistedNodeId, node.point2x(), node.doorRef()));
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
        return layout.resolveCorridor(
                resolvedCorridor.corridorId(),
                resolvedCorridor.levelZ(),
                nodes,
                segments,
                persistedStructure.doorsAtLevel(resolvedCorridor.levelZ()));
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
            DungeonLayout layout,
            int levelZ
    ) throws SQLException {
        ps.setLong(1, requiredId(node.nodeId(), "corridor node"));
        ps.setLong(2, corridorId);
        ps.setInt(3, node.point2x().x2());
        ps.setInt(4, node.point2x().y2());
        DoorRef doorRef = requiredDoorRef(node, layout, levelZ);
        if (doorRef == null) {
            ps.setNull(5, java.sql.Types.BIGINT);
        } else {
            ps.setLong(5, doorRef.doorId());
        }
    }

    private static DoorRef requiredDoorRef(CorridorNode node, DungeonLayout layout, int levelZ) throws SQLException {
        if (node == null || !node.isDoorBound()) {
            return null;
        }
        DungeonLayout.DoorDescription description = layout == null ? null : layout.describeDoor(node.doorRef());
        if (description == null || description.levelZ() != levelZ || description.role() != DungeonLayout.DoorRole.ROOM_EXTERIOR) {
            throw new SQLException("Corridor node references missing exterior room door at level " + levelZ);
        }
        if (!description.anchorSegment2x().midpoint().equals(node.point2x())) {
            throw new SQLException("Corridor node point no longer matches its referenced exterior room door");
        }
        return description.ref();
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

    private static CorridorNode corridorNodeFromRow(ResultSet row) throws SQLException {
        Long doorId = nullableLong(row, "door_id");
        return new CorridorNode(
                row.getLong("corridor_node_id"),
                GridPoint2x.raw(row.getInt("grid_x2"), row.getInt("grid_y2")),
                doorId == null ? null : new DoorRef(doorId));
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
