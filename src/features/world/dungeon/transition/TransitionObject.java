package features.world.dungeon.transition;

import features.world.dungeon.transition.input.LoadOverworldTargetsInput;
import features.world.dungeon.transition.input.PersistReboundConnectionsInput;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

/**
 * Public root owner object for persisted dungeon-transition placement updates.
 */
public final class TransitionObject {

    private final features.world.dungeon.repository.DungeonTransitionRepository transitionRepository;

    public TransitionObject(features.world.dungeon.repository.DungeonTransitionRepository transitionRepository) {
        this.transitionRepository = java.util.Objects.requireNonNull(transitionRepository, "transitionRepository");
    }

    public List<LoadOverworldTargetsInput.TargetInput> loadOverworldTargets(
            LoadOverworldTargetsInput input
    ) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return features.world.api.read.ReadObject.loadOverworldTransitionTargets().stream()
                .map(summary -> new LoadOverworldTargetsInput.TargetInput(
                        summary.mapId(),
                        summary.tileId(),
                        summary.label()))
                .toList();
    }

    /**
     * Persist map-owned rebound results through the transition owner seam while preserving any existing stair
     * placement spec attached to the original transition.
     */
    public void persistReboundConnections(PersistReboundConnectionsInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        Connection conn = input.connection();
        features.world.dungeon.dungeonmap.model.DungeonMap originalMap = input.originalMap();
        Map<Long, features.world.dungeon.dungeonmap.connections.input.DungeonConnection> localConnectionsByTransitionId =
                input.localConnectionsByTransitionId();
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
