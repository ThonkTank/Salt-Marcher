package features.world.dungeon.dungeonmap.corridor;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

/**
 * Public root owner object for corridor-owned dungeon structures.
 */
public final class CorridorObject {

    private final features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository corridorRepository;

    public CorridorObject(features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository corridorRepository) {
        this.corridorRepository = java.util.Objects.requireNonNull(corridorRepository, "corridorRepository");
    }

    /**
     * Persist map-owned rebound results through the corridor owner seam instead of writing corridor rows directly from
     * foreign owners.
     */
    public void persistReboundCorridors(
            Connection conn,
            long mapId,
            List<features.world.dungeon.dungeonmap.corridor.model.Corridor> corridors
    ) throws SQLException {
        if (conn == null || mapId <= 0) {
            return;
        }
        for (features.world.dungeon.dungeonmap.corridor.model.Corridor corridor : corridors == null
                ? List.<features.world.dungeon.dungeonmap.corridor.model.Corridor>of()
                : corridors) {
            if (corridor != null) {
                corridorRepository.save(conn, corridor, mapId);
            }
        }
    }
}
