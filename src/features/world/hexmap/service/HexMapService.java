package features.world.hexmap.service;

import database.DatabaseManager;
import features.world.hexmap.model.HexMap;
import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.model.HexTile;
import features.world.hexmap.service.adapter.HexMapCampaignStateAdapter;
import features.world.hexmap.repository.HexTileRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Thin service facade for map-related data access.
 * UI components access hex map data through this class, not directly via repositories.
 */
public final class HexMapService {
    public record MapLoadResult(List<HexTile> tiles, Long partyTileId) {}

    private HexMapService() {
        throw new AssertionError("No instances");
    }

    public static Optional<Long> getFirstMapId(Connection conn) throws SQLException {
        return HexTileRepository.getFirstMapId(conn);
    }

    public static List<HexTile> getTiles(Connection conn, long mapId) throws SQLException {
        return HexTileRepository.getTilesInMap(conn, mapId);
    }

    public static List<HexMap> getAllMaps(Connection conn) throws SQLException {
        return HexTileRepository.getAllMaps(conn);
    }

    public static void updateTerrainType(Connection conn, long tileId, HexTerrainType terrainType) throws SQLException {
        HexTileRepository.updateTerrainType(conn, tileId, terrainType);
    }

    public static List<HexTile> getTiles(long mapId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return HexTileRepository.getTilesInMap(conn, mapId);
        }
    }

    /**
     * Loads tiles for the first available map together with the party tile ID from campaign state.
     * Returns (tiles, partyTileId); partyTileId may be null.
     */
    public static MapLoadResult loadFirstMapWithParty() throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            Optional<Long> mapId = HexTileRepository.getFirstMapId(conn);
            if (mapId.isEmpty()) {
                return new MapLoadResult(List.of(), null);
            }
            Long partyTileId = HexMapCampaignStateAdapter.getPartyTileId(conn).orElse(null);
            List<HexTile> tiles = HexTileRepository.getTilesInMap(conn, mapId.get());
            return new MapLoadResult(tiles, partyTileId);
        }
    }

    public static List<HexTile> loadFirstMap() throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            Optional<Long> mapId = HexTileRepository.getFirstMapId(conn);
            if (mapId.isEmpty()) {
                return List.of();
            }
            return HexTileRepository.getTilesInMap(conn, mapId.get());
        }
    }

    /**
     * Updates map name and radius atomically. If radius changed, grows or shrinks the tile grid.
     */
    public static void updateMap(Connection conn, long mapId, String newName, int oldRadius, int newRadius) throws SQLException {
        if (newRadius < 0 || newRadius > 50) {
            throw new IllegalArgumentException("updateMap: radius must be 0-50, got " + newRadius);
        }

        boolean previousAutoCommit = conn.getAutoCommit();
        conn.setAutoCommit(false);
        try {
            HexTileRepository.updateMap(conn, mapId, newName, newRadius);

            if (newRadius > oldRadius) {
                HexTileRepository.insertTilesForRadius(conn, mapId, newRadius);
            } else if (newRadius < oldRadius) {
                HexMapCampaignStateAdapter.clearPartyTileOutsideRadius(conn, mapId, newRadius);
                HexTileRepository.deleteTilesOutsideRadius(conn, mapId, newRadius);
            }

            conn.commit();
        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(previousAutoCommit);
        }
    }

    /** Persists party position immediately. */
    public static void updatePartyTile(long tileId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            HexMapCampaignStateAdapter.updatePartyTile(conn, tileId);
        }
    }

    /**
     * Creates a new hex map with a filled hexagonal grid of the given radius.
     * Radius 0 = single tile at (0,0). Radius N = all tiles with hex distance <= N from origin.
     * All tiles start as grassland.
     *
     * @return the new map's ID
     */
    public static long createHexMap(Connection conn, String name, int radius) throws SQLException {
        if (radius < 0 || radius > 50) {
            throw new IllegalArgumentException("createHexMap: radius must be 0-50, got " + radius);
        }

        boolean previousAutoCommit = conn.getAutoCommit();
        conn.setAutoCommit(false);
        try {
            HexMap map = new HexMap(null, name, true, radius);
            long mapId = HexTileRepository.insertMap(conn, map);
            HexTileRepository.insertTilesForRadius(conn, mapId, radius);
            conn.commit();
            return mapId;
        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(previousAutoCommit);
        }
    }

    /** Returns the number of tiles in a filled hex grid of the given radius. */
    public static int hexTileCount(int radius) {
        return 3 * radius * (radius + 1) + 1;
    }

    // ---- Connection-owning convenience methods (for background tasks in UI views) ----

    /** Loads all maps; owns the connection lifecycle. */
    public static List<HexMap> getAllMaps() throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return HexTileRepository.getAllMaps(conn);
        }
    }

    /** Creates a hex map; owns the connection lifecycle. */
    public static long createHexMap(String name, int radius) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return createHexMap(conn, name, radius);
        }
    }

    /** Updates map name and radius; owns the connection lifecycle. */
    public static void updateMap(long mapId, String newName, int oldRadius, int newRadius) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            updateMap(conn, mapId, newName, oldRadius, newRadius);
        }
    }

    /** Applies a batch of tileId->terrainType changes in a single transaction; owns the connection lifecycle. */
    public static void batchUpdateTerrain(Map<Long, HexTerrainType> tiles) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                for (var entry : tiles.entrySet()) {
                    HexTileRepository.updateTerrainType(conn, entry.getKey(), entry.getValue());
                }
                conn.commit();
            } catch (Exception e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }
}
