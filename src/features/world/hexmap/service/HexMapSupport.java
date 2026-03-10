package features.world.hexmap.service;

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

final class HexMapSupport {

    private HexMapSupport() {
        throw new AssertionError("No instances");
    }

    static Optional<Long> getFirstMapId(Connection conn) throws SQLException {
        return HexTileRepository.getFirstMapId(conn);
    }

    static List<HexTile> getTiles(Connection conn, long mapId) throws SQLException {
        return HexTileRepository.getTilesInMap(conn, mapId);
    }

    static List<HexMap> getAllMaps(Connection conn) throws SQLException {
        return HexTileRepository.getAllMaps(conn);
    }

    static MapLoadResult loadFirstMapWithParty(Connection conn) throws SQLException {
        Optional<Long> mapId = getFirstMapId(conn);
        if (mapId.isEmpty()) {
            return new MapLoadResult(List.of(), null);
        }
        Long partyTileId = HexMapCampaignStateAdapter.getPartyTileId(conn).orElse(null);
        List<HexTile> tiles = getTiles(conn, mapId.get());
        return new MapLoadResult(tiles, partyTileId);
    }

    static List<HexTile> loadFirstMap(Connection conn) throws SQLException {
        Optional<Long> mapId = getFirstMapId(conn);
        if (mapId.isEmpty()) {
            return List.of();
        }
        return getTiles(conn, mapId.get());
    }

    static void updateTerrainType(Connection conn, long tileId, HexTerrainType terrainType) throws SQLException {
        HexTileRepository.updateTerrainType(conn, tileId, terrainType);
    }

    static void updateMap(Connection conn, long mapId, String newName, int oldRadius, int newRadius) throws SQLException {
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

    static long createHexMap(Connection conn, String name, int radius) throws SQLException {
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

    static void batchUpdateTerrain(Connection conn, Map<Long, HexTerrainType> tiles) throws SQLException {
        boolean previousAutoCommit = conn.getAutoCommit();
        conn.setAutoCommit(false);
        try {
            for (var entry : tiles.entrySet()) {
                updateTerrainType(conn, entry.getKey(), entry.getValue());
            }
            conn.commit();
        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(previousAutoCommit);
        }
    }

    record MapLoadResult(List<HexTile> tiles, Long partyTileId) {}
}
