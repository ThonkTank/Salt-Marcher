package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonStairExitRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairPathNodeRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Set;

final class DungeonSqliteStairPersistence {

    private static final String DELETE_FROM = "DELETE FROM ";
    private static final String INSERT_INTO = "INSERT INTO ";
    private static final String WHERE_STAIR_ID = " WHERE stair_id=?";
    private static final String INSERT_STAIR_EXIT_WITH_ID_SQL =
            INSERT_INTO + DungeonPersistenceSchema.STAIR_EXITS_TABLE
                    + "(stair_exit_id, stair_id, cell_x, cell_y, cell_z, label) VALUES(?,?,?,?,?,?)";
    private static final String INSERT_STAIR_EXIT_SQL =
            INSERT_INTO + DungeonPersistenceSchema.STAIR_EXITS_TABLE
                    + "(stair_id, cell_x, cell_y, cell_z, label) VALUES(?,?,?,?,?)";

    private DungeonSqliteStairPersistence() {
    }

    static void persist(Connection connection, DungeonMapRecord record) throws SQLException {
        Set<Long> stairIds = new LinkedHashSet<>();
        for (DungeonStairRecord stair : record.stairs()) {
            stairIds.add(stair.stairId());
            upsertStair(connection, stair);
            replaceStairPathNodes(connection, stair);
            replaceStairExits(connection, stair);
        }
        DungeonSqliteRetainedIdCleanup.deleteObsoleteStairs(connection, record.mapId(), stairIds);
    }

    private static void upsertStair(Connection connection, DungeonStairRecord stair) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.STAIRS_TABLE
                        + " SET name=?, shape=?, direction=?, dimension1=?, dimension2=?, corridor_id=?"
                        + " WHERE stair_id=? AND dungeon_map_id=?")) {
            update.setString(1, stair.name());
            update.setString(2, stair.shape());
            update.setInt(3, stair.direction());
            update.setInt(4, stair.dimension1());
            update.setInt(5, stair.dimension2());
            DungeonSqliteStatementSupport.setNullableLong(update, 6, stair.corridorId());
            update.setLong(7, stair.stairId());
            update.setLong(8, stair.mapId());
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.STAIRS_TABLE
                        + "(stair_id, dungeon_map_id, name, shape, direction, dimension1, dimension2, corridor_id)"
                        + " VALUES(?,?,?,?,?,?,?,?)")) {
            insert.setLong(1, stair.stairId());
            insert.setLong(2, stair.mapId());
            insert.setString(3, stair.name());
            insert.setString(4, stair.shape());
            insert.setInt(5, stair.direction());
            insert.setInt(6, stair.dimension1());
            insert.setInt(7, stair.dimension2());
            DungeonSqliteStatementSupport.setNullableLong(insert, 8, stair.corridorId());
            insert.executeUpdate();
        }
    }

    private static void replaceStairPathNodes(Connection connection, DungeonStairRecord stair) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE + WHERE_STAIR_ID)) {
            delete.setLong(1, stair.stairId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE
                        + "(stair_id, sort_order, cell_x, cell_y, cell_z) VALUES(?,?,?,?,?)")) {
            int sortOrder = 0;
            for (DungeonStairPathNodeRecord node : stair.pathNodes()) {
                insert.setLong(1, stair.stairId());
                insert.setInt(2, sortOrder);
                sortOrder++;
                insert.setInt(3, node.cellX());
                insert.setInt(4, node.cellY());
                insert.setInt(5, node.cellZ());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void replaceStairExits(Connection connection, DungeonStairRecord stair) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.STAIR_EXITS_TABLE + WHERE_STAIR_ID)) {
            delete.setLong(1, stair.stairId());
            delete.executeUpdate();
        }
        for (DungeonStairExitRecord exit : stair.exits()) {
            insertStairExit(connection, stair.stairId(), exit);
        }
    }

    private static void insertStairExit(
            Connection connection,
            long stairId,
            DungeonStairExitRecord exit
    ) throws SQLException {
        if (hasExplicitExitId(exit)) {
            insertStairExitWithId(connection, stairId, exit);
            return;
        }
        insertGeneratedStairExit(connection, stairId, exit);
    }

    private static boolean hasExplicitExitId(DungeonStairExitRecord exit) {
        return exit.exitId() > 0L;
    }

    private static void insertStairExitWithId(Connection connection, long stairId, DungeonStairExitRecord exit)
            throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement(INSERT_STAIR_EXIT_WITH_ID_SQL)) {
            insert.setLong(1, exit.exitId());
            insert.setLong(2, stairId);
            insert.setInt(3, exit.cellX());
            insert.setInt(4, exit.cellY());
            insert.setInt(5, exit.cellZ());
            insert.setString(6, exit.label());
            insert.executeUpdate();
        }
    }

    private static void insertGeneratedStairExit(Connection connection, long stairId, DungeonStairExitRecord exit)
            throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement(INSERT_STAIR_EXIT_SQL)) {
            insert.setLong(1, stairId);
            insert.setInt(2, exit.cellX());
            insert.setInt(3, exit.cellY());
            insert.setInt(4, exit.cellZ());
            insert.setString(5, exit.label());
            insert.executeUpdate();
        }
    }
}
