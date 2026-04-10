package features.world.hexmap.service;

import features.world.hexmap.catalog.CatalogObject;
import features.world.hexmap.catalog.input.CreateMapInput;
import features.world.hexmap.catalog.input.FlushTerrainChangesInput;
import features.world.hexmap.catalog.input.LoadFirstMapInput;
import features.world.hexmap.catalog.input.LoadInitialMapInput;
import features.world.hexmap.catalog.input.LoadMapInput;
import features.world.hexmap.catalog.input.LoadMapListInput;
import features.world.hexmap.catalog.input.UpdateMapInput;
import features.world.hexmap.catalog.input.UpdatePartyTileInput;
import features.world.hexmap.model.HexMap;
import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.model.HexTile;
import java.util.List;
import java.util.Map;

/**
 * Public facade for map-related data access.
 * UI components access hex map data through this class, while connection-aware helpers stay internal.
 */
@SuppressWarnings("unused")
public final class HexMapService {
    private static final CatalogObject CATALOG_OBJECT = new CatalogObject();

    public record MapLoadResult(List<HexTile> tiles, Long partyTileId) {}

    private HexMapService() {
        throw new AssertionError("No instances");
    }

    public static List<HexTile> getTiles(long mapId) throws Exception {
        return CATALOG_OBJECT.loadMap(new LoadMapInput(mapId)).tiles();
    }

    /**
     * Loads tiles for the first available map together with the party tile ID from campaign state.
     * Returns (tiles, partyTileId); partyTileId may be null.
     */
    public static MapLoadResult loadFirstMapWithParty() throws Exception {
        LoadInitialMapInput.LoadedInitialMapInput loaded = CATALOG_OBJECT.loadInitialMap(new LoadInitialMapInput());
        return new MapLoadResult(loaded.tiles(), loaded.partyTileId());
    }

    public static List<HexTile> loadFirstMap() throws Exception {
        return CATALOG_OBJECT.loadFirstMap(new LoadFirstMapInput()).tiles();
    }

    /** Persists party position immediately. */
    public static void updatePartyTile(long tileId) throws Exception {
        CATALOG_OBJECT.updatePartyTile(new UpdatePartyTileInput(tileId));
    }

    /** Returns the number of tiles in a filled hex grid of the given radius. */
    public static int hexTileCount(int radius) {
        return 3 * radius * (radius + 1) + 1;
    }

    // ---- Connection-owning convenience methods (for background tasks in UI views) ----

    /** Loads all maps; owns the connection lifecycle. */
    public static List<HexMap> getAllMaps() throws Exception {
        return CATALOG_OBJECT.loadMapList(new LoadMapListInput()).maps();
    }

    /** Creates a hex map; owns the connection lifecycle. */
    public static long createHexMap(String name, int radius) throws Exception {
        return CATALOG_OBJECT.createMap(new CreateMapInput(name, radius)).mapId();
    }

    /** Updates map name and radius; owns the connection lifecycle. */
    public static void updateMap(long mapId, String newName, int oldRadius, int newRadius) throws Exception {
        CATALOG_OBJECT.updateMap(new UpdateMapInput(mapId, newName, oldRadius, newRadius));
    }

    /** Applies a batch of tileId->terrainType changes in a single transaction; owns the connection lifecycle. */
    public static void batchUpdateTerrain(Map<Long, HexTerrainType> tiles) throws Exception {
        CATALOG_OBJECT.flushTerrainChanges(new FlushTerrainChangesInput(tiles));
    }
}
