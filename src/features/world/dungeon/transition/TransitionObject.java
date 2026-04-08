package features.world.dungeon.transition;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;

/**
 * Public root owner object for persisted dungeon-transition placement updates.
 */
public final class TransitionObject {

    private final features.world.dungeon.repository.DungeonTransitionRepository transitionRepository;

    public TransitionObject(features.world.dungeon.repository.DungeonTransitionRepository transitionRepository) {
        this.transitionRepository = java.util.Objects.requireNonNull(transitionRepository, "transitionRepository");
    }

    /**
     * Persist map-owned rebound results through the transition owner seam while preserving any existing stair
     * placement spec attached to the original transition.
     */
    public void persistReboundConnections(
            Connection conn,
            features.world.dungeon.dungeonmap.model.DungeonMap originalMap,
            Map<Long, features.world.dungeon.dungeonmap.connections.input.DungeonConnection> localConnectionsByTransitionId
    ) throws SQLException {
        if (conn == null || originalMap == null || localConnectionsByTransitionId == null || localConnectionsByTransitionId.isEmpty()) {
            return;
        }
        for (Map.Entry<Long, features.world.dungeon.dungeonmap.connections.input.DungeonConnection> entry
                : localConnectionsByTransitionId.entrySet()) {
            if (entry.getKey() == null) {
                continue;
            }
            features.world.dungeon.model.structures.transition.DungeonTransition transition = originalMap.findTransition(entry.getKey());
            transitionRepository.updateLocalConnection(
                    conn,
                    entry.getKey(),
                    entry.getValue(),
                    transition == null ? null : transition.stairPlacementSpec());
        }
    }
}
