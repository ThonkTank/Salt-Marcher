package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorRefRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorDoorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorWaypointRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonStairExitRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairPathNodeRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairRecord;
import features.dungeon.adapter.sqlite.model.DungeonTransitionRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class DungeonSqliteConnectionLoader {

    private static final String SQL_FROM = " FROM ";
    private static final String COLUMN_CORRIDOR_ID = "corridor_id";
    private static final String COLUMN_CELL_X = "cell_x";
    private static final String COLUMN_CELL_Y = "cell_y";
    private static final String WHERE_CORRIDOR_ID_IN_SELECT = " WHERE corridor_id IN (SELECT corridor_id FROM ";
    private static final String WHERE_DUNGEON_MAP_ID_SUBQUERY = " WHERE dungeon_map_id=?)";

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
                        + SQL_FROM + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + " WHERE dungeon_map_id=? ORDER BY corridor_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<DungeonCorridorRecord> records = new ArrayList<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong(COLUMN_CORRIDOR_ID);
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
                        + SQL_FROM + DungeonPersistenceSchema.STAIRS_TABLE
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
        return DungeonSqliteTransitionLoader.loadTransitions(connection, mapId);
    }

    private static Map<Long, List<Long>> loadCorridorMembers(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT c.corridor_id, m.room_id"
                        + SQL_FROM + DungeonPersistenceSchema.CORRIDORS_TABLE + " c"
                        + " LEFT JOIN " + DungeonPersistenceSchema.CORRIDOR_MEMBERS_TABLE
                        + " m ON m.corridor_id=c.corridor_id"
                        + " WHERE c.dungeon_map_id=?"
                        + " ORDER BY c.corridor_id, m.member_order, m.room_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<Long>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong(COLUMN_CORRIDOR_ID);
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
                        + SQL_FROM + DungeonPersistenceSchema.CORRIDOR_WAYPOINTS_TABLE
                        + WHERE_CORRIDOR_ID_IN_SELECT
                        + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + WHERE_DUNGEON_MAP_ID_SUBQUERY
                        + " ORDER BY corridor_id, sort_order")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonCorridorWaypointRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong(COLUMN_CORRIDOR_ID);
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
                "SELECT corridor_id, room_id, cluster_id, relative_cell_x, relative_cell_y, relative_cell_z,"
                        + " edge_direction, topology_element_id"
                        + SQL_FROM + DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE
                        + WHERE_CORRIDOR_ID_IN_SELECT
                        + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + WHERE_DUNGEON_MAP_ID_SUBQUERY
                        + " ORDER BY corridor_id, sort_order, room_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonCorridorDoorBindingRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong(COLUMN_CORRIDOR_ID);
                    records.computeIfAbsent(corridorId, ignored -> new ArrayList<>())
                            .add(new DungeonCorridorDoorBindingRecord(
                                    corridorId,
                                    resultSet.getLong("room_id"),
                                    resultSet.getLong("cluster_id"),
                                    resultSet.getInt("relative_cell_x"),
                                    resultSet.getInt("relative_cell_y"),
                                    resultSet.getInt("relative_cell_z"),
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
                        + SQL_FROM + DungeonPersistenceSchema.CORRIDOR_ANCHORS_TABLE
                        + WHERE_CORRIDOR_ID_IN_SELECT
                        + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + WHERE_DUNGEON_MAP_ID_SUBQUERY
                        + " ORDER BY corridor_id, sort_order, anchor_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonCorridorAnchorBindingRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong(COLUMN_CORRIDOR_ID);
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
                        + SQL_FROM + DungeonPersistenceSchema.CORRIDOR_ANCHOR_REFS_TABLE
                        + WHERE_CORRIDOR_ID_IN_SELECT
                        + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + WHERE_DUNGEON_MAP_ID_SUBQUERY
                        + " ORDER BY corridor_id, sort_order, topology_element_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonCorridorAnchorRefRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong(COLUMN_CORRIDOR_ID);
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
                        + SQL_FROM + DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE
                        + " WHERE stair_id IN (SELECT stair_id FROM "
                        + DungeonPersistenceSchema.STAIRS_TABLE
                        + WHERE_DUNGEON_MAP_ID_SUBQUERY
                        + " ORDER BY stair_id, sort_order")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonStairPathNodeRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long stairId = resultSet.getLong("stair_id");
                    records.computeIfAbsent(stairId, ignored -> new ArrayList<>())
                            .add(new DungeonStairPathNodeRecord(
                                    stairId,
                                    resultSet.getInt(COLUMN_CELL_X),
                                    resultSet.getInt(COLUMN_CELL_Y),
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
                        + SQL_FROM + DungeonPersistenceSchema.STAIR_EXITS_TABLE
                        + " WHERE stair_id IN (SELECT stair_id FROM "
                        + DungeonPersistenceSchema.STAIRS_TABLE
                        + WHERE_DUNGEON_MAP_ID_SUBQUERY
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
                                    resultSet.getInt(COLUMN_CELL_X),
                                    resultSet.getInt(COLUMN_CELL_Y),
                                    resultSet.getInt("cell_z"),
                                    resultSet.getString("label")));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }
}
