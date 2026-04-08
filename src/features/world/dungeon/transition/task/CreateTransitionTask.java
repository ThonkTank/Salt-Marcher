package features.world.dungeon.transition.task;

public final class CreateTransitionTask {

    private CreateTransitionTask() {
    }

    public static features.world.dungeon.transition.input.CreateTransitionInput createTransition(
            features.world.dungeon.transition.input.CreateTransitionInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.mapId() <= 0) {
            throw new java.sql.SQLException("Kein aktiver Dungeon geladen");
        }
        if (input.doorId() <= 0) {
            throw new java.sql.SQLException("Übergangs-Platzierung fehlt");
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
                features.world.dungeon.dungeonmap.connections.input.DungeonConnection localConnection;
                try {
                    localConnection = features.world.dungeon.application.transition.TransitionConnectionBuilder.buildDoorConnection(
                            layout,
                            input.mapId(),
                            reservedTransitionId,
                            new features.world.dungeon.model.interaction.DungeonSelectionRef.DoorRef(input.doorId()),
                            input.levelZ());
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
                        null));
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
            Long resolvedMapId = features.world.api.read.ReadObject.findOverworldMapIdForTile(input.tileId());
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
