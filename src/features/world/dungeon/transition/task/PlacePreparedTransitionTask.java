package features.world.dungeon.transition.task;

public final class PlacePreparedTransitionTask {

    private PlacePreparedTransitionTask() {
    }

    public static features.world.dungeon.transition.input.PlacePreparedTransitionInput placePreparedTransition(
            features.world.dungeon.transition.input.PlacePreparedTransitionInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.transitionId() <= 0) {
            throw new java.sql.SQLException("Kein vorbereiteter Übergang gewählt");
        }
        if (input.doorId() <= 0) {
            throw new java.sql.SQLException("Übergangs-Platzierung fehlt");
        }
        try (java.sql.Connection conn = database.DatabaseManager.getConnection()) {
            features.world.dungeon.application.support.DungeonTransactionRunner.inTransaction(conn, () -> {
                features.world.dungeon.repository.DungeonTransitionRepository transitionRepository =
                        new features.world.dungeon.repository.DungeonTransitionRepository();
                Long mapId = transitionRepository.findMapId(conn, input.transitionId());
                if (mapId == null) {
                    throw new java.sql.SQLException("Übergang existiert nicht");
                }
                features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository =
                        new features.world.dungeon.dungeonmap.repository.DungeonMapRepository();
                features.world.dungeon.dungeonmap.model.DungeonMap layout = mapRepository.loadMap(conn, mapId);
                if (layout == null) {
                    throw new java.sql.SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
                }
                features.world.dungeon.dungeonmap.connections.input.DungeonConnection updatedLocalConnection;
                try {
                    updatedLocalConnection = features.world.dungeon.application.transition.TransitionConnectionBuilder.buildDoorConnection(
                            layout,
                            mapId,
                            input.transitionId(),
                            new features.world.dungeon.model.interaction.DungeonSelectionRef.DoorRef(input.doorId()),
                            input.levelZ());
                } catch (IllegalArgumentException ex) {
                    throw new java.sql.SQLException(ex.getMessage(), ex);
                }
                transitionRepository.updateLocalConnection(conn, input.transitionId(), updatedLocalConnection, null);
                return null;
            });
        }
        return input;
    }
}
