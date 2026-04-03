package features.world.dungeonmap.application.transition;

import database.DatabaseManager;
import features.world.api.OverworldTransitionTargetSummary;
import features.world.api.WorldReadApi;
import features.world.dungeonmap.application.room.DungeonRoomApplicationService;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeonmap.repository.DungeonTransitionRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;

/**
 * Single transition workflow owner for target lookup plus create/place/delete writes.
 *
 * <p>The tool keeps temporary form state locally. This seam accepts only current-model destinations or prepared
 * transition ids, validates them, and persists paired dungeon transitions in one transaction.
 */
public final class DungeonTransitionApplicationService {

    private final DungeonRoomApplicationService roomApplicationService;
    private final DungeonTransitionRepository transitionRepository;

    public DungeonTransitionApplicationService(
            DungeonRoomApplicationService roomApplicationService,
            DungeonTransitionRepository transitionRepository
    ) {
        this.roomApplicationService = Objects.requireNonNull(roomApplicationService, "roomApplicationService");
        this.transitionRepository = Objects.requireNonNull(transitionRepository, "transitionRepository");
    }

    public List<DungeonTransition> loadDungeonTargets(long mapId) throws SQLException {
        if (mapId <= 0) {
            return List.of();
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return transitionRepository.loadPlacedByMap(conn, mapId);
        }
    }

    public List<OverworldTransitionTargetSummary> loadOverworldTargets() throws SQLException {
        return WorldReadApi.loadOverworldTransitionTargets();
    }

    public void delete(long transitionId) throws SQLException {
        if (transitionId <= 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                transitionRepository.clearLinksTo(conn, transitionId);
                transitionRepository.delete(conn, transitionId);
                return null;
            });
        }
    }

    public void create(
            long mapId,
            CubePoint anchor,
            String description,
            DungeonTransitionDestination destination,
            boolean bidirectional
    ) throws SQLException {
        if (mapId <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (anchor == null) {
            throw new SQLException("Kein Zielfeld gewählt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                roomApplicationService.ensureTraversableCell(conn, mapId, anchor.projectedCell(), anchor.z());
                DungeonTransitionDestination validatedDestination = requireDestination(conn, destination, bidirectional);
                long transitionId = transitionRepository.insert(conn, new DungeonTransition(
                        null,
                        mapId,
                        description,
                        anchor,
                        validatedDestination,
                        null));
                if (bidirectional
                        && validatedDestination instanceof DungeonTransitionDestination.DungeonMapDestination dungeonDestination) {
                    long counterpartId = transitionRepository.insert(conn, new DungeonTransition(
                            null,
                            dungeonDestination.mapId(),
                            description,
                            null,
                            new DungeonTransitionDestination.DungeonMapDestination(mapId, transitionId),
                            transitionId));
                    transitionRepository.linkPair(conn, transitionId, counterpartId);
                }
                return null;
            });
        }
    }

    public void placePrepared(long transitionId, CubePoint anchor) throws SQLException {
        if (transitionId <= 0) {
            throw new SQLException("Kein vorbereiteter Übergang gewählt");
        }
        if (anchor == null) {
            throw new SQLException("Kein Zielfeld gewählt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonTransition transition = requireTransition(conn, transitionId);
                roomApplicationService.ensureTraversableCell(conn, transition.mapId(), anchor.projectedCell(), anchor.z());
                transitionRepository.updatePlacement(conn, transitionId, anchor);
                return null;
            });
        }
    }

    private DungeonTransitionDestination requireDestination(
            Connection conn,
            DungeonTransitionDestination destination,
            boolean bidirectional
    ) throws SQLException {
        if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            if (overworld.tileId() <= 0) {
                throw new SQLException("Overworld-Zielfeld fehlt");
            }
            Long resolvedMapId = WorldReadApi.findOverworldMapIdForTile(overworld.tileId());
            if (resolvedMapId == null || resolvedMapId <= 0) {
                throw new SQLException("Overworld-Zielfeld existiert nicht");
            }
            return new DungeonTransitionDestination.OverworldTileDestination(resolvedMapId, overworld.tileId());
        }
        if (!(destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon)) {
            throw new SQLException("Übergangsziel fehlt");
        }
        if (dungeon.mapId() <= 0 || !transitionRepository.dungeonMapExists(conn, dungeon.mapId())) {
            throw new SQLException("Dungeon-Zielkarte existiert nicht");
        }
        if (!bidirectional) {
            if (dungeon.transitionId() == null || dungeon.transitionId() <= 0) {
                throw new SQLException("Ziel-Übergang fehlt");
            }
            DungeonTransition targetTransition = requireTransition(conn, dungeon.transitionId());
            if (targetTransition.mapId() != dungeon.mapId()) {
                throw new SQLException("Ziel-Übergang gehört nicht zur gewählten Karte");
            }
        }
        return new DungeonTransitionDestination.DungeonMapDestination(dungeon.mapId(), dungeon.transitionId());
    }

    private DungeonTransition requireTransition(Connection conn, Long transitionId) throws SQLException {
        DungeonTransition transition = transitionRepository.find(conn, transitionId == null ? -1L : transitionId);
        if (transition == null) {
            throw new SQLException("Übergang existiert nicht");
        }
        return transition;
    }
}
