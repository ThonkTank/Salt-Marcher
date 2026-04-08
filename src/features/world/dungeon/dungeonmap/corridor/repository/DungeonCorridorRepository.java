package features.world.dungeon.dungeonmap.corridor.repository;

import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.corridor.model.CorridorInput;
import features.world.dungeon.dungeonmap.corridor.model.CorridorInputNode;
import features.world.dungeon.dungeonmap.corridor.model.CorridorSegment;
import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.dungeonmap.structure.repository.DungeonStructureRepository;
import features.world.dungeon.geometry.GridPoint;

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

    public List<PersistedCorridorData> loadByMap(Connection conn, long mapId) throws SQLException {
        if (mapId <= 0) {
            return List.of();
        }

        Map<Long, List<CorridorInputNode>> nodesByCorridorId = loadGrouped(
                conn,
                "SELECT node_id, corridor_id, door_id, point_x2, point_y2"
                        + " FROM dungeon_corridor_input_nodes"
                        + " WHERE corridor_id IN (SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, node_id",
                mapId,
                rs -> rs.getLong("corridor_id"),
                DungeonCorridorRepository::nodeFromRow);
        Map<Long, List<CorridorSegment>> segmentsByCorridorId = loadGrouped(
                conn,
                "SELECT segment_id, corridor_id, start_node_id, end_node_id"
                        + " FROM dungeon_corridor_input_segments"
                        + " WHERE corridor_id IN (SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, segment_id",
                mapId,
                rs -> rs.getLong("corridor_id"),
                rs -> new CorridorSegment(
                        rs.getLong("segment_id"),
                        rs.getLong("start_node_id"),
                        rs.getLong("end_node_id")));

        Map<Long, Structure> structuresById = new LinkedHashMap<>();
        ArrayList<PersistedCorridorData> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT corridor_id, dungeon_map_id, structure_object_id, level_z"
                        + " FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                ArrayList<Long> structureIds = new ArrayList<>();
                ArrayList<long[]> rows = new ArrayList<>();
                while (rs.next()) {
                    long corridorId = rs.getLong("corridor_id");
                    long structureObjectId = rs.getLong("structure_object_id");
                    int levelZ = rs.getInt("level_z");
                    rows.add(new long[]{corridorId, structureObjectId, levelZ});
                    structureIds.add(structureObjectId);
                }
                structuresById.putAll(structureRepository.loadByIds(conn, structureIds));
                for (long[] row : rows) {
                    long corridorId = row[0];
                    long structureObjectId = row[1];
                    int levelZ = (int) row[2];
                    Structure structure = structuresById.get(structureObjectId);
                    if (structure == null || structure.surfaceAtLevel(levelZ).isEmpty()) {
                        throw new IllegalStateException("Corridor " + corridorId + " hat kein persistiertes Structure");
                    }
                    CorridorInput input = new CorridorInput(
                            corridorId,
                            structureObjectId,
                            mapId,
                            levelZ,
                            nodesAtLevel(nodesByCorridorId.getOrDefault(corridorId, List.of()), levelZ),
                            segmentsByCorridorId.getOrDefault(corridorId, List.of()));
                    result.add(new PersistedCorridorData(input, structure));
                }
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    public PersistedCorridorData save(Connection conn, Corridor corridor, long mapId) throws SQLException {
        Corridor resolvedCorridor = Objects.requireNonNull(corridor, "corridor");
        PersistedInputRemap persistedInputRemap = assignPersistentIds(conn, resolvedCorridor.input());
        CorridorInput persistedInput = persistedInputRemap.input();
        DungeonStructureRepository.PersistedStructure persistedStructure =
                structureRepository.save(conn, persistedInput.structureObjectId(), resolvedCorridor);
        Long corridorId = persistedInput.corridorId();
        if (corridorId == null) {
            corridorId = insertCorridor(conn, mapId, persistedStructure.structureObjectId(), persistedInput.levelZ());
        } else {
            updateCorridor(conn, corridorId, persistedStructure.structureObjectId(), persistedInput.levelZ());
        }
        CorridorInput persistedWithIds = new CorridorInput(
                corridorId,
                persistedStructure.structureObjectId(),
                mapId,
                persistedInput.levelZ(),
                persistedInput.nodes(),
                persistedInput.segments());
        replaceNodes(conn, corridorId, persistedWithIds.nodes());
        replaceSegments(conn, corridorId, persistedWithIds.segments());
        return new PersistedCorridorData(persistedWithIds, persistedStructure.structure());
    }

    public void delete(Connection conn, long corridorId) throws SQLException {
        Long structureObjectId = findStructureObjectId(conn, corridorId);
        try (PreparedStatement ps = conn.prepareStatement("DELETE FROM dungeon_corridors WHERE corridor_id=?")) {
            ps.setLong(1, corridorId);
            ps.executeUpdate();
        }
        structureRepository.delete(conn, structureObjectId);
    }

    private PersistedInputRemap assignPersistentIds(Connection conn, CorridorInput input) throws SQLException {
        CorridorInput resolvedInput = Objects.requireNonNull(input, "input");
        long nextNodeId = nextId(conn, "dungeon_corridor_input_nodes", "node_id");
        long nextSegmentId = nextId(conn, "dungeon_corridor_input_segments", "segment_id");

        LinkedHashMap<Long, Long> nodeIdRemap = new LinkedHashMap<>();
        ArrayList<CorridorInputNode> nodes = new ArrayList<>();
        for (CorridorInputNode node : resolvedInput.nodes()) {
            Long persistedNodeId = node.nodeId();
            if (persistedNodeId == null || persistedNodeId <= 0) {
                persistedNodeId = nextNodeId++;
            }
            if (node.nodeId() != null && node.nodeId() <= 0) {
                nodeIdRemap.put(node.nodeId(), persistedNodeId);
            }
            nodes.add(new CorridorInputNode(persistedNodeId, node.doorRef(), node.fixedPoint()));
        }

        ArrayList<CorridorSegment> segments = new ArrayList<>();
        LinkedHashMap<Long, Long> segmentIdRemap = new LinkedHashMap<>();
        for (CorridorSegment segment : resolvedInput.segments()) {
            Long persistedSegmentId = segment.segmentId();
            if (persistedSegmentId == null || persistedSegmentId <= 0) {
                persistedSegmentId = nextSegmentId++;
            }
            if (segment.segmentId() != null && segment.segmentId() <= 0) {
                segmentIdRemap.put(segment.segmentId(), persistedSegmentId);
            }
            segments.add(new CorridorSegment(
                    persistedSegmentId,
                    remapId(segment.startNodeId(), nodeIdRemap),
                    remapId(segment.endNodeId(), nodeIdRemap)));
        }

        return new PersistedInputRemap(
                new CorridorInput(
                        resolvedInput.corridorId(),
                        resolvedInput.structureObjectId(),
                        resolvedInput.mapId(),
                        resolvedInput.levelZ(),
                        nodes,
                        segments),
                Map.copyOf(nodeIdRemap),
                Map.copyOf(segmentIdRemap));
    }

    private long insertCorridor(Connection conn, long mapId, long structureObjectId, int levelZ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_corridors(dungeon_map_id, structure_object_id, level_z)"
                        + " VALUES(?,?,?)",
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

    private void updateCorridor(Connection conn, long corridorId, long structureObjectId, int levelZ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_corridors SET structure_object_id=?, level_z=? WHERE corridor_id=?")) {
            ps.setLong(1, structureObjectId);
            ps.setInt(2, levelZ);
            ps.setLong(3, corridorId);
            ps.executeUpdate();
        }
    }

    private void replaceNodes(Connection conn, long corridorId, List<CorridorInputNode> nodes) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_input_nodes WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_input_nodes("
                        + "node_id, corridor_id, door_id, point_x2, point_y2"
                        + ") VALUES(?,?,?,?,?)")) {
            for (CorridorInputNode node : sanitizedNodes(nodes)) {
                insert.setLong(1, requiredId(node.nodeId(), "corridor node"));
                insert.setLong(2, corridorId);
                if (node.doorRef() == null) {
                    insert.setNull(3, java.sql.Types.BIGINT);
                    insert.setInt(4, Objects.requireNonNull(node.fixedPoint(), "fixedPoint").x2());
                    insert.setInt(5, node.fixedPoint().y2());
                } else {
                    insert.setLong(3, node.doorRef().doorId());
                    insert.setNull(4, java.sql.Types.INTEGER);
                    insert.setNull(5, java.sql.Types.INTEGER);
                }
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private void replaceSegments(Connection conn, long corridorId, List<CorridorSegment> segments) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_input_segments WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_input_segments("
                        + "segment_id, corridor_id, start_node_id, end_node_id"
                        + ") VALUES(?,?,?,?)")) {
            for (CorridorSegment segment : sanitizedSegments(segments)) {
                insert.setLong(1, requiredId(segment.segmentId(), "corridor segment"));
                insert.setLong(2, corridorId);
                insert.setLong(3, requiredId(segment.startNodeId(), "corridor node"));
                insert.setLong(4, requiredId(segment.endNodeId(), "corridor node"));
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static CorridorInputNode nodeFromRow(ResultSet rs) throws SQLException {
        Long doorId = nullableLong(rs, "door_id");
        return new CorridorInputNode(
                rs.getLong("node_id"),
                doorId == null ? null : new DoorRef(doorId),
                doorId == null
                        ? GridPoint.lattice(rs.getInt("point_x2"), rs.getInt("point_y2"), 0)
                        : null);
    }

    private static List<CorridorInputNode> nodesAtLevel(List<CorridorInputNode> nodes, int levelZ) {
        if (nodes == null || nodes.isEmpty()) {
            return List.of();
        }
        return nodes.stream()
                .filter(Objects::nonNull)
                .map(node -> node.fixedPoint() == null
                        ? node
                        : new CorridorInputNode(node.nodeId(), null, node.fixedPoint().withLevel(levelZ)))
                .sorted(Comparator.comparing(node -> node.nodeId() == null ? Long.MAX_VALUE : node.nodeId()))
                .toList();
    }

    private Long findStructureObjectId(Connection conn, long corridorId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT structure_object_id FROM dungeon_corridors WHERE corridor_id=?")) {
            ps.setLong(1, corridorId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getLong("structure_object_id") : null;
            }
        }
    }

    private static long nextId(Connection conn, String table, String column) throws SQLException {
        String sql = "SELECT COALESCE(MAX(" + column + "), 0) + 1 FROM " + table;
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return rs.next() ? rs.getLong(1) : 1L;
        }
    }

    private static <T> Map<Long, List<T>> loadGrouped(
            Connection conn,
            String sql,
            long mapId,
            CorridorRowKeyReader keyReader,
            CorridorRowMapper<T> mapper
    ) throws SQLException {
        LinkedHashMap<Long, List<T>> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long corridorId = keyReader.readKey(rs);
                    result.computeIfAbsent(corridorId, ignored -> new ArrayList<>()).add(mapper.map(rs));
                }
            }
        }
        if (result.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<Long, List<T>> copy = new LinkedHashMap<>();
        for (Map.Entry<Long, List<T>> entry : result.entrySet()) {
            copy.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(copy);
    }

    private static Long remapId(Long id, Map<Long, Long> remap) {
        if (id == null) {
            return null;
        }
        return remap == null ? id : remap.getOrDefault(id, id);
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private static long requiredId(Long id, String label) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException(label + " requires a persisted id");
        }
        return id;
    }

    private static List<CorridorInputNode> sanitizedNodes(List<CorridorInputNode> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            return List.of();
        }
        return nodes.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(node -> node.nodeId() == null ? Long.MAX_VALUE : node.nodeId()))
                .toList();
    }

    private static List<CorridorSegment> sanitizedSegments(List<CorridorSegment> segments) {
        if (segments == null || segments.isEmpty()) {
            return List.of();
        }
        return segments.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(segment -> segment.segmentId() == null ? Long.MAX_VALUE : segment.segmentId()))
                .toList();
    }

    @FunctionalInterface
    private interface CorridorRowMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }

    @FunctionalInterface
    private interface CorridorRowKeyReader {
        long readKey(ResultSet rs) throws SQLException;
    }

    private record PersistedInputRemap(
            CorridorInput input,
            Map<Long, Long> nodeIdRemap,
            Map<Long, Long> segmentIdRemap
    ) {
        private PersistedInputRemap {
            input = Objects.requireNonNull(input, "input");
            nodeIdRemap = nodeIdRemap == null ? Map.of() : Map.copyOf(nodeIdRemap);
            segmentIdRemap = segmentIdRemap == null ? Map.of() : Map.copyOf(segmentIdRemap);
        }
    }

    public record PersistedCorridorData(
            CorridorInput input,
            Structure structure
    ) {
        public PersistedCorridorData {
            input = Objects.requireNonNull(input, "input");
            structure = Objects.requireNonNull(structure, "structure");
        }
    }
}
