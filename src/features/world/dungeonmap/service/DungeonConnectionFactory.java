package features.world.dungeonmap.service;

import java.sql.Connection;

@FunctionalInterface
public interface DungeonConnectionFactory {

    Connection getConnection() throws Exception;
}
