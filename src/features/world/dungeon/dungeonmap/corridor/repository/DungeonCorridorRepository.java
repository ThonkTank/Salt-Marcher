package features.world.dungeon.dungeonmap.corridor.repository;

import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.corridor.model.CorridorDraft;
import features.world.dungeon.dungeonmap.corridor.model.CorridorMember;
import features.world.dungeon.dungeonmap.corridor.model.CorridorTerminal;
import features.world.dungeon.dungeonmap.corridor.model.CorridorWaypoint;
import features.world.dungeon.dungeonmap.model.CorridorRehydrationRequest;
import features.world.dungeon.dungeonmap.model.DungeonMap;
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

    public List<Corridor> loadByMap(Connection conn, DungeonMap layout) throws SQLException {
        DungeonMap resolvedLayout = Objects.requireNonNull(layout, "layout");
        long mapId = resolvedLayout.mapId();

        Map<Long, List<CorridorMember>> membersByCorridorId = loadGrouped(
                conn,
                "SELECT member_id, corridor_id, door_id, terminal_x2, terminal_y2, host_member_id, host_waypoint_id"
                        + " FROM dungeon_corridor_members"
                        + " WHERE corridor_id IN (SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, member_id",
                mapId,
                rs -> rs.getLong("corridor_id"),
                DungeonCorridorRepository::memberFromRow);
        Map<Long, List<CorridorWaypoint>> waypointsByCorridorId = loadGrouped(
                conn,
                "SELECT waypoint_id, corridor_id, member_id, waypoint_order, grid_x2, grid_y2"
                        + " FROM dungeon_corridor_waypoints"
                        + " WHERE corridor_id IN (SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, member_id, waypoint_order, waypoint_id",
                mapId,
                rs -> rs.getLong("corridor_id"),
                DungeonCorridorRepository::waypointFromRow);

        Map<Long, Long> structureIdsByCorridorId = new LinkedHashMap<>();
        Map<Long, CorridorTerminal> rootTerminalsByCorridorId = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT corridor_id, structure_object_id, root_door_id, root_point_x2, root_point_y2"
                        + " FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long corridorId = rs.getLong("corridor_id");
                    structureIdsByCorridorId.put(corridorId, rs.getLong("structure_object_id"));
                    rootTerminalsByCorridorId.put(corridorId, terminalFromColumns(
                            nullableLong(rs, "root_door_id"),
                            nullableInt(rs, "root_point_x2"),
                            nullableInt(rs, "root_point_y2")));
                }
            }
        }
        Map<Long, Structure> structuresById = structureRepository.loadByIds(conn, structureIdsByCorridorId.values());

        ArrayList<Corridor> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT corridor_id, dungeon_map_id, structure_object_id FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long corridorId = rs.getLong("corridor_id");
                    long structureObjectId = rs.getLong("structure_object_id");
                    Structure structure = structuresById.get(structureObjectId);
                    int levelZ = structure == null ? 0 : structure.primaryLevel();
                    if (structure == null || structure.surfaceAtLevel(levelZ).isEmpty()) {
                        throw new IllegalStateException("Corridor " + corridorId + " hat kein persistiertes Structure");
                    }
                    CorridorDraft draft = new CorridorDraft(
                            corridorId,
                            structureObjectId,
                            mapId,
                            levelZ,
                            terminalAtLevel(Objects.requireNonNull(rootTerminalsByCorridorId.get(corridorId), "rootTerminal"), levelZ),
                            membersAtLevel(membersByCorridorId.getOrDefault(corridorId, List.of()), levelZ),
                            waypointsAtLevel(waypointsByCorridorId.getOrDefault(corridorId, List.of()), levelZ));
                    result.add(resolvedLayout.rehydrateCorridor(new CorridorRehydrationRequest(draft, structure)));
                }
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    public Corridor save(Connection conn, Corridor corridor, DungeonMap layout) throws SQLException {
        DungeonMap resolvedLayout = Objects.requireNonNull(layout, "layout");
        Corridor resolvedCorridor = Objects.requireNonNull(corridor, "corridor");
        CorridorDraft persistedDraft = assignPersistentIds(conn, resolvedCorridor.draft());
        DungeonStructureRepository.PersistedStructure persistedStructure =
                structureRepository.save(conn, persistedDraft.structureObjectId(), resolvedCorridor);
        Long corridorId = persistedDraft.corridorId();
        if (corridorId == null) {
            corridorId = insertCorridor(conn, resolvedLayout.mapId(), persistedStructure.structureObjectId(), persistedDraft.rootTerminal());
        } else {
            updateCorridor(conn, corridorId, persistedStructure.structureObjectId(), persistedDraft.rootTerminal());
        }
        CorridorDraft persistedWithIds = new CorridorDraft(
                corridorId,
                persistedStructure.structureObjectId(),
                resolvedLayout.mapId(),
                persistedDraft.levelZ(),
                persistedDraft.rootTerminal(),
                persistedDraft.members(),
                persistedDraft.waypoints());
        replaceMembers(conn, corridorId, persistedWithIds.members());
        replaceWaypoints(conn, corridorId, persistedWithIds.waypoints());
        return resolvedLayout.rehydrateCorridor(new CorridorRehydrationRequest(persistedWithIds, persistedStructure.structure()));
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

    private CorridorDraft assignPersistentIds(Connection conn, CorridorDraft draft) throws SQLException {
        CorridorDraft resolvedDraft = Objects.requireNonNull(draft, "draft");
        long nextMemberId = nextId(conn, "dungeon_corridor_members", "member_id");
        long nextWaypointId = nextId(conn, "dungeon_corridor_waypoints", "waypoint_id");

        LinkedHashMap<Long, Long> memberIdRemap = new LinkedHashMap<>();
        ArrayList<CorridorMember> members = new ArrayList<>();
        for (CorridorMember member : resolvedDraft.members()) {
            Long persistedMemberId = member.memberId();
            if (persistedMemberId == null || persistedMemberId <= 0) {
                persistedMemberId = nextMemberId++;
            }
            if (member.memberId() != null && member.memberId() <= 0) {
                memberIdRemap.put(member.memberId(), persistedMemberId);
            }
            members.add(new CorridorMember(
                    persistedMemberId,
                    member.terminal(),
                    remapId(member.hostMemberId(), memberIdRemap),
                    member.hostWaypointId()));
        }

        LinkedHashMap<Long, Long> waypointIdRemap = new LinkedHashMap<>();
        ArrayList<CorridorWaypoint> waypoints = new ArrayList<>();
        for (CorridorWaypoint waypoint : resolvedDraft.waypoints()) {
            Long persistedWaypointId = waypoint.waypointId();
            if (persistedWaypointId == null || persistedWaypointId <= 0) {
                persistedWaypointId = nextWaypointId++;
            }
            if (waypoint.waypointId() != null && waypoint.waypointId() <= 0) {
                waypointIdRemap.put(waypoint.waypointId(), persistedWaypointId);
            }
            waypoints.add(new CorridorWaypoint(
                    persistedWaypointId,
                    remapId(waypoint.memberId(), memberIdRemap),
                    waypoint.waypointOrder(),
                    waypoint.point()));
        }

        ArrayList<CorridorMember> remappedMembers = new ArrayList<>(members.size());
        for (CorridorMember member : members) {
            remappedMembers.add(new CorridorMember(
                    member.memberId(),
                    member.terminal(),
                    remapId(member.hostMemberId(), memberIdRemap),
                    remapId(member.hostWaypointId(), waypointIdRemap)));
        }

        return new CorridorDraft(
                resolvedDraft.corridorId(),
                resolvedDraft.structureObjectId(),
                resolvedDraft.mapId(),
                resolvedDraft.levelZ(),
                resolvedDraft.rootTerminal(),
                remappedMembers,
                waypoints);
    }

    private long insertCorridor(
            Connection conn,
            long mapId,
            long structureObjectId,
            CorridorTerminal rootTerminal
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_corridors("
                        + "dungeon_map_id, structure_object_id, root_door_id, root_point_x2, root_point_y2"
                        + ") VALUES(?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, structureObjectId);
            bindTerminal(ps, 3, rootTerminal);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_corridors insert");
                }
                return rs.getLong(1);
            }
        }
    }

    private void updateCorridor(
            Connection conn,
            long corridorId,
            long structureObjectId,
            CorridorTerminal rootTerminal
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_corridors"
                        + " SET structure_object_id=?, root_door_id=?, root_point_x2=?, root_point_y2=?"
                        + " WHERE corridor_id=?")) {
            ps.setLong(1, structureObjectId);
            bindTerminal(ps, 2, rootTerminal);
            ps.setLong(5, corridorId);
            ps.executeUpdate();
        }
    }

    private void replaceMembers(Connection conn, long corridorId, List<CorridorMember> members) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_members WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_members("
                        + "member_id, corridor_id, door_id, terminal_x2, terminal_y2, host_member_id, host_waypoint_id"
                        + ") VALUES(?,?,?,?,?,?,?)")) {
            for (CorridorMember member : sanitizedMembers(members)) {
                insert.setLong(1, requiredId(member.memberId(), "corridor member"));
                insert.setLong(2, corridorId);
                bindTerminal(insert, 3, member.terminal());
                if (member.hostMemberId() == null) {
                    insert.setNull(6, java.sql.Types.BIGINT);
                    insert.setNull(7, java.sql.Types.BIGINT);
                } else {
                    insert.setLong(6, member.hostMemberId());
                    insert.setLong(7, requiredId(member.hostWaypointId(), "corridor host waypoint"));
                }
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private void replaceWaypoints(Connection conn, long corridorId, List<CorridorWaypoint> waypoints) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_waypoints WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_waypoints("
                        + "waypoint_id, corridor_id, member_id, waypoint_order, grid_x2, grid_y2"
                        + ") VALUES(?,?,?,?,?,?)")) {
            for (CorridorWaypoint waypoint : sanitizedWaypoints(waypoints)) {
                insert.setLong(1, requiredId(waypoint.waypointId(), "corridor waypoint"));
                insert.setLong(2, corridorId);
                insert.setLong(3, requiredId(waypoint.memberId(), "corridor member"));
                insert.setInt(4, waypoint.waypointOrder());
                insert.setInt(5, waypoint.point().x2());
                insert.setInt(6, waypoint.point().y2());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static CorridorMember memberFromRow(ResultSet rs) throws SQLException {
        return new CorridorMember(
                rs.getLong("member_id"),
                terminalFromColumns(
                        nullableLong(rs, "door_id"),
                        nullableInt(rs, "terminal_x2"),
                        nullableInt(rs, "terminal_y2")),
                nullableLong(rs, "host_member_id"),
                nullableLong(rs, "host_waypoint_id"));
    }

    private static CorridorWaypoint waypointFromRow(ResultSet rs) throws SQLException {
        return new CorridorWaypoint(
                rs.getLong("waypoint_id"),
                rs.getLong("member_id"),
                rs.getInt("waypoint_order"),
                GridPoint.lattice(rs.getInt("grid_x2"), rs.getInt("grid_y2"), 0));
    }

    private static List<CorridorMember> membersAtLevel(List<CorridorMember> members, int levelZ) {
        if (members == null || members.isEmpty()) {
            return List.of();
        }
        return members.stream()
                .map(member -> new CorridorMember(
                        member.memberId(),
                        terminalAtLevel(member.terminal(), levelZ),
                        member.hostMemberId(),
                        member.hostWaypointId()))
                .toList();
    }

    private static List<CorridorWaypoint> waypointsAtLevel(List<CorridorWaypoint> waypoints, int levelZ) {
        if (waypoints == null || waypoints.isEmpty()) {
            return List.of();
        }
        return waypoints.stream()
                .map(waypoint -> new CorridorWaypoint(
                        waypoint.waypointId(),
                        waypoint.memberId(),
                        waypoint.waypointOrder(),
                        GridPoint.lattice(waypoint.point().x2(), waypoint.point().y2(), levelZ)))
                .toList();
    }

    private static CorridorTerminal terminalAtLevel(CorridorTerminal terminal, int levelZ) {
        if (terminal instanceof CorridorTerminal.PointTerminal pointTerminal) {
            return new CorridorTerminal.PointTerminal(
                    GridPoint.lattice(pointTerminal.point().x2(), pointTerminal.point().y2(), levelZ));
        }
        return terminal;
    }

    private static CorridorTerminal terminalFromColumns(
            Long doorId,
            Integer x2,
            Integer y2
    ) {
        if (doorId != null) {
            return new CorridorTerminal.DoorTerminal(new DoorRef(doorId));
        }
        if (x2 == null || y2 == null) {
            throw new IllegalArgumentException("Corridor terminal persistence requires a door ref or point");
        }
        return new CorridorTerminal.PointTerminal(GridPoint.lattice(x2, y2, 0));
    }

    private static void bindTerminal(
            PreparedStatement ps,
            int startIndex,
            CorridorTerminal terminal
    ) throws SQLException {
        if (terminal instanceof CorridorTerminal.DoorTerminal doorTerminal) {
            ps.setLong(startIndex, doorTerminal.doorRef().doorId());
            ps.setNull(startIndex + 1, java.sql.Types.INTEGER);
            ps.setNull(startIndex + 2, java.sql.Types.INTEGER);
            return;
        }
        CorridorTerminal.PointTerminal pointTerminal = (CorridorTerminal.PointTerminal) terminal;
        ps.setNull(startIndex, java.sql.Types.BIGINT);
        ps.setInt(startIndex + 1, pointTerminal.point().x2());
        ps.setInt(startIndex + 2, pointTerminal.point().y2());
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

    private static Long remapId(Long id, Map<Long, Long> remap) {
        if (id == null) {
            return null;
        }
        return remap.getOrDefault(id, id);
    }

    private static long requiredId(Long id, String label) {
        if (id == null) {
            throw new IllegalArgumentException(label + " id is required for persistence");
        }
        return id;
    }

    private static List<CorridorMember> sanitizedMembers(List<CorridorMember> members) {
        if (members == null || members.isEmpty()) {
            return List.of();
        }
        return members.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(member -> member.memberId() == null ? Long.MAX_VALUE : member.memberId()))
                .toList();
    }

    private static List<CorridorWaypoint> sanitizedWaypoints(List<CorridorWaypoint> waypoints) {
        if (waypoints == null || waypoints.isEmpty()) {
            return List.of();
        }
        return waypoints.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparing(CorridorWaypoint::memberId)
                        .thenComparingInt(CorridorWaypoint::waypointOrder)
                        .thenComparing(waypoint -> waypoint.waypointId() == null ? Long.MAX_VALUE : waypoint.waypointId()))
                .toList();
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private static Integer nullableInt(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
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
                    result.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
                }
            }
        }
        return result;
    }

    @FunctionalInterface
    private interface ResultSetMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }
}
