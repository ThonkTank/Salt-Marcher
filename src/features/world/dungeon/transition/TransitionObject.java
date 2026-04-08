package features.world.dungeon.transition;

import database.DatabaseManager;
import features.world.dungeon.application.transition.TransitionConnectionBuilder;
import features.world.dungeon.application.support.DungeonTransactionRunner;
import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.stair.model.StairPathPatternKind;
import features.world.dungeon.stair.model.StairPathPatternSpec;
import features.world.dungeon.transition.input.DeleteTransitionInput;
import features.world.dungeon.transition.input.LoadDungeonTargetsInput;
import features.world.dungeon.transition.input.LoadOverworldTargetsInput;
import features.world.dungeon.transition.input.PlacePreparedTransitionInput;
import features.world.dungeon.transition.input.PlacePreparedStairTransitionInput;
import features.world.dungeon.transition.input.PersistReboundConnectionsInput;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Public root owner object for persisted dungeon-transition placement updates.
 */
public final class TransitionObject {

    private final features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository;
    private final features.world.dungeon.repository.DungeonTransitionRepository transitionRepository;

    public TransitionObject(
            features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository,
            features.world.dungeon.repository.DungeonTransitionRepository transitionRepository
    ) {
        this.mapRepository = java.util.Objects.requireNonNull(mapRepository, "mapRepository");
        this.transitionRepository = java.util.Objects.requireNonNull(transitionRepository, "transitionRepository");
    }

    public List<LoadDungeonTargetsInput.TargetInput> loadDungeonTargets(
            LoadDungeonTargetsInput input
    ) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        long mapId = input.mapId();
        if (mapId <= 0) {
            return List.of();
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return mapRepository.loadMap(conn, mapId).placedTransitions().stream()
                    .map(transition -> new LoadDungeonTargetsInput.TargetInput(
                            transition.transitionId(),
                            transition.mapId(),
                            transition.label(),
                            transition.description(),
                            transition.localConnection() != null && transition.localConnection().doorCarrier() != null
                                    ? "Tür"
                                    : transition.localConnection() != null && transition.localConnection().stairCarrier() != null
                                    ? "Treppe"
                                    : "",
                            transition.localConnection() != null && transition.localConnection().stairCarrier() != null
                                    ? transition.localConnection().stairCarrier().anchorLevelZ()
                                    : null))
                    .toList();
        }
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

    public void deleteTransition(DeleteTransitionInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        long transitionId = input.transitionId();
        if (transitionId <= 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                Long mapId = transitionRepository.findMapId(conn, transitionId);
                if (mapId == null) {
                    throw new SQLException("Übergang existiert nicht");
                }
                transitionRepository.clearLinksTo(conn, transitionId);
                transitionRepository.delete(conn, transitionId);
                return null;
            });
        }
    }

    public void placePreparedTransition(PlacePreparedTransitionInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.transitionId() <= 0) {
            throw new SQLException("Kein vorbereiteter Übergang gewählt");
        }
        if (input.doorId() <= 0) {
            throw new SQLException("Übergangs-Platzierung fehlt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                Long mapId = transitionRepository.findMapId(conn, input.transitionId());
                if (mapId == null) {
                    throw new SQLException("Übergang existiert nicht");
                }
                features.world.dungeon.dungeonmap.model.DungeonMap layout = mapRepository.loadMap(conn, mapId);
                if (layout == null) {
                    throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
                }
                features.world.dungeon.dungeonmap.connections.input.DungeonConnection updatedLocalConnection;
                try {
                    updatedLocalConnection = TransitionConnectionBuilder.buildDoorConnection(
                            layout,
                            mapId,
                            input.transitionId(),
                            new features.world.dungeon.model.interaction.DungeonSelectionRef.DoorRef(input.doorId()),
                            input.levelZ());
                } catch (IllegalArgumentException ex) {
                    throw new SQLException(ex.getMessage(), ex);
                }
                transitionRepository.updateLocalConnection(conn, input.transitionId(), updatedLocalConnection, null);
                return null;
            });
        }
    }

    public void placePreparedStairTransition(PlacePreparedStairTransitionInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.transitionId() <= 0) {
            throw new SQLException("Kein vorbereiteter Übergang gewählt");
        }
        if (input.draft() == null) {
            throw new SQLException("Treppen-Platzierung fehlt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                Long mapId = transitionRepository.findMapId(conn, input.transitionId());
                if (mapId == null) {
                    throw new SQLException("Übergang existiert nicht");
                }
                features.world.dungeon.dungeonmap.model.DungeonMap layout = mapRepository.loadMap(conn, mapId);
                if (layout == null) {
                    throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
                }
                features.world.dungeon.application.stair.DungeonStairApplicationService.StairDraft stairDraft =
                        toStairDraft(input.draft());
                features.world.dungeon.dungeonmap.connections.input.DungeonConnection updatedLocalConnection;
                try {
                    updatedLocalConnection = TransitionConnectionBuilder.buildStairConnection(
                            layout,
                            mapId,
                            input.transitionId(),
                            stairDraft,
                            false,
                            input.transitionId());
                } catch (IllegalArgumentException ex) {
                    throw new SQLException(ex.getMessage(), ex);
                }
                transitionRepository.updateLocalConnection(
                        conn,
                        input.transitionId(),
                        updatedLocalConnection,
                        toPlacementSpec(stairDraft));
                return null;
            });
        }
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

    private static features.world.dungeon.application.stair.DungeonStairApplicationService.StairDraft toStairDraft(
            PlacePreparedStairTransitionInput.DraftInput input
    ) {
        return new features.world.dungeon.application.stair.DungeonStairApplicationService.StairDraft(
                input.name(),
                GridPoint.cell(input.anchorCellX(), input.anchorCellY(), input.anchorCellZ()),
                input.anchorLevelZ(),
                toShapeSpec(input.shapeSpec()),
                input.minLevelZ(),
                input.maxLevelZ(),
                toStopLevels(input.stopLevels()));
    }

    private static StairPathPatternSpec toShapeSpec(PlacePreparedStairTransitionInput.ShapeSpecInput input) {
        PlacePreparedStairTransitionInput.ShapeSpecInput resolved = input == null
                ? PlacePreparedStairTransitionInput.ShapeSpecInput.defaultInput()
                : input;
        return new StairPathPatternSpec(
                StairPathPatternKind.valueOf(resolved.kind().isBlank() ? "STACK" : resolved.kind()),
                CardinalDirection.parse(resolved.direction()),
                resolved.parameter1(),
                resolved.parameter2());
    }

    private static Set<Integer> toStopLevels(List<Integer> levels) {
        return levels == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(levels));
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
