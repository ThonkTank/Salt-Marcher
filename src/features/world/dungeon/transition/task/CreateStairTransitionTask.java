package features.world.dungeon.transition.task;

@SuppressWarnings("unused")
public final class CreateStairTransitionTask {
    private static final features.world.read.ReadObject WORLD_READ_OBJECT = new features.world.read.ReadObject();

    private CreateStairTransitionTask() {
    }

    public static features.world.dungeon.transition.input.CreateStairTransitionInput createStairTransition(
            features.world.dungeon.transition.input.CreateStairTransitionInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.mapId() <= 0) {
            throw new java.sql.SQLException("Kein aktiver Dungeon geladen");
        }
        if (input.draft() == null) {
            throw new java.sql.SQLException("Treppen-Platzierung fehlt");
        }
        try (java.sql.Connection conn = database.DatabaseManager.getConnection()) {
            features.world.dungeon.application.support.DungeonTransactionRunner.inTransaction(conn, () -> {
                features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository =
                        new features.world.dungeon.dungeonmap.repository.DungeonMapRepository();
                features.world.dungeon.repository.DungeonTransitionRepository transitionRepository =
                        new features.world.dungeon.repository.DungeonTransitionRepository();
                features.world.dungeon.dungeonmap.model.DungeonMap layout = mapRepository.loadMap(conn, input.mapId());
                if (layout == null) {
                    throw new java.sql.SQLException("Dungeon " + input.mapId() + " konnte nicht geladen werden");
                }
                features.world.dungeon.model.structures.transition.DungeonTransitionDestination validatedDestination =
                        requireDestination(conn, transitionRepository, input.destination(), input.bidirectional());
                long reservedTransitionId = transitionRepository.nextTransitionId(conn);
                features.world.dungeon.application.stair.DungeonStairApplicationService.StairDraft stairDraft =
                        toStairDraft(input.draft());
                features.world.dungeon.dungeonmap.connections.input.DungeonConnection localConnection;
                try {
                    localConnection = features.world.dungeon.application.transition.TransitionConnectionBuilder.buildStairConnection(
                            layout,
                            input.mapId(),
                            reservedTransitionId,
                            stairDraft,
                            false,
                            null);
                } catch (IllegalArgumentException ex) {
                    throw new java.sql.SQLException(ex.getMessage(), ex);
                }
                long insertedTransitionId = transitionRepository.insert(conn, new features.world.dungeon.model.structures.transition.DungeonTransition(
                        reservedTransitionId,
                        input.mapId(),
                        input.description(),
                        localConnection,
                        validatedDestination,
                        null,
                        toPlacementSpec(stairDraft)));
                if (input.bidirectional()
                        && validatedDestination instanceof features.world.dungeon.model.structures.transition.DungeonTransitionDestination.DungeonMapDestination dungeonDestination) {
                    long counterpartId = transitionRepository.insert(conn, new features.world.dungeon.model.structures.transition.DungeonTransition(
                            null,
                            dungeonDestination.mapId(),
                            input.description(),
                            null,
                            new features.world.dungeon.model.structures.transition.DungeonTransitionDestination.DungeonMapDestination(
                                    input.mapId(),
                                    insertedTransitionId),
                            insertedTransitionId,
                            null));
                    transitionRepository.linkPair(conn, insertedTransitionId, counterpartId);
                }
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

    private static features.world.dungeon.model.structures.transition.DungeonTransitionDestination requireDestination(
            java.sql.Connection conn,
            features.world.dungeon.repository.DungeonTransitionRepository transitionRepository,
            features.world.dungeon.transition.input.CreateTransitionInput.DestinationInput input,
            boolean bidirectional
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new java.sql.SQLException("Übergangsziel fehlt");
        }
        if (input.isOverworldTile()) {
            if (input.tileId() <= 0) {
                throw new java.sql.SQLException("Overworld-Zielfeld fehlt");
            }
            Long resolvedMapId = WORLD_READ_OBJECT.findOverworldMapIdForTile(
                    new features.world.read.input.FindOverworldMapIdForTileInput(input.tileId())).mapId();
            if (resolvedMapId == null || resolvedMapId <= 0) {
                throw new java.sql.SQLException("Overworld-Zielfeld existiert nicht");
            }
            return new features.world.dungeon.model.structures.transition.DungeonTransitionDestination.OverworldTileDestination(
                    resolvedMapId,
                    input.tileId());
        }
        if (!input.isDungeonMap()) {
            throw new java.sql.SQLException("Übergangsziel fehlt");
        }
        if (input.mapId() <= 0 || !transitionRepository.dungeonMapExists(conn, input.mapId())) {
            throw new java.sql.SQLException("Dungeon-Zielkarte existiert nicht");
        }
        if (!bidirectional) {
            if (input.transitionId() == null) {
                throw new java.sql.SQLException("Ziel-Übergang wählen");
            }
            Long targetMapId = transitionRepository.findMapId(conn, input.transitionId());
            if (targetMapId == null) {
                throw new java.sql.SQLException("Übergang existiert nicht");
            }
            if (targetMapId != input.mapId()) {
                throw new java.sql.SQLException("Ziel-Übergang gehört nicht zur gewählten Karte");
            }
        }
        return new features.world.dungeon.model.structures.transition.DungeonTransitionDestination.DungeonMapDestination(
                input.mapId(),
                input.transitionId());
    }
}
