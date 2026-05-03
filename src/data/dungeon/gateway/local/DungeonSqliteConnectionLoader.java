package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonCorridorAnchorBindingRecord;
import src.data.dungeon.model.DungeonCorridorAnchorRefRecord;
import src.data.dungeon.model.DungeonCorridorDoorBindingRecord;
import src.data.dungeon.model.DungeonCorridorRecord;
import src.data.dungeon.model.DungeonCorridorWaypointRecord;
import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.dungeon.model.DungeonStairExitRecord;
import src.data.dungeon.model.DungeonStairPathNodeRecord;
import src.data.dungeon.model.DungeonStairRecord;
import src.data.dungeon.model.DungeonTransitionRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class DungeonSqliteConnectionLoader {

    private DungeonSqliteConnectionLoader() {
    }

    static List<DungeonCorridorRecord> loadCorridors(Connection connection, long mapId) throws SQLException {
        Map<Long, List<Long>> roomIdsByCorridor = loadCorridorMembers(connection, mapId);
        Map<Long, List<DungeonCorridorWaypointRecord>> waypointsByCorridor = loadCorridorWaypoints(connection, mapId);
        Map<Long, List<DungeonCorridorDoorBindingRecord>> doorBindingsByCorridor =
                loadCorridorDoorBindings(connection, mapId);
        Map<Long, List<DungeonCorridorAnchorBindingRecord>> anchorBindingsByCorridor =
                loadCorridorAnchorBindings(connection, mapId);
        Map<Long, List<DungeonCorridorAnchorRefRecord>> anchorRefsByCorridor =
                loadCorridorAnchorRefs(connection, mapId);
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT corridor_id, dungeon_map_id, level_z"
                        + " FROM " + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + " WHERE dungeon_map_id=? ORDER BY corridor_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<DungeonCorridorRecord> records = new ArrayList<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong("corridor_id");
                    records.add(new DungeonCorridorRecord(
                            corridorId,
                            resultSet.getLong("dungeon_map_id"),
                            resultSet.getInt("level_z"),
                            roomIdsByCorridor.getOrDefault(corridorId, List.of()),
                            waypointsByCorridor.getOrDefault(corridorId, List.of()),
                            doorBindingsByCorridor.getOrDefault(corridorId, List.of()),
                            anchorBindingsByCorridor.getOrDefault(corridorId, List.of()),
                            anchorRefsByCorridor.getOrDefault(corridorId, List.of())));
                }
                return List.copyOf(records);
            }
        }
    }

    static List<DungeonStairRecord> loadStairs(Connection connection, long mapId) throws SQLException {
        Map<Long, List<DungeonStairPathNodeRecord>> pathNodesByStair = loadStairPathNodes(connection, mapId);
        Map<Long, List<DungeonStairExitRecord>> exitsByStair = loadStairExits(connection, mapId);
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT stair_id, dungeon_map_id, name, shape, direction, dimension1, dimension2, corridor_id"
                        + " FROM " + DungeonPersistenceSchema.STAIRS_TABLE
                        + " WHERE dungeon_map_id=? ORDER BY stair_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<DungeonStairRecord> records = new ArrayList<>();
                while (resultSet.next()) {
                    long stairId = resultSet.getLong("stair_id");
                    records.add(new DungeonStairRecord(
                            stairId,
                            resultSet.getLong("dungeon_map_id"),
                            resultSet.getString("name"),
                            resultSet.getString("shape"),
                            resultSet.getInt("direction"),
                            resultSet.getInt("dimension1"),
                            resultSet.getInt("dimension2"),
                            DungeonSqliteStatementSupport.nullableLong(resultSet, "corridor_id"),
                            pathNodesByStair.getOrDefault(stairId, List.of()),
                            exitsByStair.getOrDefault(stairId, List.of())));
                }
                return List.copyOf(records);
            }
        }
    }

    static List<DungeonTransitionRecord> loadTransitions(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT transition_id, dungeon_map_id, description, cell_x, cell_y, level_z, destination_type,"
                        + " target_overworld_map_id, target_overworld_tile_id, target_dungeon_map_id,"
                        + " target_transition_id, linked_transition_id"
                        + " FROM " + DungeonPersistenceSchema.TRANSITIONS_TABLE
                        + " WHERE dungeon_map_id=? ORDER BY transition_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<DungeonTransitionRecord> records = new ArrayList<>();
                while (resultSet.next()) {
                    records.add(new DungeonTransitionRecord(
                            resultSet.getLong("transition_id"),
                            resultSet.getLong("dungeon_map_id"),
                            resultSet.getString("description"),
                            DungeonSqliteStatementSupport.nullableInteger(resultSet, "cell_x"),
                            DungeonSqliteStatementSupport.nullableInteger(resultSet, "cell_y"),
                            DungeonSqliteStatementSupport.nullableInteger(resultSet, "level_z"),
                            resultSet.getString("destination_type"),
                            DungeonSqliteStatementSupport.nullableLong(resultSet, "target_overworld_map_id"),
                            DungeonSqliteStatementSupport.nullableLong(resultSet, "target_overworld_tile_id"),
                            DungeonSqliteStatementSupport.nullableLong(resultSet, "target_dungeon_map_id"),
                            DungeonSqliteStatementSupport.nullableLong(resultSet, "target_transition_id"),
                            DungeonSqliteStatementSupport.nullableLong(resultSet, "linked_transition_id")));
                }
                return List.copyOf(records);
            }
        }
    }

    private static Map<Long, List<Long>> loadCorridorMembers(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT c.corridor_id, m.room_id"
                        + " FROM " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c"
                        + " LEFT JOIN " + DungeonPersistenceSchema.CORRIDOR_MEMBERS_TABLE
                        + " m ON m.corridor_id=c.corridor_id"
                        + " WHERE c.dungeon_map_id=?"
                        + " ORDER BY c.corridor_id, m.member_order, m.room_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<Long>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong("corridor_id");
                    records.computeIfAbsent(corridorId, ignored -> new ArrayList<>());
                    long roomId = resultSet.getLong("room_id");
                    if (!resultSet.wasNull()) {
                        records.get(corridorId).add(roomId);
                    }
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }

    private static Map<Long, List<DungeonCorridorWaypointRecord>> loadCorridorWaypoints(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT corridor_id, cluster_id, relative_x, relative_y, relative_z"
                        + " FROM " + DungeonPersistenceSchema.CORRIDOR_WAYPOINTS_TABLE
                        + " WHERE corridor_id IN (SELECT corridor_id FROM "
                        + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + " WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, sort_order")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonCorridorWaypointRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong("corridor_id");
                    records.computeIfAbsent(corridorId, ignored -> new ArrayList<>())
                            .add(new DungeonCorridorWaypointRecord(
                                    corridorId,
                                    resultSet.getLong("cluster_id"),
                                    resultSet.getInt("relative_x"),
                                    resultSet.getInt("relative_y"),
                                    resultSet.getInt("relative_z")));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }

    private static Map<Long, List<DungeonCorridorDoorBindingRecord>> loadCorridorDoorBindings(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT corridor_id, room_id, cluster_id, relative_cell_x, relative_cell_y,"
                        + " edge_direction, topology_element_id"
                        + " FROM " + DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE
                        + " WHERE corridor_id IN (SELECT corridor_id FROM "
                        + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + " WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, sort_order, room_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonCorridorDoorBindingRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong("corridor_id");
                    records.computeIfAbsent(corridorId, ignored -> new ArrayList<>())
                            .add(new DungeonCorridorDoorBindingRecord(
                                    corridorId,
                                    resultSet.getLong("room_id"),
                                    resultSet.getLong("cluster_id"),
                                    resultSet.getInt("relative_cell_x"),
                                    resultSet.getInt("relative_cell_y"),
                                    resultSet.getString("edge_direction"),
                                    DungeonSqliteStatementSupport.nullableLong(resultSet, "topology_element_id")));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }

    private static Map<Long, List<DungeonCorridorAnchorBindingRecord>> loadCorridorAnchorBindings(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT corridor_id, anchor_id, host_corridor_id, cell_x, cell_y, cell_z, topology_element_id"
                        + " FROM " + DungeonPersistenceSchema.CORRIDOR_ANCHORS_TABLE
                        + " WHERE corridor_id IN (SELECT corridor_id FROM "
                        + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + " WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, sort_order, anchor_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonCorridorAnchorBindingRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong("corridor_id");
                    records.computeIfAbsent(corridorId, ignored -> new ArrayList<>())
                            .add(new DungeonCorridorAnchorBindingRecord(
                                    corridorId,
                                    resultSet.getLong("anchor_id"),
                                    resultSet.getLong("host_corridor_id"),
                                    resultSet.getInt("cell_x"),
                                    resultSet.getInt("cell_y"),
                                    resultSet.getInt("cell_z"),
                                    DungeonSqliteStatementSupport.nullableLong(resultSet, "topology_element_id")));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }

    private static Map<Long, List<DungeonCorridorAnchorRefRecord>> loadCorridorAnchorRefs(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT corridor_id, host_corridor_id, topology_element_id"
                        + " FROM " + DungeonPersistenceSchema.CORRIDOR_ANCHOR_REFS_TABLE
                        + " WHERE corridor_id IN (SELECT corridor_id FROM "
                        + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + " WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, sort_order, topology_element_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonCorridorAnchorRefRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong("corridor_id");
                    records.computeIfAbsent(corridorId, ignored -> new ArrayList<>())
                            .add(new DungeonCorridorAnchorRefRecord(
                                    corridorId,
                                    resultSet.getLong("host_corridor_id"),
                                    DungeonSqliteStatementSupport.nullableLong(resultSet, "topology_element_id")));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }

    private static Map<Long, List<DungeonStairPathNodeRecord>> loadStairPathNodes(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT stair_id, cell_x, cell_y, cell_z"
                        + " FROM " + DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE
                        + " WHERE stair_id IN (SELECT stair_id FROM "
                        + DungeonPersistenceSchema.STAIRS_TABLE
                        + " WHERE dungeon_map_id=?)"
                        + " ORDER BY stair_id, sort_order")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonStairPathNodeRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long stairId = resultSet.getLong("stair_id");
                    records.computeIfAbsent(stairId, ignored -> new ArrayList<>())
                            .add(new DungeonStairPathNodeRecord(
                                    stairId,
                                    resultSet.getInt("cell_x"),
                                    resultSet.getInt("cell_y"),
                                    resultSet.getInt("cell_z")));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }

    private static Map<Long, List<DungeonStairExitRecord>> loadStairExits(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT stair_id, stair_exit_id, cell_x, cell_y, cell_z, label"
                        + " FROM " + DungeonPersistenceSchema.STAIR_EXITS_TABLE
                        + " WHERE stair_id IN (SELECT stair_id FROM "
                        + DungeonPersistenceSchema.STAIRS_TABLE
                        + " WHERE dungeon_map_id=?)"
                        + " ORDER BY stair_id, stair_exit_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonStairExitRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long stairId = resultSet.getLong("stair_id");
                    records.computeIfAbsent(stairId, ignored -> new ArrayList<>())
                            .add(new DungeonStairExitRecord(
                                    stairId,
                                    resultSet.getLong("stair_exit_id"),
                                    resultSet.getInt("cell_x"),
                                    resultSet.getInt("cell_y"),
                                    resultSet.getInt("cell_z"),
                                    resultSet.getString("label")));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }
}
