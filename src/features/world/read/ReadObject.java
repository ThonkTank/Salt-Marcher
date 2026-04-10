package features.world.read;

import database.DatabaseManager;
import features.world.read.input.FindOverworldMapIdForTileInput;
import features.world.read.input.LoadOverworldTransitionTargetsInput;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * Canonical world read bridge for world-wide transition-target and map lookup
 * reads consumed by shell-facing and feature-facing workflows.
 */
@SuppressWarnings("unused")
public final class ReadObject {

    public LoadOverworldTransitionTargetsInput.LoadedOverworldTransitionTargetsInput loadOverworldTransitionTargets(
            LoadOverworldTransitionTargetsInput input
    ) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT hm.map_id, hm.name AS map_name, ht.tile_id, ht.q, ht.r, wl.name AS location_name"
                             + " FROM hex_tiles ht"
                             + " JOIN hex_maps hm ON hm.map_id = ht.map_id"
                             + " LEFT JOIN world_locations wl ON wl.tile_id = ht.tile_id AND wl.is_discovered = 1"
                             + " WHERE ht.is_explored = 1 OR wl.location_id IS NOT NULL"
                             + " ORDER BY lower(hm.name),"
                             + " CASE WHEN wl.name IS NULL OR wl.name = '' THEN 1 ELSE 0 END,"
                             + " lower(coalesce(wl.name, '')),"
                             + " ht.q, ht.r, ht.tile_id");
             ResultSet rs = ps.executeQuery()) {
            List<LoadOverworldTransitionTargetsInput.OverworldTransitionTargetSummaryInput> result = new ArrayList<>();
            while (rs.next()) {
                String mapName = rs.getString("map_name");
                String locationName = rs.getString("location_name");
                int q = rs.getInt("q");
                int r = rs.getInt("r");
                String label = (locationName == null || locationName.isBlank())
                        ? mapName + " · " + q + ", " + r
                        : mapName + " · " + locationName + " · " + q + ", " + r;
                result.add(new LoadOverworldTransitionTargetsInput.OverworldTransitionTargetSummaryInput(
                        rs.getLong("map_id"),
                        rs.getLong("tile_id"),
                        label));
            }
            return new LoadOverworldTransitionTargetsInput.LoadedOverworldTransitionTargetsInput(List.copyOf(result));
        }
    }

    public FindOverworldMapIdForTileInput.FoundOverworldMapIdForTileInput findOverworldMapIdForTile(
            FindOverworldMapIdForTileInput input
    ) throws SQLException {
        if (input == null || input.tileId() <= 0) {
            return new FindOverworldMapIdForTileInput.FoundOverworldMapIdForTileInput(null);
        }
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT map_id FROM hex_tiles WHERE tile_id=?")) {
            ps.setLong(1, input.tileId());
            try (ResultSet rs = ps.executeQuery()) {
                return new FindOverworldMapIdForTileInput.FoundOverworldMapIdForTileInput(
                        rs.next() ? rs.getLong(1) : null);
            }
        }
    }
}
