package features.world.dungeonmap.application.transition;

import database.DatabaseManager;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public final class DungeonTransitionTargetCatalogService {

    public List<DungeonTransitionTargetSummary> loadPlacedTargets(long mapId) throws SQLException {
        if (mapId <= 0) {
            return List.of();
        }
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT transition_id, description, cell_x, cell_y, level_z"
                             + " FROM dungeon_transitions"
                             + " WHERE dungeon_map_id=? AND cell_x IS NOT NULL AND cell_y IS NOT NULL AND level_z IS NOT NULL"
                             + " ORDER BY transition_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<DungeonTransitionTargetSummary> result = new ArrayList<>();
                while (rs.next()) {
                    long transitionId = rs.getLong("transition_id");
                    String description = rs.getString("description");
                    String label = "Übergang " + transitionId
                            + (description == null || description.isBlank() ? "" : " · " + description)
                            + " · "
                            + rs.getInt("cell_x") + ", " + rs.getInt("cell_y") + ", z=" + rs.getInt("level_z");
                    result.add(new DungeonTransitionTargetSummary(transitionId, mapId, label));
                }
                return List.copyOf(result);
            }
        }
    }
}
