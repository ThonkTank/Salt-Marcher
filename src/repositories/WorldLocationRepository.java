package repositories;

import entities.WorldLocation;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

public class WorldLocationRepository {

    public static long insert(Connection conn, WorldLocation loc) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO world_locations(tile_id, name, location_type, description, is_discovered)"
                            + " VALUES(?,?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, loc.TileId);
                ps.setString(2, loc.Name);
                ps.setString(3, loc.LocationType);
                ps.setString(4, loc.Description);
                ps.setInt(5, loc.IsDiscovered ? 1 : 0);
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    return keys.getLong(1);
                }
            }
        } catch (SQLException e) {
            System.err.println("WorldLocationRepository.insert(): " + e.getMessage());
            return 0L;
        }
    }

    /**
     * Returns the first location for the given tile (LIMIT 1).
     * The schema permits multiple locations per tile; this is a convenience method for
     * quick-display contexts. Use a future getLocationsForTile() when completeness is required.
     */
    public static Optional<WorldLocation> findByTile(Connection conn, long tileId) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT * FROM world_locations WHERE tile_id=? LIMIT 1")) {
                ps.setLong(1, tileId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) return Optional.of(mapRow(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            System.err.println("WorldLocationRepository.findByTile(): " + e.getMessage());
            return Optional.empty();
        }
    }

    public static List<WorldLocation> getDiscovered(Connection conn, long mapId) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT wl.* FROM world_locations wl"
                            + " JOIN hex_tiles ht ON wl.tile_id = ht.tile_id"
                            + " WHERE ht.map_id=? AND wl.is_discovered=1")) {
                ps.setLong(1, mapId);
                List<WorldLocation> result = new ArrayList<>();
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) result.add(mapRow(rs));
                }
                return result;
            }
        } catch (SQLException e) {
            System.err.println("WorldLocationRepository.getDiscovered(): " + e.getMessage());
            return Collections.emptyList();
        }
    }

    public static void markDiscovered(Connection conn, long locationId) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE world_locations SET is_discovered=1 WHERE location_id=?")) {
                ps.setLong(1, locationId);
                ps.executeUpdate();
            }
        } catch (SQLException e) {
            System.err.println("WorldLocationRepository.markDiscovered(): " + e.getMessage());
        }
    }

    private static WorldLocation mapRow(ResultSet rs) throws SQLException {
        WorldLocation loc = new WorldLocation();
        loc.LocationId = rs.getLong("location_id");
        loc.TileId = rs.getLong("tile_id");
        loc.Name = rs.getString("name");
        loc.LocationType = rs.getString("location_type");
        loc.Description = rs.getString("description");
        loc.IsDiscovered = rs.getInt("is_discovered") == 1;
        return loc;
    }
}
