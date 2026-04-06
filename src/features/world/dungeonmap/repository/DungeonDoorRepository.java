package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.StructureObject;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * Canonical storage owner for physical dungeon doors.
 *
 * <p>Clusters and corridors persist only one physical door truth here. Other structures may refer to doors by id,
 * but they must not mirror door geometry or state in parallel tables.
 */
public final class DungeonDoorRepository {

    public StructureObject assignPersistentIds(Connection conn, StructureObject structure) throws SQLException {
        if (structure == null || structure.levelStructures().isEmpty()) {
            return structure == null ? StructureObject.empty() : structure;
        }
        long nextDoorId = nextDoorId(conn);
        StructureObject updated = structure;
        for (Map.Entry<Integer, StructureObject.LevelStructure> entry : structure.levelStructures().entrySet()) {
            int levelZ = entry.getKey();
            List<Door> levelDoors = entry.getValue() == null ? List.of() : entry.getValue().doors();
            if (levelDoors.isEmpty()) {
                continue;
            }
            ArrayList<Door> persistedDoors = new ArrayList<>(levelDoors.size());
            boolean changed = false;
            for (Door door : levelDoors) {
                if (door == null || door.isEmpty()) {
                    continue;
                }
                Door persistedDoor = door;
                if (door.doorId() == null || door.doorId() <= 0L) {
                    persistedDoor = door.withDoorId(nextDoorId++);
                    changed = true;
                }
                persistedDoors.add(persistedDoor);
            }
            if (changed) {
                updated = updated.withDoorsAtLevel(levelZ, persistedDoors);
            }
        }
        return updated;
    }

    public void replaceClusterDoors(Connection conn, long clusterId, StructureObject structure) throws SQLException {
        replaceOwnerDoors(conn, clusterId, null, structure);
    }

    public void replaceCorridorDoors(Connection conn, long corridorId, StructureObject structure) throws SQLException {
        replaceOwnerDoors(conn, null, corridorId, structure);
    }

    public Map<Long, Map<Integer, List<Door>>> loadClusterDoorsByClusterId(Connection conn, long mapId) throws SQLException {
        return loadDoorsByOwner(
                conn,
                "SELECT d.cluster_id AS owner_id, d.door_id, d.level_z, d.anchor_start_x2, d.anchor_start_y2,"
                        + " d.anchor_end_x2, d.anchor_end_y2, d.door_state, s.start_x2, s.start_y2, s.end_x2, s.end_y2"
                        + " FROM dungeon_doors d"
                        + " JOIN dungeon_door_segments s ON s.door_id=d.door_id"
                        + " WHERE d.cluster_id IN (SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)"
                        + " ORDER BY d.cluster_id, d.level_z, d.door_id, s.start_y2, s.start_x2, s.end_y2, s.end_x2",
                mapId);
    }

    public Map<Long, Map<Integer, List<Door>>> loadCorridorDoorsByCorridorId(Connection conn, long mapId) throws SQLException {
        return loadDoorsByOwner(
                conn,
                "SELECT d.corridor_id AS owner_id, d.door_id, d.level_z, d.anchor_start_x2, d.anchor_start_y2,"
                        + " d.anchor_end_x2, d.anchor_end_y2, d.door_state, s.start_x2, s.start_y2, s.end_x2, s.end_y2"
                        + " FROM dungeon_doors d"
                        + " JOIN dungeon_door_segments s ON s.door_id=d.door_id"
                        + " WHERE d.corridor_id IN (SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=?)"
                        + " ORDER BY d.corridor_id, d.level_z, d.door_id, s.start_y2, s.start_x2, s.end_y2, s.end_x2",
                mapId);
    }

    private void replaceOwnerDoors(
            Connection conn,
            Long clusterId,
            Long corridorId,
            StructureObject structure
    ) throws SQLException {
        if (clusterId == null && corridorId == null) {
            throw new IllegalArgumentException("door owner is required");
        }
        String deleteSql = clusterId != null
                ? "DELETE FROM dungeon_doors WHERE cluster_id=?"
                : "DELETE FROM dungeon_doors WHERE corridor_id=?";
        try (PreparedStatement delete = conn.prepareStatement(deleteSql)) {
            delete.setLong(1, clusterId != null ? clusterId : corridorId);
            delete.executeUpdate();
        }
        if (structure == null || structure.levelStructures().isEmpty()) {
            return;
        }
        try (PreparedStatement insertDoor = conn.prepareStatement(
                "INSERT INTO dungeon_doors("
                        + "door_id, cluster_id, corridor_id, level_z, anchor_start_x2, anchor_start_y2, anchor_end_x2, anchor_end_y2, door_state"
                        + ") VALUES(?,?,?,?,?,?,?,?,?)");
             PreparedStatement insertSegment = conn.prepareStatement(
                     "INSERT INTO dungeon_door_segments(door_id, start_x2, start_y2, end_x2, end_y2) VALUES(?,?,?,?,?)")) {
            for (Map.Entry<Integer, StructureObject.LevelStructure> entry : structure.levelStructures().entrySet()) {
                int levelZ = entry.getKey();
                StructureObject.LevelStructure level = entry.getValue();
                if (level == null) {
                    continue;
                }
                for (Door door : level.doors()) {
                    if (door == null || door.isEmpty() || door.doorId() == null || door.doorId() <= 0L) {
                        throw new IllegalArgumentException("Persisted doors require a stable positive door id");
                    }
                    GridSegment2x anchorSegment2x = door.anchorSegment2x() == null ? door.firstSegment2x() : door.anchorSegment2x();
                    insertDoor.setLong(1, door.doorId());
                    if (clusterId == null) {
                        insertDoor.setNull(2, java.sql.Types.BIGINT);
                    } else {
                        insertDoor.setLong(2, clusterId);
                    }
                    if (corridorId == null) {
                        insertDoor.setNull(3, java.sql.Types.BIGINT);
                    } else {
                        insertDoor.setLong(3, corridorId);
                    }
                    insertDoor.setInt(4, levelZ);
                    insertDoor.setInt(5, anchorSegment2x.start().x2());
                    insertDoor.setInt(6, anchorSegment2x.start().y2());
                    insertDoor.setInt(7, anchorSegment2x.end().x2());
                    insertDoor.setInt(8, anchorSegment2x.end().y2());
                    insertDoor.setString(9, door.doorState().name());
                    insertDoor.addBatch();
                    for (GridSegment2x segment2x : door.segments2x().stream().sorted(GridSegment2x.ORDER).toList()) {
                        insertSegment.setLong(1, door.doorId());
                        insertSegment.setInt(2, segment2x.start().x2());
                        insertSegment.setInt(3, segment2x.start().y2());
                        insertSegment.setInt(4, segment2x.end().x2());
                        insertSegment.setInt(5, segment2x.end().y2());
                        insertSegment.addBatch();
                    }
                }
            }
            insertDoor.executeBatch();
            insertSegment.executeBatch();
        }
    }

    private static Map<Long, Map<Integer, List<Door>>> loadDoorsByOwner(
            Connection conn,
            String sql,
            long mapId
    ) throws SQLException {
        Map<Long, Map<Integer, LinkedHashMap<Long, MutableDoor>>> mutable = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long ownerId = rs.getLong("owner_id");
                    int levelZ = rs.getInt("level_z");
                    long doorId = rs.getLong("door_id");
                    GridSegment2x anchorSegment2x = new GridSegment2x(
                            GridPoint2x.raw(rs.getInt("anchor_start_x2"), rs.getInt("anchor_start_y2")),
                            GridPoint2x.raw(rs.getInt("anchor_end_x2"), rs.getInt("anchor_end_y2")));
                    Door.DoorState doorState = Door.DoorState.valueOf(rs.getString("door_state"));
                    LinkedHashMap<Long, MutableDoor> doorsById = mutable
                            .computeIfAbsent(ownerId, ignored -> new LinkedHashMap<>())
                            .computeIfAbsent(levelZ, ignored -> new LinkedHashMap<>());
                    MutableDoor mutableDoor = doorsById.computeIfAbsent(
                            doorId,
                            ignored -> new MutableDoor(doorId, anchorSegment2x, doorState));
                    mutableDoor.segments().add(new GridSegment2x(
                            GridPoint2x.raw(rs.getInt("start_x2"), rs.getInt("start_y2")),
                            GridPoint2x.raw(rs.getInt("end_x2"), rs.getInt("end_y2"))));
                }
            }
        }
        Map<Long, Map<Integer, List<Door>>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Map<Integer, LinkedHashMap<Long, MutableDoor>>> ownerEntry : mutable.entrySet()) {
            Map<Integer, List<Door>> levels = new LinkedHashMap<>();
            for (Map.Entry<Integer, LinkedHashMap<Long, MutableDoor>> levelEntry : ownerEntry.getValue().entrySet()) {
                List<Door> doors = levelEntry.getValue().values().stream()
                        .map(MutableDoor::toDoor)
                        .sorted(Comparator.comparing(Door::anchorSegment2x, GridSegment2x.ORDER))
                        .toList();
                levels.put(levelEntry.getKey(), doors);
            }
            result.put(ownerEntry.getKey(), Map.copyOf(levels));
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static long nextDoorId(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT COALESCE(MAX(door_id), 0) + 1 AS next_id FROM dungeon_doors");
             ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                throw new SQLException("Nächste Tür-ID konnte nicht bestimmt werden");
            }
            return rs.getLong("next_id");
        }
    }

    private record MutableDoor(
            long doorId,
            GridSegment2x anchorSegment2x,
            Door.DoorState doorState,
            LinkedHashSet<GridSegment2x> segments
    ) {
        private MutableDoor(long doorId, GridSegment2x anchorSegment2x, Door.DoorState doorState) {
            this(doorId, anchorSegment2x, doorState, new LinkedHashSet<>());
        }

        private Door toDoor() {
            return Door.fromSegments(doorId, segments, anchorSegment2x, doorState);
        }
    }
}
