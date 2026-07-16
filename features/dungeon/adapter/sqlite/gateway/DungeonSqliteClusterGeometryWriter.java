package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonClusterBoundaryRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterFloorCellRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.Locale;

final class DungeonSqliteClusterGeometryWriter {

    private static final String INSERT_INTO = "INSERT INTO ";
    private static final String DELETE_FROM = "DELETE FROM ";
    private static final String SQL_WHERE = " WHERE ";
    private static final String COLUMN_CLUSTER_ID = "cluster_id";
    private static final String COLUMN_LEVEL_Z = "level_z";
    private static final String EDGE_TYPE_OPEN = "OPEN";

    private DungeonSqliteClusterGeometryWriter() {
    }

    static void persist(Connection connection, DungeonRoomClusterRecord cluster) throws SQLException {
        upsertRoomCluster(connection, cluster);
        replaceClusterFloorCells(connection, cluster);
        replaceClusterBoundaries(connection, cluster);
    }

    private static void upsertRoomCluster(Connection connection, DungeonRoomClusterRecord cluster) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + " SET name=?, center_x=?, center_y=?, " + COLUMN_LEVEL_Z + "=? WHERE " + COLUMN_CLUSTER_ID
                        + "=? AND dungeon_map_id=?")) {
            update.setString(1, cluster.name());
            update.setInt(2, cluster.centerX());
            update.setInt(3, cluster.centerY());
            update.setInt(4, cluster.levelZ());
            update.setLong(5, cluster.clusterId());
            update.setLong(6, cluster.mapId());
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + "(" + COLUMN_CLUSTER_ID + ", dungeon_map_id, name, center_x, center_y, "
                        + COLUMN_LEVEL_Z + ") VALUES(?,?,?,?,?,?)")) {
            insert.setLong(1, cluster.clusterId());
            insert.setLong(2, cluster.mapId());
            insert.setString(3, cluster.name());
            insert.setInt(4, cluster.centerX());
            insert.setInt(5, cluster.centerY());
            insert.setInt(6, cluster.levelZ());
            insert.executeUpdate();
        }
    }

    private static void replaceClusterFloorCells(Connection connection, DungeonRoomClusterRecord cluster)
            throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.ROOM_CLUSTER_FLOOR_CELLS_TABLE
                        + SQL_WHERE + COLUMN_CLUSTER_ID + "=?")) {
            delete.setLong(1, cluster.clusterId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.ROOM_CLUSTER_FLOOR_CELLS_TABLE
                        + "(" + COLUMN_CLUSTER_ID + ", " + COLUMN_LEVEL_Z
                        + ", cell_x, cell_y) VALUES(?,?,?,?)")) {
            for (DungeonRoomClusterFloorCellRecord floorCell : cluster.floorCells()) {
                insert.setLong(1, cluster.clusterId());
                insert.setInt(2, floorCell.levelZ());
                insert.setInt(3, floorCell.cellX());
                insert.setInt(4, floorCell.cellY());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void replaceClusterBoundaries(Connection connection, DungeonRoomClusterRecord cluster)
            throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE
                        + SQL_WHERE + COLUMN_CLUSTER_ID + "=?")) {
            delete.setLong(1, cluster.clusterId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE
                        + "(" + COLUMN_CLUSTER_ID + ", " + COLUMN_LEVEL_Z
                        + ", cell_x, cell_y, edge_direction, edge_type, topology_element_id)"
                        + " VALUES(?,?,?,?,?,?,?)")) {
            for (DungeonClusterBoundaryRecord boundary : cluster.boundaries()) {
                insert.setLong(1, cluster.clusterId());
                insert.setInt(2, boundary.levelZ());
                insert.setInt(3, boundary.cellX());
                insert.setInt(4, boundary.cellY());
                insert.setString(5, boundary.edgeDirection());
                insert.setString(6, boundary.edgeType());
                DungeonSqliteStatementSupport.setNullableLong(insert, 7, topologyElementId(boundary));
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static Long topologyElementId(DungeonClusterBoundaryRecord boundary) {
        if (openBoundary(boundary)) {
            return null;
        }
        return boundary.topologyElementId();
    }

    private static boolean openBoundary(DungeonClusterBoundaryRecord boundary) {
        String edgeType = boundary.edgeType() == null ? "" : boundary.edgeType().trim().toUpperCase(Locale.ROOT);
        return EDGE_TYPE_OPEN.equals(edgeType);
    }
}
