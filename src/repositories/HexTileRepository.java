package repositories;

import entities.HexMap;
import entities.HexTile;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

public class HexTileRepository {

    public static long insertMap(Connection conn, HexMap map) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO hex_maps(name, is_bounded, radius) VALUES(?,?,?)",
                    Statement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, map.Name);
                ps.setInt(2, map.IsBounded ? 1 : 0);
                if (map.Radius != null) ps.setInt(3, map.Radius);
                else ps.setNull(3, java.sql.Types.INTEGER);
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    return keys.getLong(1);
                }
            }
        } catch (SQLException e) {
            System.err.println("HexTileRepository.insertMap(): " + e.getMessage());
            return 0L;
        }
    }

    public static long insertTile(Connection conn, HexTile tile) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO hex_tiles(map_id, q, r, terrain_type, elevation, biome, is_explored, dominant_faction_id, notes)"
                            + " VALUES(?,?,?,?,?,?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, tile.MapId);
                ps.setInt(2, tile.Q);
                ps.setInt(3, tile.R);
                ps.setString(4, tile.TerrainType != null ? tile.TerrainType : "grassland");
                ps.setInt(5, tile.Elevation);
                ps.setString(6, tile.Biome);
                ps.setInt(7, tile.IsExplored ? 1 : 0);
                if (tile.DominantFactionId != null) ps.setLong(8, tile.DominantFactionId);
                else ps.setNull(8, java.sql.Types.INTEGER);
                ps.setString(9, tile.Notes);
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    return keys.getLong(1);
                }
            }
        } catch (SQLException e) {
            System.err.println("HexTileRepository.insertTile(): " + e.getMessage());
            return 0L;
        }
    }

    public static Optional<HexTile> findTile(Connection conn, long mapId, int q, int r) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT * FROM hex_tiles WHERE map_id=? AND q=? AND r=?")) {
                ps.setLong(1, mapId);
                ps.setInt(2, q);
                ps.setInt(3, r);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) return Optional.of(mapRow(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            System.err.println("HexTileRepository.findTile(): " + e.getMessage());
            return Optional.empty();
        }
    }

    public static List<HexTile> getTilesInMap(Connection conn, long mapId) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT * FROM hex_tiles WHERE map_id=?")) {
                ps.setLong(1, mapId);
                return collectTiles(ps);
            }
        } catch (SQLException e) {
            System.err.println("HexTileRepository.getTilesInMap(): " + e.getMessage());
            return Collections.emptyList();
        }
    }

    public static List<HexTile> getExploredTiles(Connection conn, long mapId) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT * FROM hex_tiles WHERE map_id=? AND is_explored=1")) {
                ps.setLong(1, mapId);
                return collectTiles(ps);
            }
        } catch (SQLException e) {
            System.err.println("HexTileRepository.getExploredTiles(): " + e.getMessage());
            return Collections.emptyList();
        }
    }

    public static void markExplored(Connection conn, long tileId) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE hex_tiles SET is_explored=1 WHERE tile_id=?")) {
                ps.setLong(1, tileId);
                ps.executeUpdate();
            }
        } catch (SQLException e) {
            System.err.println("HexTileRepository.markExplored(): " + e.getMessage());
        }
    }

    public static void setDominantFaction(Connection conn, long tileId, Long factionId) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE hex_tiles SET dominant_faction_id=? WHERE tile_id=?")) {
                if (factionId != null) ps.setLong(1, factionId);
                else ps.setNull(1, java.sql.Types.INTEGER);
                ps.setLong(2, tileId);
                ps.executeUpdate();
            }
        } catch (SQLException e) {
            System.err.println("HexTileRepository.setDominantFaction(): " + e.getMessage());
        }
    }

    public static void updateTerrainType(Connection conn, long tileId, String terrainType) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE hex_tiles SET terrain_type=? WHERE tile_id=?")) {
                ps.setString(1, terrainType);
                ps.setLong(2, tileId);
                ps.executeUpdate();
            }
        } catch (SQLException e) {
            System.err.println("HexTileRepository.updateTerrainType(): " + e.getMessage());
        }
    }

    public static Optional<Long> getFirstMapId(Connection conn) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT map_id FROM hex_maps ORDER BY map_id LIMIT 1")) {
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) return Optional.of(rs.getLong(1));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            System.err.println("HexTileRepository.getFirstMapId(): " + e.getMessage());
            return Optional.empty();
        }
    }

    public static List<HexTile> findNeighbors(Connection conn, long mapId, int q, int r) {
        List<int[]> coords = HexTile.neighborCoords(q, r);
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT * FROM hex_tiles WHERE map_id=?"
                    + " AND ((q=? AND r=?) OR (q=? AND r=?) OR (q=? AND r=?)"
                    + "      OR (q=? AND r=?) OR (q=? AND r=?) OR (q=? AND r=?))")) {
                ps.setLong(1, mapId);
                for (int i = 0; i < 6; i++) {
                    ps.setInt(2 + i * 2, coords.get(i)[0]);
                    ps.setInt(3 + i * 2, coords.get(i)[1]);
                }
                List<HexTile> result = new ArrayList<>();
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) result.add(mapRow(rs));
                }
                return result;
            }
        } catch (SQLException e) {
            System.err.println("HexTileRepository.findNeighbors(): " + e.getMessage());
            return Collections.emptyList();
        }
    }

    public static List<HexMap> getAllMaps(Connection conn) {
        List<HexMap> result = new ArrayList<>();
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT map_id, name, is_bounded, radius FROM hex_maps ORDER BY map_id")) {
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        HexMap m = new HexMap();
                        m.MapId = rs.getLong("map_id");
                        m.Name = rs.getString("name");
                        m.IsBounded = rs.getInt("is_bounded") == 1;
                        int rad = rs.getInt("radius");
                        m.Radius = rs.wasNull() ? null : rad;
                        result.add(m);
                    }
                }
            }
        } catch (SQLException e) {
            System.err.println("HexTileRepository.getAllMaps(): " + e.getMessage());
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

    // -------------------------------------------------------------------------

    private static List<HexTile> collectTiles(PreparedStatement ps) throws SQLException {
        List<HexTile> result = new ArrayList<>();
        try (ResultSet rs = ps.executeQuery()) {
            while (rs.next()) result.add(mapRow(rs));
        }
        return result;
    }

    private static HexTile mapRow(ResultSet rs) throws SQLException {
        HexTile t = new HexTile();
        t.TileId = rs.getLong("tile_id");
        t.MapId = rs.getLong("map_id");
        t.Q = rs.getInt("q");
        t.R = rs.getInt("r");
        t.TerrainType = rs.getString("terrain_type");
        t.Elevation = rs.getInt("elevation");
        t.Biome = rs.getString("biome");
        t.IsExplored = rs.getInt("is_explored") == 1;
        long fid = rs.getLong("dominant_faction_id");
        t.DominantFactionId = rs.wasNull() ? null : fid;
        t.Notes = rs.getString("notes");
        return t;
    }
}
