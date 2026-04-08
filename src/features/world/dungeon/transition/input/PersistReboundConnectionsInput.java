package features.world.dungeon.transition.input;

public record PersistReboundConnectionsInput(
        java.sql.Connection connection,
        features.world.dungeon.dungeonmap.model.DungeonMap originalMap,
        java.util.Map<Long, features.world.dungeon.dungeonmap.connections.input.DungeonConnection> localConnectionsByTransitionId
) {
}
