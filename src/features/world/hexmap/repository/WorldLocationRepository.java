package features.world.hexmap.repository;

import features.world.hexmap.model.WorldLocation;
import features.world.hexmap.model.WorldLocationType;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class WorldLocationRepository {

    private WorldLocationRepository() {
        throw new AssertionError("No instances");
    }

    public static long insert(Connection conn, WorldLocation loc) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO world_locations(tile_id, name, location_type, description, is_discovered)"
                        + " VALUES(?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, loc.tileId());
            ps.setString(2, loc.name());
            ps.setString(3, loc.locationType().dbValue());
            ps.setString(4, loc.description());
            ps.setInt(5, loc.discovered() ? 1 : 0);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("No generated key returned for world_locations insert");
                }
                return keys.getLong(1);
            }
        }
    }

    /**
     * Returns the first location for the given tile (LIMIT 1).
     * The schema permits multiple locations per tile; this is a convenience method for
     * quick-display contexts. Use a future getLocationsForTile() when completeness is required.
     */
    public static Optional<WorldLocation> findByTile(Connection conn, long tileId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT * FROM world_locations WHERE tile_id=? LIMIT 1")) {
            ps.setLong(1, tileId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapRow(rs));
                }
            }
        }
        return Optional.empty();
    }

    public static List<WorldLocation> getDiscovered(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT wl.* FROM world_locations wl"
                        + " JOIN hex_tiles ht ON wl.tile_id = ht.tile_id"
                        + " WHERE ht.map_id=? AND wl.is_discovered=1")) {
            ps.setLong(1, mapId);
            List<WorldLocation> result = new ArrayList<>();
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(mapRow(rs));
                }
            }
            return result;
        }
    }

    public static void markDiscovered(Connection conn, long locationId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE world_locations SET is_discovered=1 WHERE location_id=?")) {
            ps.setLong(1, locationId);
            ps.executeUpdate();
        }
    }

    private static WorldLocation mapRow(ResultSet rs) throws SQLException {
        String rawType = rs.getString("location_type");
        WorldLocationType locationType = WorldLocationType.fromKey(rawType)
                .orElseThrow(() -> new SQLException("Unknown location_type: " + rawType));
        return new WorldLocation(
                rs.getLong("location_id"),
                rs.getLong("tile_id"),
                rs.getString("name"),
                locationType,
                rs.getString("description"),
                rs.getInt("is_discovered") == 1);
    }
}
