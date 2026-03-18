package features.world.dungeonmap.foundation.db;

import java.sql.Connection;
import java.sql.SQLException;

@FunctionalInterface
public interface DungeonConnectionFactory {

    Connection getConnection() throws SQLException;
}
