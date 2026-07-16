package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

final class DungeonSqliteOpenBoundaryTopologyCleanup {

    private static final String SQL_FROM = " FROM ";
    private static final String SQL_JOIN = " JOIN ";
    private static final String COLUMN_DUNGEON_MAP_ID = "dungeon_map_id";
    private static final String COLUMN_CENTER_X = "center_x";
    private static final String COLUMN_CENTER_Y = "center_y";
    private static final String COLUMN_CELL_X = "cell_x";
    private static final String COLUMN_CELL_Y = "cell_y";
    private static final String COLUMN_LEVEL_Z = "level_z";
    private static final String COLUMN_EDGE_DIRECTION = "edge_direction";
    private static final String ELEMENT_KIND_WALL = "WALL";
    private static final String EDGE_TYPE_OPEN = "OPEN";
    private static final String TEMP_OPEN_BOUNDARY_TOPOLOGY_CLEANUP =
            "temp_open_boundary_topology_cleanup";

    boolean hasStaleOpenBoundaryTopologyRefs(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT 1" + SQL_FROM + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE
                        + " WHERE edge_type=? AND topology_element_id IS NOT NULL LIMIT 1")) {
            statement.setString(1, EDGE_TYPE_OPEN);
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next();
            }
        }
    }

    void apply(Connection connection) throws SQLException {
        createTempOpenBoundaryTopologyTable(connection);
        try {
            clearTempOpenBoundaryTopologyTable(connection);
            collectOpenBoundaryTopologyIds(connection);
            deleteOpenBoundaryTopology(connection);
            clearOpenBoundaryTopologyRefs(connection);
        } finally {
            dropTempOpenBoundaryTopologyTable(connection);
        }
    }

    private static void collectOpenBoundaryTopologyIds(Connection connection) throws SQLException {
        String selectSql = "SELECT c.dungeon_map_id, c.center_x, c.center_y,"
                + " e.level_z, e.cell_x, e.cell_y, e.edge_direction"
                + SQL_FROM + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE + " e"
                + SQL_JOIN + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE + " c ON c.cluster_id=e.cluster_id"
                + " WHERE e.edge_type=?";
        try (PreparedStatement select = connection.prepareStatement(selectSql);
             PreparedStatement insertOpenTopology = connection.prepareStatement(
                     "INSERT OR IGNORE INTO " + TEMP_OPEN_BOUNDARY_TOPOLOGY_CLEANUP
                             + "(dungeon_map_id, element_id) VALUES(?,?)")) {
            select.setString(1, EDGE_TYPE_OPEN);
            try (ResultSet resultSet = select.executeQuery()) {
                while (resultSet.next()) {
                    long elementId = DungeonSqliteBoundaryTopologyBackfill.boundaryStableId(
                            resultSet.getInt(COLUMN_CENTER_X) + resultSet.getInt(COLUMN_CELL_X),
                            resultSet.getInt(COLUMN_CENTER_Y) + resultSet.getInt(COLUMN_CELL_Y),
                            resultSet.getInt(COLUMN_LEVEL_Z),
                            resultSet.getString(COLUMN_EDGE_DIRECTION));
                    long mapId = resultSet.getLong(COLUMN_DUNGEON_MAP_ID);
                    insertOpenTopology.setLong(1, mapId);
                    insertOpenTopology.setLong(2, elementId);
                    insertOpenTopology.addBatch();
                }
            }
            insertOpenTopology.executeBatch();
        }
    }

    private static void deleteOpenBoundaryTopology(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "DELETE FROM " + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE
                        + " WHERE element_kind=?"
                        + " AND EXISTS (SELECT 1" + SQL_FROM + TEMP_OPEN_BOUNDARY_TOPOLOGY_CLEANUP
                        + " open_boundary WHERE open_boundary.dungeon_map_id="
                        + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE + ".dungeon_map_id"
                        + " AND open_boundary.element_id="
                        + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE + ".element_id)"
                        + " AND NOT EXISTS ("
                        + "SELECT 1" + SQL_FROM + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE + " wall_edge"
                        + SQL_JOIN + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE + " wall_cluster"
                        + " ON wall_cluster.cluster_id=wall_edge.cluster_id"
                        + " WHERE wall_cluster.dungeon_map_id="
                        + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE + ".dungeon_map_id"
                        + " AND wall_edge.edge_type=?"
                        + " AND wall_edge.topology_element_id="
                        + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE + ".element_id)")) {
            statement.setString(1, ELEMENT_KIND_WALL);
            statement.setString(2, ELEMENT_KIND_WALL);
            statement.executeUpdate();
        }
    }

    private static void clearOpenBoundaryTopologyRefs(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE
                        + " SET topology_element_id=NULL WHERE edge_type=?")) {
            statement.setString(1, EDGE_TYPE_OPEN);
            statement.executeUpdate();
        }
    }

    private static void createTempOpenBoundaryTopologyTable(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(
                    "CREATE TEMP TABLE IF NOT EXISTS " + TEMP_OPEN_BOUNDARY_TOPOLOGY_CLEANUP
                            + "(dungeon_map_id INTEGER NOT NULL,"
                            + " element_id INTEGER NOT NULL,"
                            + " PRIMARY KEY (dungeon_map_id, element_id))");
        }
    }

    private static void clearTempOpenBoundaryTopologyTable(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("DELETE FROM " + TEMP_OPEN_BOUNDARY_TOPOLOGY_CLEANUP);
        }
    }

    private static void dropTempOpenBoundaryTopologyTable(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("DROP TABLE IF EXISTS " + TEMP_OPEN_BOUNDARY_TOPOLOGY_CLEANUP);
        }
    }
}
