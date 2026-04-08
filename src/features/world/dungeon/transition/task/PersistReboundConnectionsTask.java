package features.world.dungeon.transition.task;

public final class PersistReboundConnectionsTask {

    private PersistReboundConnectionsTask() {
    }

    /**
     * Keep any existing stair placement spec from the original transition while applying the new local connection.
     */
    public static features.world.dungeon.transition.input.PersistReboundConnectionsInput persistReboundConnections(
            features.world.dungeon.transition.input.PersistReboundConnectionsInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.isEmpty()) {
            return input;
        }
        features.world.dungeon.repository.DungeonTransitionRepository transitionRepository =
                new features.world.dungeon.repository.DungeonTransitionRepository();
        java.sql.Connection conn = input.connection();
        features.world.dungeon.dungeonmap.model.DungeonMap originalMap = input.originalMap();
        java.util.Map<Long, features.world.dungeon.dungeonmap.connections.input.DungeonConnection> localConnectionsByTransitionId =
                input.localConnectionsByTransitionId();
        for (java.util.Map.Entry<Long, features.world.dungeon.dungeonmap.connections.input.DungeonConnection> entry
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
        return input;
    }
}
