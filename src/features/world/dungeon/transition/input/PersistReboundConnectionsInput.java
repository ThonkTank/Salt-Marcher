package features.world.dungeon.transition.input;

public record PersistReboundConnectionsInput(
        java.sql.Connection connection,
        features.world.dungeon.dungeonmap.model.DungeonMap originalMap,
        java.util.Map<Long, features.world.dungeon.dungeonmap.connections.input.DungeonConnection> localConnectionsByTransitionId
) {
    public PersistReboundConnectionsInput {
        localConnectionsByTransitionId = localConnectionsByTransitionId == null
                ? java.util.Map.of()
                : java.util.Map.copyOf(localConnectionsByTransitionId);
    }

    public static PersistReboundConnectionsInput reboundConnections(
            java.sql.Connection connection,
            features.world.dungeon.dungeonmap.model.DungeonMap originalMap,
            java.util.Map<Long, features.world.dungeon.dungeonmap.connections.input.DungeonConnection> localConnectionsByTransitionId
    ) {
        return new PersistReboundConnectionsInput(connection, originalMap, localConnectionsByTransitionId);
    }

    public boolean isEmpty() {
        return connection == null || originalMap == null || localConnectionsByTransitionId.isEmpty();
    }
}
