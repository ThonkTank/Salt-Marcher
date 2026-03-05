package services;

import entities.HexMap;
import entities.HexTile;
import repositories.HexTileRepository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

/**
 * Thin service facade for map-related data access.
 * UI components access hex map data through this class, not directly via repositories.
 */
public class HexMapService {

    public static Optional<Long> getFirstMapId(Connection conn) {
        return HexTileRepository.getFirstMapId(conn);
    }

    public static List<HexTile> getTiles(Connection conn, long mapId) {
        return HexTileRepository.getTilesInMap(conn, mapId);
    }

    public static List<HexMap> getAllMaps(Connection conn) {
        return HexTileRepository.getAllMaps(conn);
    }

    public static void updateTerrainType(Connection conn, long tileId, String terrainType) {
        HexTileRepository.updateTerrainType(conn, tileId, terrainType);
    }

    /**
     * Creates a new hex map with a filled hexagonal grid of the given radius.
     * Radius 0 = single tile at (0,0). Radius N = all tiles with hex distance <= N from origin.
     * All tiles start as grassland.
     *
     * @return the new map's ID
     */
    public static long createHexMap(Connection conn, String name, int radius) throws SQLException {
        if (radius < 0 || radius > 50)
            throw new IllegalArgumentException("createHexMap: radius must be 0–50, got " + radius);

        HexMap map = new HexMap();
        map.Name = name;
        map.IsBounded = true;
        map.Radius = radius;
        long mapId = HexTileRepository.insertMap(conn, map);

        conn.setAutoCommit(false);
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO hex_tiles(map_id, q, r, terrain_type, elevation, is_explored)"
                + " VALUES(?,?,?,'grassland',0,0)")) {
            for (int q = -radius; q <= radius; q++) {
                int rMin = Math.max(-radius, -q - radius);
                int rMax = Math.min(radius, -q + radius);
                for (int r = rMin; r <= rMax; r++) {
                    ps.setLong(1, mapId);
                    ps.setInt(2, q);
                    ps.setInt(3, r);
                    ps.addBatch();
                }
            }
            ps.executeBatch();
            conn.commit();
        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(true);
        }
        return mapId;
    }
}
