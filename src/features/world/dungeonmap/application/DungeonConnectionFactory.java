package features.world.dungeonmap.application;

import java.sql.Connection;

@FunctionalInterface
public interface DungeonConnectionFactory {

    Connection getConnection() throws Exception;
}
