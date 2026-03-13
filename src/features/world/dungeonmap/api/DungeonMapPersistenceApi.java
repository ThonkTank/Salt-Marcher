package features.world.dungeonmap.api;

import features.world.dungeonmap.bootstrap.DungeonMapStartupTasks;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Stable startup/bootstrap boundary for dungeon map persistence initialization.
 */
public final class DungeonMapPersistenceApi {

    private DungeonMapPersistenceApi() {
        throw new AssertionError("No instances");
    }

    public static void createSchema(Statement stmt) throws SQLException {
        DungeonMapStartupTasks.createSchema(stmt);
    }

    public static void finalizeStartup(Connection conn, Statement stmt) throws SQLException {
        DungeonMapStartupTasks.finalizeStartup(conn, stmt);
    }
}
