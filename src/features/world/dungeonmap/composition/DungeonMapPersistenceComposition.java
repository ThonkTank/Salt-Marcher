package features.world.dungeonmap.composition;

import features.world.dungeonmap.repository.schema.DungeonSchemaSupport;
import features.world.dungeonmap.service.topology.DungeonTopologyService;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

public final class DungeonMapPersistenceComposition {

    private DungeonMapPersistenceComposition() {
        throw new AssertionError("No instances");
    }

    public static void createSchema(Statement stmt) throws SQLException {
        DungeonSchemaSupport.createSchema(stmt);
    }

    public static void finalizeStartup(Connection conn, Statement stmt) throws SQLException {
        DungeonSchemaSupport.createIndexes(stmt);
        DungeonTopologyService.reconcilePersistedTopologyState(conn);
    }
}
