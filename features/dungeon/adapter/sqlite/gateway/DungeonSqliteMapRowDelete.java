package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

final class DungeonSqliteMapRowDelete {

    private DungeonSqliteMapRowDelete() {
    }

    static void delete(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "DELETE FROM " + DungeonPersistenceSchema.MAPS_TABLE + " WHERE dungeon_map_id=?")) {
            statement.setLong(1, mapId);
            statement.executeUpdate();
        }
    }
}
