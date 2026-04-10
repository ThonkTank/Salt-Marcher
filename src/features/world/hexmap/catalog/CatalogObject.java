package features.world.hexmap.catalog;

import database.DatabaseManager;
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
import features.world.hexmap.repository.HexTileRepository;
import features.world.hexmap.service.adapter.HexMapCampaignStateAdapter;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Canonical hexmap seam for map catalog reads and persistence writes shared by
 * overworld and editor workflows.
 */
@SuppressWarnings("unused")
public final class CatalogObject {

    public LoadMapListInput.LoadedMapListInput loadMapList(LoadMapListInput input) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new LoadMapListInput.LoadedMapListInput(HexTileRepository.getAllMaps(conn));
        }
    }

    public LoadMapInput.LoadedMapInput loadMap(LoadMapInput input) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new LoadMapInput.LoadedMapInput(loadTiles(conn, input.mapId()));
        }
    }

    public LoadInitialMapInput.LoadedInitialMapInput loadInitialMap(LoadInitialMapInput input) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            Optional<Long> mapId = firstMapId(conn);
            if (mapId.isEmpty()) {
                return new LoadInitialMapInput.LoadedInitialMapInput(List.of(), null);
            }
            Long partyTileId = HexMapCampaignStateAdapter.getPartyTileId(conn).orElse(null);
            return new LoadInitialMapInput.LoadedInitialMapInput(loadTiles(conn, mapId.get()), partyTileId);
        }
    }

    public LoadFirstMapInput.LoadedFirstMapInput loadFirstMap(LoadFirstMapInput input) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            Optional<Long> mapId = firstMapId(conn);
            return new LoadFirstMapInput.LoadedFirstMapInput(
                    mapId.isEmpty() ? List.of() : loadTiles(conn, mapId.get()));
        }
    }

    public CreateMapInput.CreatedMapInput createMap(CreateMapInput input) throws SQLException {
        validateRadius(input.radius(), "createMap");
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                HexMap map = new HexMap(null, input.name(), true, input.radius());
                long mapId = HexTileRepository.insertMap(conn, map);
                HexTileRepository.insertTilesForRadius(conn, mapId, input.radius());
                conn.commit();
                return new CreateMapInput.CreatedMapInput(mapId);
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public void updateMap(UpdateMapInput input) throws SQLException {
        validateRadius(input.newRadius(), "updateMap");
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                HexTileRepository.updateMap(conn, input.mapId(), input.name(), input.newRadius());
                if (input.newRadius() > input.oldRadius()) {
                    HexTileRepository.insertTilesForRadius(conn, input.mapId(), input.newRadius());
                } else if (input.newRadius() < input.oldRadius()) {
                    HexMapCampaignStateAdapter.clearPartyTileOutsideRadius(conn, input.mapId(), input.newRadius());
                    HexTileRepository.deleteTilesOutsideRadius(conn, input.mapId(), input.newRadius());
                }
                conn.commit();
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public void flushTerrainChanges(FlushTerrainChangesInput input) throws SQLException {
        Map<Long, HexTerrainType> terrainChanges = input.terrainChanges();
        if (terrainChanges == null || terrainChanges.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                for (Map.Entry<Long, HexTerrainType> entry : terrainChanges.entrySet()) {
                    HexTileRepository.updateTerrainType(conn, entry.getKey(), entry.getValue());
                }
                conn.commit();
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public void updatePartyTile(UpdatePartyTileInput input) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            HexMapCampaignStateAdapter.updatePartyTile(conn, input.tileId());
        }
    }

    private static Optional<Long> firstMapId(Connection conn) throws SQLException {
        return HexTileRepository.getFirstMapId(conn);
    }

    private static List<HexTile> loadTiles(Connection conn, long mapId) throws SQLException {
        return HexTileRepository.getTilesInMap(conn, mapId);
    }

    private static void validateRadius(int radius, String operation) {
        if (radius < 0 || radius > 50) {
            throw new IllegalArgumentException(operation + ": radius must be 0-50, got " + radius);
        }
    }
}
