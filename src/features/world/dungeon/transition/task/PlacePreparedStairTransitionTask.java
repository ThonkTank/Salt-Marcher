package features.world.dungeon.transition.task;

public final class PlacePreparedStairTransitionTask {

    private PlacePreparedStairTransitionTask() {
    }

    public static features.world.dungeon.transition.input.PlacePreparedStairTransitionInput placePreparedStairTransition(
            features.world.dungeon.transition.input.PlacePreparedStairTransitionInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.transitionId() <= 0) {
            throw new java.sql.SQLException("Kein vorbereiteter Übergang gewählt");
        }
        if (input.draft() == null) {
            throw new java.sql.SQLException("Treppen-Platzierung fehlt");
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
                features.world.dungeon.application.stair.DungeonStairApplicationService.StairDraft stairDraft =
                        toStairDraft(input.draft());
                features.world.dungeon.dungeonmap.connections.input.DungeonConnection updatedLocalConnection;
                try {
                    updatedLocalConnection = features.world.dungeon.application.transition.TransitionConnectionBuilder.buildStairConnection(
                            layout,
                            mapId,
                            input.transitionId(),
                            stairDraft,
                            false,
                            input.transitionId());
                } catch (IllegalArgumentException ex) {
                    throw new java.sql.SQLException(ex.getMessage(), ex);
                }
                transitionRepository.updateLocalConnection(
                        conn,
                        input.transitionId(),
                        updatedLocalConnection,
                        toPlacementSpec(stairDraft));
                return null;
            });
        }
        return input;
    }

    private static features.world.dungeon.application.stair.DungeonStairApplicationService.StairDraft toStairDraft(
            features.world.dungeon.transition.input.PlacePreparedStairTransitionInput.DraftInput input
    ) {
        return new features.world.dungeon.application.stair.DungeonStairApplicationService.StairDraft(
                input.name(),
                features.world.dungeon.geometry.GridPoint.cell(
                        input.anchorCellX(),
                        input.anchorCellY(),
                        input.anchorCellZ()),
                input.anchorLevelZ(),
                toShapeSpec(input.shapeSpec()),
                input.minLevelZ(),
                input.maxLevelZ(),
                toStopLevels(input.stopLevels()));
    }

    private static features.world.dungeon.stair.model.StairPathPatternSpec toShapeSpec(
            features.world.dungeon.transition.input.PlacePreparedStairTransitionInput.ShapeSpecInput input
    ) {
        features.world.dungeon.transition.input.PlacePreparedStairTransitionInput.ShapeSpecInput resolved = input == null
                ? features.world.dungeon.transition.input.PlacePreparedStairTransitionInput.ShapeSpecInput.defaultInput()
                : input;
        return new features.world.dungeon.stair.model.StairPathPatternSpec(
                features.world.dungeon.stair.model.StairPathPatternKind.valueOf(
                        resolved.kind().isBlank() ? "STACK" : resolved.kind()),
                features.world.dungeon.geometry.CardinalDirection.parse(resolved.direction()),
                resolved.parameter1(),
                resolved.parameter2());
    }

    private static java.util.Set<Integer> toStopLevels(java.util.List<Integer> levels) {
        return levels == null ? java.util.Set.of() : java.util.Set.copyOf(new java.util.LinkedHashSet<>(levels));
    }

    private static features.world.dungeon.stair.model.StairPlacementSpec toPlacementSpec(
            features.world.dungeon.application.stair.DungeonStairApplicationService.StairDraft draft
    ) {
        return new features.world.dungeon.stair.model.StairPlacementSpec(
                draft.anchorCell(),
                draft.anchorLevelZ(),
                draft.shapeSpec(),
                draft.minLevelZ(),
                draft.maxLevelZ(),
                draft.stopLevels());
    }
}
