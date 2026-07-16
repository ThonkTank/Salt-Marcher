package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonMapRecord;

import java.sql.Connection;
import java.sql.SQLException;

final class DungeonSqliteConnectionPersistence {

    private DungeonSqliteConnectionPersistence() {
    }

    static void persist(Connection connection, DungeonMapRecord record) throws SQLException {
        DungeonSqliteCorridorPersistence.persist(connection, record);
        DungeonSqliteStairPersistence.persist(connection, record);
        DungeonSqliteTransitionPersistence.persist(connection, record);
        DungeonSqliteFeatureMarkerPersistence.persist(connection, record);
    }
}
