package src.data.dungeon.gateway.local;

import org.jspecify.annotations.Nullable;
import src.data.dungeon.model.DungeonPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Locale;

final class DungeonSqliteBoundaryTopologyBackfill {

    private static final String SQL_FROM = " FROM ";
    private static final String SQL_UPDATE = "UPDATE ";
    private static final String TOPOLOGY_INSERT_COLUMNS =
            "(dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order)";
    private static final String COLUMN_LEVEL_Z = "level_z";
    private static final String DOOR = "DOOR";

    void apply(Connection connection) throws SQLException {
        backfillClusterBoundaryTopologyElements(connection);
        backfillCorridorDoorTopologyElements(connection);
    }

    private static void backfillClusterBoundaryTopologyElements(Connection connection) throws SQLException {
        String selectSql = "SELECT c.dungeon_map_id, e.cluster_id, c.center_x, c.center_y,"
                + " e.level_z, e.cell_x, e.cell_y, e.edge_direction, e.edge_type"
                + SQL_FROM + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE + " e"
                + " JOIN " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE + " c ON c.cluster_id=e.cluster_id";
        try (PreparedStatement select = connection.prepareStatement(selectSql);
             ResultSet resultSet = select.executeQuery();
             PreparedStatement insert = topologyInsert(connection);
             PreparedStatement update = connection.prepareStatement(
                     SQL_UPDATE + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE
                             + " SET topology_element_id=?"
                             + " WHERE cluster_id=? AND level_z=? AND cell_x=? AND cell_y=? AND edge_direction=?")) {
            int sortOrder = 0;
            while (resultSet.next()) {
                long elementId = boundaryStableId(
                        resultSet.getInt("center_x") + resultSet.getInt("cell_x"),
                        resultSet.getInt("center_y") + resultSet.getInt("cell_y"),
                        resultSet.getInt(COLUMN_LEVEL_Z),
                        resultSet.getString("edge_direction"));
                String kind = boundaryKind(resultSet.getString("edge_type"));
                insertTopologyElement(
                        insert,
                        resultSet.getLong("dungeon_map_id"),
                        kind,
                        elementId,
                        resultSet.getLong("cluster_id"),
                        null,
                        labelFor(kind),
                        sortOrder);
                sortOrder++;
                update.setLong(1, elementId);
                update.setLong(2, resultSet.getLong("cluster_id"));
                update.setInt(3, resultSet.getInt(COLUMN_LEVEL_Z));
                update.setInt(4, resultSet.getInt("cell_x"));
                update.setInt(5, resultSet.getInt("cell_y"));
                update.setString(6, resultSet.getString("edge_direction"));
                update.addBatch();
            }
            insert.executeBatch();
            update.executeBatch();
        }
    }

    private static void backfillCorridorDoorTopologyElements(Connection connection) throws SQLException {
        String selectSql = "SELECT c.dungeon_map_id, d.corridor_id, d.room_id, d.cluster_id,"
                + " rc.center_x, rc.center_y, rc.level_z,"
                + " d.relative_cell_x, d.relative_cell_y, d.edge_direction"
                + SQL_FROM + DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE + " d"
                + " JOIN " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c ON c.corridor_id=d.corridor_id"
                + " JOIN " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE + " rc ON rc.cluster_id=d.cluster_id";
        try (PreparedStatement select = connection.prepareStatement(selectSql);
             ResultSet resultSet = select.executeQuery();
             PreparedStatement insert = topologyInsert(connection);
             PreparedStatement update = connection.prepareStatement(
                     SQL_UPDATE + DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE
                             + " SET topology_element_id=? WHERE corridor_id=? AND room_id=?")) {
            int sortOrder = 0;
            while (resultSet.next()) {
                long elementId = boundaryStableId(
                        resultSet.getInt("center_x") + resultSet.getInt("relative_cell_x"),
                        resultSet.getInt("center_y") + resultSet.getInt("relative_cell_y"),
                        resultSet.getInt(COLUMN_LEVEL_Z),
                        resultSet.getString("edge_direction"));
                insertTopologyElement(
                        insert,
                        resultSet.getLong("dungeon_map_id"),
                        DOOR,
                        elementId,
                        resultSet.getLong("cluster_id"),
                        resultSet.getLong("corridor_id"),
                        "Door " + elementId,
                        sortOrder);
                sortOrder++;
                update.setLong(1, elementId);
                update.setLong(2, resultSet.getLong("corridor_id"));
                update.setLong(3, resultSet.getLong("room_id"));
                update.addBatch();
            }
            insert.executeBatch();
            update.executeBatch();
        }
    }

    private static PreparedStatement topologyInsert(Connection connection) throws SQLException {
        return connection.prepareStatement(
                "INSERT OR REPLACE INTO " + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE
                        + TOPOLOGY_INSERT_COLUMNS
                        + " VALUES(?,?,?,?,?,?,?)");
    }

    private static void insertTopologyElement(
            PreparedStatement statement,
            long mapId,
            String kind,
            long elementId,
            @Nullable Long clusterId,
            @Nullable Long corridorId,
            String label,
            int sortOrder
    ) throws SQLException {
        statement.setLong(1, mapId);
        statement.setString(2, kind);
        statement.setLong(3, elementId);
        DungeonSqliteStatementSupport.setNullableLong(statement, 4, clusterId);
        DungeonSqliteStatementSupport.setNullableLong(statement, 5, corridorId);
        statement.setString(6, label);
        statement.setInt(7, sortOrder);
        statement.addBatch();
    }

    private static String boundaryKind(String value) {
        return DOOR.equalsIgnoreCase(value == null ? "" : value.trim()) ? DOOR : "WALL";
    }

    private static String labelFor(String kind) {
        return DOOR.equals(kind) ? "Door" : "Wall";
    }

    private static long boundaryStableId(int q, int r, int level, String direction) {
        DirectionStep step = DirectionStep.from(direction);
        Cell first = step.start(q, r, level);
        Cell second = step.end(q, r, level);
        Cell lower = compareCells(first, second) <= 0 ? first : second;
        Cell upper = lower.equals(first) ? second : first;
        long hash = 17L;
        hash = 31L * hash + cellHash(lower);
        hash = 31L * hash + cellHash(upper);
        return Math.max(1L, Math.abs(hash));
    }

    private static int compareCells(Cell left, Cell right) {
        int levelComparison = Integer.compare(left.level(), right.level());
        if (levelComparison != 0) {
            return levelComparison;
        }
        int rComparison = Integer.compare(left.r(), right.r());
        return rComparison != 0 ? rComparison : Integer.compare(left.q(), right.q());
    }

    private static long cellHash(Cell cell) {
        long hash = 17L;
        hash = 31L * hash + cell.q();
        hash = 31L * hash + cell.r();
        hash = 31L * hash + cell.level();
        return hash;
    }

    private record Cell(int q, int r, int level) {
    }

    private record DirectionStep(int startDeltaQ, int startDeltaR, int endDeltaQ, int endDeltaR) {

        private static DirectionStep from(String direction) {
            return switch ((direction == null ? "NORTH" : direction.trim()).toUpperCase(Locale.ROOT)) {
                case "EAST" -> new DirectionStep(1, 0, 1, 1);
                case "SOUTH" -> new DirectionStep(0, 1, 1, 1);
                case "WEST" -> new DirectionStep(0, 0, 0, 1);
                default -> new DirectionStep(0, 0, 1, 0);
            };
        }

        private Cell start(int q, int r, int level) {
            return new Cell(q + startDeltaQ, r + startDeltaR, level);
        }

        private Cell end(int q, int r, int level) {
            return new Cell(q + endDeltaQ, r + endDeltaR, level);
        }
    }
}
