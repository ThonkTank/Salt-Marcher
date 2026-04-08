package features.world.dungeon.transition;

import database.DatabaseManager;
import features.world.dungeon.application.support.DungeonTransactionRunner;
import features.world.dungeon.transition.input.DeleteTransitionInput;
import features.world.dungeon.transition.input.LoadDungeonTargetsInput;
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
