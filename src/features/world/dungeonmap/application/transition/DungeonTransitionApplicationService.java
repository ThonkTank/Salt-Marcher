package features.world.dungeonmap.application.transition;

import database.DatabaseManager;
import features.world.api.OverworldTransitionTargetSummary;
import features.world.api.WorldReadApi;
import features.world.dungeonmap.application.stair.DungeonStairApplicationService;
import features.world.dungeonmap.application.room.DungeonRoomApplicationService;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeonmap.repository.DungeonCorridorRepository;
import features.world.dungeonmap.repository.DungeonLayoutRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonTransitionRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;
import java.util.List;

/**
 * Single transition workflow owner for target lookup plus create/place/delete writes.
 *
 * <p>The tool keeps temporary form state locally. This seam accepts only current-model destinations or prepared
 * transition ids, validates them, and persists paired dungeon transitions in one transaction.
 */
public final class DungeonTransitionApplicationService {

    private final DungeonLayoutRepository layoutRepository;
    private final DungeonRoomApplicationService roomApplicationService;
    private final DungeonTransitionRepository transitionRepository;
    private final DungeonRoomRepository roomRepository;
    private final DungeonCorridorRepository corridorRepository;

    public DungeonTransitionApplicationService(
            DungeonLayoutRepository layoutRepository,
            DungeonRoomApplicationService roomApplicationService,
            DungeonTransitionRepository transitionRepository,
            DungeonRoomRepository roomRepository,
            DungeonCorridorRepository corridorRepository
    ) {
        this.layoutRepository = Objects.requireNonNull(layoutRepository, "layoutRepository");
        this.roomApplicationService = Objects.requireNonNull(roomApplicationService, "roomApplicationService");
        this.transitionRepository = Objects.requireNonNull(transitionRepository, "transitionRepository");
        this.roomRepository = Objects.requireNonNull(roomRepository, "roomRepository");
        this.corridorRepository = Objects.requireNonNull(corridorRepository, "corridorRepository");
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
                DungeonTransition transition = requireTransition(conn, transitionId);
                DungeonLayout layout = requireLayout(conn, transition.mapId());
                releaseDoorOwner(conn, layout, transition.localConnection());
                transitionRepository.clearLinksTo(conn, transitionId);
                transitionRepository.delete(conn, transitionId);
                return null;
            });
        }
    }

    public void create(
            long mapId,
            String description,
            DungeonTransitionDestination destination,
            boolean bidirectional,
            DungeonSelectionRef sourceRef,
            int levelZ
    ) throws SQLException {
        createDoorTransition(mapId, description, destination, bidirectional, sourceRef, levelZ);
    }

    public void createStair(
            long mapId,
            String description,
            DungeonTransitionDestination destination,
            boolean bidirectional,
            DungeonStairApplicationService.StairDraft stairDraft
    ) throws SQLException {
        createStairTransition(mapId, description, destination, bidirectional, stairDraft);
    }

    private void createDoorTransition(
            long mapId,
            String description,
            DungeonTransitionDestination destination,
            boolean bidirectional,
            DungeonSelectionRef sourceRef,
            int levelZ
    ) throws SQLException {
        if (mapId <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (!(sourceRef instanceof DungeonSelectionRef.RoomBoundaryRef
                || sourceRef instanceof DungeonSelectionRef.CorridorBoundaryRef)) {
            throw new SQLException("Übergangs-Platzierung fehlt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                DungeonTransitionDestination validatedDestination = requireDestination(conn, destination, bidirectional);
                long reservedTransitionId = transitionRepository.nextTransitionId(conn);
                DungeonConnection localConnection = requireDoorConnection(layout, mapId, reservedTransitionId, sourceRef, levelZ);
                authorizeDoorOwner(conn, layout, sourceRef, levelZ);
                long insertedTransitionId = transitionRepository.insert(conn, new DungeonTransition(
                        reservedTransitionId,
                        mapId,
                        description,
                        localConnection,
                        validatedDestination,
                        null));
                if (bidirectional
                        && validatedDestination instanceof DungeonTransitionDestination.DungeonMapDestination dungeonDestination) {
                    long counterpartId = transitionRepository.insert(conn, new DungeonTransition(
                            null,
                            dungeonDestination.mapId(),
                            description,
                            null,
                            new DungeonTransitionDestination.DungeonMapDestination(mapId, insertedTransitionId),
                            insertedTransitionId));
                    transitionRepository.linkPair(conn, insertedTransitionId, counterpartId);
                }
                return null;
            });
        }
    }

    private void createStairTransition(
            long mapId,
            String description,
            DungeonTransitionDestination destination,
            boolean bidirectional,
            DungeonStairApplicationService.StairDraft stairDraft
    ) throws SQLException {
        if (mapId <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (stairDraft == null) {
            throw new SQLException("Treppen-Platzierung fehlt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                DungeonTransitionDestination validatedDestination = requireDestination(conn, destination, bidirectional);
                long reservedTransitionId = transitionRepository.nextTransitionId(conn);
                DungeonConnection localConnection = requireStairConnection(layout, mapId, reservedTransitionId, stairDraft, null);
                long insertedTransitionId = transitionRepository.insert(conn, new DungeonTransition(
                        reservedTransitionId,
                        mapId,
                        description,
                        localConnection,
                        validatedDestination,
                        null));
                if (bidirectional
                        && validatedDestination instanceof DungeonTransitionDestination.DungeonMapDestination dungeonDestination) {
                    long counterpartId = transitionRepository.insert(conn, new DungeonTransition(
                            null,
                            dungeonDestination.mapId(),
                            description,
                            null,
                            new DungeonTransitionDestination.DungeonMapDestination(mapId, insertedTransitionId),
                            insertedTransitionId));
                    transitionRepository.linkPair(conn, insertedTransitionId, counterpartId);
                }
                return null;
            });
        }
    }

    public void placePrepared(long transitionId, DungeonSelectionRef sourceRef, int levelZ) throws SQLException {
        if (transitionId <= 0) {
            throw new SQLException("Kein vorbereiteter Übergang gewählt");
        }
        if (!(sourceRef instanceof DungeonSelectionRef.RoomBoundaryRef
                || sourceRef instanceof DungeonSelectionRef.CorridorBoundaryRef)) {
            throw new SQLException("Übergangs-Platzierung fehlt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonTransition transition = requireTransition(conn, transitionId);
                DungeonLayout layout = requireLayout(conn, transition.mapId());
                DungeonConnection updatedLocalConnection = requireDoorConnection(layout, transition.mapId(), transitionId, sourceRef, levelZ);
                authorizeDoorOwner(conn, layout, sourceRef, levelZ);
                transitionRepository.updateLocalConnection(conn, transitionId, updatedLocalConnection);
                if (!sameDoorPlacement(transition.localConnection(), updatedLocalConnection)) {
                    releaseDoorOwner(conn, layout, transition.localConnection());
                }
                return null;
            });
        }
    }

    public void placePreparedStair(long transitionId, DungeonStairApplicationService.StairDraft stairDraft) throws SQLException {
        if (transitionId <= 0) {
            throw new SQLException("Kein vorbereiteter Übergang gewählt");
        }
        if (stairDraft == null) {
            throw new SQLException("Treppen-Platzierung fehlt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonTransition transition = requireTransition(conn, transitionId);
                DungeonLayout layout = requireLayout(conn, transition.mapId());
                transitionRepository.updateLocalConnection(
                        conn,
                        transitionId,
                        requireStairConnection(layout, transition.mapId(), transitionId, stairDraft, transitionId));
                releaseDoorOwner(conn, layout, transition.localConnection());
                return null;
            });
        }
    }

    private boolean sameDoorPlacement(DungeonConnection previous, DungeonConnection next) {
        if (previous == null || next == null || previous.doorCarrier() == null || next.doorCarrier() == null) {
            return false;
        }
        return previous.levelZ() == next.levelZ()
                && Objects.equals(previous.anchorSegment2x(), next.anchorSegment2x())
                && Objects.equals(previous.entryEndpoint(), next.entryEndpoint());
    }

    private void authorizeDoorOwner(
            Connection conn,
            DungeonLayout layout,
            DungeonSelectionRef sourceRef,
            int levelZ
    ) throws SQLException {
        if (conn == null || layout == null || sourceRef == null) {
            return;
        }
        if (sourceRef instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary) {
            Room room = layout.findRoom(roomBoundary.roomId());
            if (room == null) {
                throw new SQLException("Raum " + roomBoundary.roomId() + " existiert nicht");
            }
            RoomCluster cluster = layout.findCluster(room.clusterId());
            if (cluster == null) {
                throw new SQLException("Cluster " + room.clusterId() + " existiert nicht");
            }
            RoomCluster updatedCluster = cluster.withExteriorOpening(levelZ, roomBoundary.boundarySegment2x());
            if (updatedCluster != cluster) {
                roomRepository.replaceClusters(conn, layout.mapId(), List.of(cluster), List.of(updatedCluster));
            }
            return;
        }
        if (sourceRef instanceof DungeonSelectionRef.CorridorBoundaryRef corridorBoundary) {
            Corridor corridor = layout.findCorridor(corridorBoundary.corridorId());
            if (corridor == null) {
                throw new SQLException("Corridor " + corridorBoundary.corridorId() + " existiert nicht");
            }
            Corridor updatedCorridor = corridor.withBoundaryDoor(layout, corridorBoundary.boundarySegment2x());
            if (updatedCorridor != corridor) {
                corridorRepository.save(conn, updatedCorridor, layout);
            }
        }
    }

    private void releaseDoorOwner(Connection conn, DungeonLayout layout, DungeonConnection localConnection) throws SQLException {
        if (conn == null || layout == null || localConnection == null || localConnection.doorCarrier() == null) {
            return;
        }
        GridSegment2x boundarySegment2x = localConnection.anchorSegment2x();
        ConnectionEndpoint sourceEndpoint = localConnection.entryEndpoint();
        if (boundarySegment2x == null || sourceEndpoint == null) {
            return;
        }
        switch (sourceEndpoint.type()) {
            case ROOM -> {
                Room room = layout.findRoom(sourceEndpoint.id());
                if (room == null) {
                    return;
                }
                RoomCluster cluster = layout.findCluster(room.clusterId());
                if (cluster == null) {
                    return;
                }
                RoomCluster updatedCluster = cluster.withoutExteriorOpening(localConnection.levelZ(), boundarySegment2x);
                if (updatedCluster != cluster) {
                    roomRepository.replaceClusters(conn, layout.mapId(), List.of(cluster), List.of(updatedCluster));
                }
            }
            case CORRIDOR -> {
                Corridor corridor = layout.findCorridor(sourceEndpoint.id());
                if (corridor == null) {
                    return;
                }
                Corridor updatedCorridor = corridor.withoutBoundaryDoor(layout, boundarySegment2x);
                if (updatedCorridor != corridor) {
                    corridorRepository.save(conn, updatedCorridor, layout);
                }
            }
            default -> {
            }
        }
    }

    private DungeonConnection requireDoorConnection(
            DungeonLayout layout,
            long mapId,
            Long transitionId,
            DungeonSelectionRef sourceRef,
            int levelZ
    ) throws SQLException {
        if (layout == null || sourceRef == null) {
            throw new SQLException("Tür-Platzierung fehlt");
        }
        try {
            return TransitionConnectionBuilder.buildDoorConnection(layout, mapId, transitionId, sourceRef, levelZ);
        } catch (IllegalArgumentException ex) {
            throw new SQLException(ex.getMessage(), ex);
        }
    }

    private DungeonConnection requireStairConnection(
            DungeonLayout layout,
            long mapId,
            Long transitionId,
            DungeonStairApplicationService.StairDraft stairDraft,
            Long ignoredTransitionId
    ) throws SQLException {
        if (layout == null || stairDraft == null) {
            throw new SQLException("Treppen-Platzierung fehlt");
        }
        try {
            return TransitionConnectionBuilder.buildStairConnection(
                    layout,
                    mapId,
                    transitionId,
                    stairDraft,
                    false,
                    ignoredTransitionId);
        } catch (IllegalArgumentException ex) {
            throw new SQLException(ex.getMessage(), ex);
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

    private DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        DungeonLayout layout = layoutRepository.loadLayout(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }
}
