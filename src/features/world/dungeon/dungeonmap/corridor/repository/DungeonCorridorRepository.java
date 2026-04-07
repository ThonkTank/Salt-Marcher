package features.world.dungeon.dungeonmap.corridor.repository;

import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.dungeonmap.model.CorridorRehydrationRequest;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.dungeonmap.corridor.model.CorridorSpecification;
import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.corridor.model.CorridorNode;
import features.world.dungeon.dungeonmap.corridor.model.CorridorSegment;
import features.world.dungeon.dungeonmap.structure.repository.DungeonStructureRepository;

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

    private final DungeonStructureRepository structureRepository = new DungeonStructureRepository();

    public List<Corridor> loadByMap(Connection conn, DungeonMap roomLayout) throws SQLException {
        DungeonMap resolvedLayout = Objects.requireNonNull(roomLayout, "roomLayout");
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
        Map<Long, Long> structureIdsByCorridorId = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT corridor_id, structure_object_id FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    structureIdsByCorridorId.put(rs.getLong("corridor_id"), rs.getLong("structure_object_id"));
                }
            }
        }
        Map<Long, Structure> structuresById = structureRepository.loadByIds(conn, structureIdsByCorridorId.values());
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT corridor_id, dungeon_map_id, structure_object_id"
                        + " FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<Corridor> result = new ArrayList<>();
                while (rs.next()) {
                    long corridorId = rs.getLong("corridor_id");
                    long structureObjectId = rs.getLong("structure_object_id");
                    Structure structure = structuresById.get(structureObjectId);
                    int levelZ = structure == null ? 0 : structure.primaryLevel();
                    if (structure == null || structure.surfaceAtLevel(levelZ).isEmpty()) {
                        throw new IllegalStateException("Corridor " + corridorId + " hat kein persistiertes Structure");
                    }
                    result.add(resolvedLayout.rehydrateCorridor(new CorridorRehydrationRequest(
                            new CorridorSpecification(
                                    corridorId,
                                    structureObjectId,
                                    mapId,
                                    levelZ,
                                    nodesByCorridorId.getOrDefault(corridorId, List.of()),
                                    segmentsByCorridorId.getOrDefault(corridorId, List.of())),
                            structure)));
                }
                return result.isEmpty() ? List.of() : List.copyOf(result);
            }
        }
    }

    public Corridor save(Connection conn, Corridor corridor, DungeonMap layout) throws SQLException {
        DungeonMap resolvedLayout = Objects.requireNonNull(layout, "layout");
        Corridor persisted = assignPersistentIds(conn, corridor, resolvedLayout);
        long mapId = resolvedLayout.mapId();
        Long corridorId = persisted.corridorId();
        Long structureObjectId = persisted.structureObjectId();
        DungeonStructureRepository.PersistedStructure persistedStructure =
                structureRepository.save(conn, structureObjectId, persisted);
        if (corridorId == null) {
            corridorId = insertCorridor(conn, mapId, persistedStructure.structureObjectId());
        } else {
            updateCorridor(conn, corridorId, persistedStructure.structureObjectId());
        }
        deleteNodes(conn, corridorId);
        insertNodes(conn, corridorId, persisted.nodes(), resolvedLayout, persisted.levelZ());
        replaceSegments(conn, corridorId, persisted.segments());
        return resolvedLayout.rehydrateCorridor(new CorridorRehydrationRequest(
                new CorridorSpecification(
                        corridorId,
                        persistedStructure.structureObjectId(),
                        mapId,
                        persisted.levelZ(),
                        persisted.nodes(),
                        persisted.segments()),
                persistedStructure.structure()));
    }

    public void delete(Connection conn, long corridorId) throws SQLException {
        Long structureObjectId = findStructureObjectId(conn, corridorId);
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_corridors WHERE corridor_id=?")) {
            ps.setLong(1, corridorId);
            ps.executeUpdate();
        }
        structureRepository.delete(conn, structureObjectId);
    }

    private long insertCorridor(Connection conn, long mapId, long structureObjectId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_corridors(dungeon_map_id, structure_object_id) VALUES(?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, structureObjectId);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_corridors insert");
                }
                return rs.getLong(1);
            }
        }
    }

    private void updateCorridor(Connection conn, long corridorId, long structureObjectId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_corridors SET structure_object_id=? WHERE corridor_id=?")) {
            ps.setLong(1, structureObjectId);
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

    private void insertNodes(Connection conn, long corridorId, List<CorridorNode> nodes, DungeonMap layout, int levelZ) throws SQLException {
        DungeonMap resolvedLayout = Objects.requireNonNull(layout, "layout");
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

    private Corridor assignPersistentIds(Connection conn, Corridor corridor, DungeonMap layout) throws SQLException {
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
            nodes.add(new CorridorNode(persistedNodeId, node.point(), node.doorRef()));
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
        return layout.rehydrateCorridor(new CorridorRehydrationRequest(
                new CorridorSpecification(
                        resolvedCorridor.corridorId(),
                        resolvedCorridor.structureObjectId(),
                        resolvedCorridor.mapId(),
                        resolvedCorridor.levelZ(),
                        nodes,
                        segments),
                resolvedCorridor));
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
            DungeonMap layout,
            int levelZ
    ) throws SQLException {
        ps.setLong(1, requiredId(node.nodeId(), "corridor node"));
        ps.setLong(2, corridorId);
        DoorRef doorRef = requiredDoorRef(node, layout, levelZ);
        if (doorRef == null) {
            ps.setInt(3, node.point().x2());
            ps.setInt(4, node.point().y2());
            ps.setNull(5, java.sql.Types.BIGINT);
        } else {
            ps.setNull(3, java.sql.Types.INTEGER);
            ps.setNull(4, java.sql.Types.INTEGER);
            ps.setLong(5, doorRef.doorId());
        }
    }

    private static DoorRef requiredDoorRef(CorridorNode node, DungeonMap layout, int levelZ) throws SQLException {
        if (node == null || !node.isDoorBound()) {
            return null;
        }
        DungeonMap.DoorDescription description = layout == null ? null : layout.describeDoor(node.doorRef());
        if (description == null || description.levelZ() != levelZ || description.role() != DungeonMap.DoorRole.ROOM_EXTERIOR) {
            throw new SQLException("Corridor node references missing exterior room door at level " + levelZ);
        }
        if (!description.anchorSegment().midpoint().equals(node.point())) {
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
                .thenComparing(CorridorNode::point, GridPoint.ORDER));
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
        GridPoint point = doorId == null
                ? GridPoint.lattice(row.getInt("grid_x2"), row.getInt("grid_y2"), 0)
                : GridPoint.lattice(0, 0, 0);
        return new CorridorNode(
                row.getLong("corridor_node_id"),
                point,
                doorId == null ? null : new DoorRef(doorId));
    }

    private Long findStructureObjectId(Connection conn, long corridorId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT structure_object_id FROM dungeon_corridors WHERE corridor_id=?")) {
            ps.setLong(1, corridorId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                return rs.getLong("structure_object_id");
            }
        }
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
