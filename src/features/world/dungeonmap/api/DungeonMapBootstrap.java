package features.world.dungeonmap.api;

import features.world.dungeonmap.repository.DungeonSchemaSupport;
import features.world.dungeonmap.service.linking.DungeonLinkIntegrityService;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Stable startup/bootstrap boundary for dungeon map persistence initialization.
 */
public final class DungeonMapBootstrap {

    private DungeonMapBootstrap() {
        throw new AssertionError("No instances");
    }

    public static void createSchema(Statement stmt) throws SQLException {
        DungeonSchemaSupport.createSchema(stmt);
    }

    public static void finalizeStartup(Connection conn, Statement stmt) throws SQLException {
        DungeonSchemaSupport.createIndexes(stmt);
        DungeonLinkIntegrityService.reconcileAllMaps(conn);
    }
}
