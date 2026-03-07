package features.world.hexmap.repository;

import features.world.hexmap.model.HexBiome;
import features.world.hexmap.model.HexGeometry;
import features.world.hexmap.model.HexMap;
import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.model.HexTile;
import features.world.hexmap.model.AxialCoord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class HexTileRepository {

    private HexTileRepository() {
        throw new AssertionError("No instances");
    }

    public static long insertMap(Connection conn, HexMap map) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO hex_maps(name, is_bounded, radius) VALUES(?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, map.name());
            ps.setInt(2, map.bounded() ? 1 : 0);
            if (map.radius() != null) {
                ps.setInt(3, map.radius());
            } else {
                ps.setNull(3, java.sql.Types.INTEGER);
            }
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                return keys.getLong(1);
            }
        }
    }

    public static long insertTile(Connection conn, HexTile tile) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO hex_tiles(map_id, q, r, terrain_type, elevation, biome, is_explored, dominant_faction_id, notes)"
                        + " VALUES(?,?,?,?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, tile.mapId());
            ps.setInt(2, tile.q());
            ps.setInt(3, tile.r());
            ps.setString(4, tile.terrainType() != null ? tile.terrainType().dbValue() : HexTerrainType.GRASSLAND.dbValue());
            ps.setInt(5, tile.elevation());
            ps.setString(6, tile.biome() != null ? tile.biome().dbValue() : null);
            ps.setInt(7, tile.explored() ? 1 : 0);
            if (tile.dominantFactionId() != null) {
                ps.setLong(8, tile.dominantFactionId());
            } else {
                ps.setNull(8, java.sql.Types.INTEGER);
            }
            ps.setString(9, tile.notes());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                return keys.getLong(1);
            }
        }
    }

    public static Optional<HexTile> findTile(Connection conn, long mapId, int q, int r) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT * FROM hex_tiles WHERE map_id=? AND q=? AND r=?")) {
            ps.setLong(1, mapId);
            ps.setInt(2, q);
            ps.setInt(3, r);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapRow(rs));
                }
            }
        }
        return Optional.empty();
    }

    public static List<HexTile> getTilesInMap(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT * FROM hex_tiles WHERE map_id=?")) {
            ps.setLong(1, mapId);
            return collectTiles(ps);
        }
    }

    public static List<HexTile> getExploredTiles(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT * FROM hex_tiles WHERE map_id=? AND is_explored=1")) {
            ps.setLong(1, mapId);
            return collectTiles(ps);
        }
    }

    public static void markExplored(Connection conn, long tileId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE hex_tiles SET is_explored=1 WHERE tile_id=?")) {
            ps.setLong(1, tileId);
            ps.executeUpdate();
        }
    }

    public static void setDominantFaction(Connection conn, long tileId, Long factionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE hex_tiles SET dominant_faction_id=? WHERE tile_id=?")) {
            if (factionId != null) {
                ps.setLong(1, factionId);
            } else {
                ps.setNull(1, java.sql.Types.INTEGER);
            }
            ps.setLong(2, tileId);
            ps.executeUpdate();
        }
    }

    public static void updateTerrainType(Connection conn, long tileId, HexTerrainType terrainType) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE hex_tiles SET terrain_type=? WHERE tile_id=?")) {
            ps.setString(1, terrainType.dbValue());
            ps.setLong(2, tileId);
            ps.executeUpdate();
        }
    }

    public static Optional<Long> getFirstMapId(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT map_id FROM hex_maps ORDER BY map_id LIMIT 1")) {
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(rs.getLong(1));
                }
            }
        }
        return Optional.empty();
    }

    public static List<HexTile> findNeighbors(Connection conn, long mapId, int q, int r) throws SQLException {
        List<AxialCoord> coords = HexGeometry.neighborCoords(q, r);
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT * FROM hex_tiles WHERE map_id=?"
                        + " AND ((q=? AND r=?) OR (q=? AND r=?) OR (q=? AND r=?)"
                        + "      OR (q=? AND r=?) OR (q=? AND r=?) OR (q=? AND r=?))")) {
            ps.setLong(1, mapId);
            for (int i = 0; i < 6; i++) {
                AxialCoord coord = coords.get(i);
                ps.setInt(2 + i * 2, coord.q());
                ps.setInt(3 + i * 2, coord.r());
            }
            List<HexTile> result = new ArrayList<>();
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(mapRow(rs));
                }
            }
            return result;
        }
    }

    public static List<HexMap> getAllMaps(Connection conn) throws SQLException {
        List<HexMap> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT map_id, name, is_bounded, radius FROM hex_maps ORDER BY map_id")) {
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Integer radius = null;
                    int rawRadius = rs.getInt("radius");
                    if (!rs.wasNull()) {
                        radius = rawRadius;
                    }
                    result.add(new HexMap(
                            rs.getLong("map_id"),
                            rs.getString("name"),
                            rs.getInt("is_bounded") == 1,
                            radius));
                }
            }
        }
        return result;
    }

    public static void updateMap(Connection conn, long mapId, String name, int radius) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE hex_maps SET name=?, radius=? WHERE map_id=?")) {
            ps.setString(1, name);
            ps.setInt(2, radius);
            ps.setLong(3, mapId);
            ps.executeUpdate();
        }
    }

    public static void insertTilesForRadius(Connection conn, long mapId, int newRadius) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT OR IGNORE INTO hex_tiles(map_id, q, r, terrain_type, elevation, is_explored)"
                        + " VALUES(?,?,?,'grassland',0,0)")) {
            for (int q = -newRadius; q <= newRadius; q++) {
                int rMin = Math.max(-newRadius, -q - newRadius);
                int rMax = Math.min(newRadius, -q + newRadius);
                for (int r = rMin; r <= rMax; r++) {
                    ps.setLong(1, mapId);
                    ps.setInt(2, q);
                    ps.setInt(3, r);
                    ps.addBatch();
                }
            }
            ps.executeBatch();
        }
    }

    public static int deleteTilesOutsideRadius(Connection conn, long mapId, int newRadius) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM hex_tiles WHERE map_id=?"
                        + " AND (abs(q) + abs(r) + abs(q + r)) / 2 > ?")) {
            ps.setLong(1, mapId);
            ps.setInt(2, newRadius);
            return ps.executeUpdate();
        }
    }

    public static void clearPartyTileOutsideRadius(Connection conn, long mapId, int newRadius) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE campaign_state SET party_tile_id = NULL"
                        + " WHERE party_tile_id IN ("
                        + "   SELECT tile_id FROM hex_tiles WHERE map_id=?"
                        + "   AND (abs(q) + abs(r) + abs(q + r)) / 2 > ?"
                        + " )")) {
            ps.setLong(1, mapId);
            ps.setInt(2, newRadius);
            ps.executeUpdate();
        }
    }

    private static List<HexTile> collectTiles(PreparedStatement ps) throws SQLException {
        List<HexTile> result = new ArrayList<>();
        try (ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                result.add(mapRow(rs));
            }
        }
        return result;
    }

    private static HexTile mapRow(ResultSet rs) throws SQLException {
        long dominantFactionId = rs.getLong("dominant_faction_id");
        Long dominantFaction = rs.wasNull() ? null : dominantFactionId;

        String terrainRaw = rs.getString("terrain_type");
        HexTerrainType terrainType = HexTerrainType.fromKey(terrainRaw)
                .orElseThrow(() -> new SQLException("Unknown terrain_type: " + terrainRaw));

        String biomeRaw = rs.getString("biome");
        HexBiome biome = null;
        if (biomeRaw != null) {
            biome = HexBiome.fromKey(biomeRaw)
                    .orElseThrow(() -> new SQLException("Unknown biome: " + biomeRaw));
        }

        return new HexTile(
                rs.getLong("tile_id"),
                rs.getLong("map_id"),
                rs.getInt("q"),
                rs.getInt("r"),
                terrainType,
                rs.getInt("elevation"),
                biome,
                rs.getInt("is_explored") == 1,
                dominantFaction,
                rs.getString("notes"));
    }
}
