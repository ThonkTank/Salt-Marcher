package features.world.dungeonmap.application.transition;

import database.DatabaseManager;
import features.world.api.WorldReadApi;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeonmap.repository.DungeonStorageSupport;
import features.world.dungeonmap.repository.DungeonTransitionRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

/**
 * Transition commits accept either a fully resolved destination or a prepared transition id.
 *
 * <p>The tool owns temporary form state. This application seam owns only validation, paired-transition write order,
 * and reload-worthy transition persistence.
 */
public final class DungeonTransitionApplicationService {

    private final DungeonRoomTopologyService roomTopologyService;
    private final DungeonTransitionRepository transitionRepository;

    public DungeonTransitionApplicationService(
            DungeonRoomTopologyService roomTopologyService,
            DungeonTransitionRepository transitionRepository
    ) {
        this.roomTopologyService = Objects.requireNonNull(roomTopologyService, "roomTopologyService");
        this.transitionRepository = Objects.requireNonNull(transitionRepository, "transitionRepository");
    }

    public void commit(DungeonLayout layout, CubePoint anchor, TransitionPlacementIntent intent) throws SQLException {
        if (intent instanceof TransitionPlacementIntent.PlacePrepared prepared) {
            placePrepared(prepared.transitionId(), anchor);
            return;
        }
        create(layout, anchor, requireCreateIntent(intent));
    }

    public void delete(long transitionId) throws SQLException {
        if (transitionId <= 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonStorageSupport.ensureReady(conn);
                transitionRepository.clearLinksTo(conn, transitionId);
                transitionRepository.delete(conn, transitionId);
                return null;
            });
        }
    }

    private void create(
            DungeonLayout layout,
            CubePoint anchor,
            TransitionPlacementIntent.Create intent
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (anchor == null) {
            throw new SQLException("Kein Zielfeld gewählt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonStorageSupport.ensureReady(conn);
                roomTopologyService.ensureTraversableCell(conn, layout.mapId(), anchor.projectedCell(), anchor.z());
                DungeonTransitionDestination destination = requireDestination(conn, intent.destination(), intent.bidirectional());
                long transitionId = transitionRepository.insert(conn, new DungeonTransition(
                        null,
                        layout.mapId(),
                        intent.description(),
                        anchor,
                        destination,
                        null));
                if (intent.bidirectional()
                        && destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeonDestination) {
                    long counterpartId = transitionRepository.insert(conn, new DungeonTransition(
                            null,
                            dungeonDestination.mapId(),
                            intent.description(),
                            null,
                            new DungeonTransitionDestination.DungeonMapDestination(layout.mapId(), transitionId),
                            transitionId));
                    transitionRepository.linkPair(conn, transitionId, counterpartId);
                }
                return null;
            });
        }
    }

    private void placePrepared(long transitionId, CubePoint anchor) throws SQLException {
        if (transitionId <= 0) {
            throw new SQLException("Kein vorbereiteter Übergang gewählt");
        }
        if (anchor == null) {
            throw new SQLException("Kein Zielfeld gewählt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonStorageSupport.ensureReady(conn);
                DungeonTransition transition = requireTransition(conn, transitionId);
                roomTopologyService.ensureTraversableCell(conn, transition.mapId(), anchor.projectedCell(), anchor.z());
                transitionRepository.updatePlacement(conn, transitionId, anchor);
                return null;
            });
        }
    }

    private TransitionPlacementIntent.Create requireCreateIntent(TransitionPlacementIntent intent) throws SQLException {
        if (!(intent instanceof TransitionPlacementIntent.Create createIntent) || createIntent.destination() == null) {
            throw new SQLException("Übergangsziel fehlt");
        }
        return createIntent;
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
            if (!WorldReadApi.overworldTileExists(overworld.tileId())) {
                throw new SQLException("Overworld-Zielfeld existiert nicht");
            }
            long mapId = overworld.mapId();
            if (mapId <= 0) {
                Long resolvedMapId = WorldReadApi.findOverworldMapIdForTile(overworld.tileId());
                if (resolvedMapId == null || resolvedMapId <= 0) {
                    throw new SQLException("Overworld-Zielfeld existiert nicht");
                }
                mapId = resolvedMapId;
            }
            return new DungeonTransitionDestination.OverworldTileDestination(mapId, overworld.tileId());
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
