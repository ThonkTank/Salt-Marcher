package features.world.hexmap.service;

import database.DatabaseManager;
import features.world.hexmap.model.HexMap;
import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.model.HexTile;
import features.world.hexmap.service.adapter.HexMapCampaignStateAdapter;

import java.sql.Connection;
import java.util.List;
import java.util.Map;

/**
 * Public facade for map-related data access.
 * UI components access hex map data through this class, while connection-aware helpers stay internal.
 */
public final class HexMapService {
    public record MapLoadResult(List<HexTile> tiles, Long partyTileId) {}

    private HexMapService() {
        throw new AssertionError("No instances");
    }

    public static List<HexTile> getTiles(long mapId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return HexMapSupport.getTiles(conn, mapId);
        }
    }

    /**
     * Loads tiles for the first available map together with the party tile ID from campaign state.
     * Returns (tiles, partyTileId); partyTileId may be null.
     */
    public static MapLoadResult loadFirstMapWithParty() throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            HexMapSupport.MapLoadResult result = HexMapSupport.loadFirstMapWithParty(conn);
            return new MapLoadResult(result.tiles(), result.partyTileId());
        }
    }

    public static List<HexTile> loadFirstMap() throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return HexMapSupport.loadFirstMap(conn);
        }
    }

    /** Persists party position immediately. */
    public static void updatePartyTile(long tileId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            HexMapCampaignStateAdapter.updatePartyTile(conn, tileId);
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
            return HexMapSupport.getAllMaps(conn);
        }
    }

    /** Creates a hex map; owns the connection lifecycle. */
    public static long createHexMap(String name, int radius) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return HexMapSupport.createHexMap(conn, name, radius);
        }
    }

    /** Updates map name and radius; owns the connection lifecycle. */
    public static void updateMap(long mapId, String newName, int oldRadius, int newRadius) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            HexMapSupport.updateMap(conn, mapId, newName, oldRadius, newRadius);
        }
    }

    /** Applies a batch of tileId->terrainType changes in a single transaction; owns the connection lifecycle. */
    public static void batchUpdateTerrain(Map<Long, HexTerrainType> tiles) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            HexMapSupport.batchUpdateTerrain(conn, tiles);
        }
    }
}
