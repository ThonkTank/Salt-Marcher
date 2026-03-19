package features.world.quarantine.dungeonmap.foundation.db;

import java.sql.Connection;
import java.sql.SQLException;

@FunctionalInterface
public interface DungeonConnectionFactory {

    Connection getConnection() throws SQLException;
}
