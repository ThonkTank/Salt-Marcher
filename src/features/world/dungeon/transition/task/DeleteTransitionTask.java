package features.world.dungeon.transition.task;

public final class DeleteTransitionTask {

    private DeleteTransitionTask() {
    }

    public static features.world.dungeon.transition.input.DeleteTransitionInput deleteTransition(
            features.world.dungeon.transition.input.DeleteTransitionInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        long transitionId = input.transitionId();
        if (transitionId <= 0) {
            return input;
        }
        try (java.sql.Connection conn = database.DatabaseManager.getConnection()) {
            features.world.dungeon.application.support.DungeonTransactionRunner.inTransaction(conn, () -> {
                features.world.dungeon.repository.DungeonTransitionRepository transitionRepository =
                        new features.world.dungeon.repository.DungeonTransitionRepository();
                Long mapId = transitionRepository.findMapId(conn, transitionId);
                if (mapId == null) {
                    throw new java.sql.SQLException("Übergang existiert nicht");
                }
                transitionRepository.clearLinksTo(conn, transitionId);
                transitionRepository.delete(conn, transitionId);
                return null;
            });
        }
        return input;
    }
}
