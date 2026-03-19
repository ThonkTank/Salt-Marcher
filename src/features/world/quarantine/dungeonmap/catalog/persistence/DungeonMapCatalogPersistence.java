package features.world.quarantine.dungeonmap.catalog.persistence;

import features.world.quarantine.dungeonmap.catalog.model.DungeonMap;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

/**
 * Public persistence entry point for dungeon map catalog operations.
 */
public final class DungeonMapCatalogPersistence {

    private DungeonMapCatalogPersistence() {
        throw new AssertionError("No instances");
    }

    public static Optional<Long> firstMapId(Connection conn) throws SQLException {
        return DungeonMapCatalogRepository.firstMapId(conn);
    }

    public static List<DungeonMap> getAllMaps(Connection conn) throws SQLException {
        return DungeonMapCatalogRepository.getAllMaps(conn);
    }

    public static long insertMap(Connection conn, String name) throws SQLException {
        return DungeonMapCatalogRepository.insertMap(conn, name);
    }

    public static void updateMapName(Connection conn, long mapId, String name) throws SQLException {
        DungeonMapCatalogRepository.updateMapName(conn, mapId, name);
    }

    public static void deleteMap(Connection conn, long mapId) throws SQLException {
        DungeonMapCatalogRepository.deleteMap(conn, mapId);
    }
}
