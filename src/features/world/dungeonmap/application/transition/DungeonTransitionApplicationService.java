package features.world.dungeonmap.application.transition;

import database.DatabaseManager;
import features.world.api.OverworldTransitionTargetSummary;
import features.world.api.WorldReadApi;
import features.world.dungeonmap.application.stair.DungeonStairApplicationService;
import features.world.dungeonmap.application.stair.StairDraftResolver;
import features.world.dungeonmap.application.room.DungeonRoomApplicationService;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionPlacement;
import features.world.dungeonmap.repository.DungeonLayoutRepository;
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

    public DungeonTransitionApplicationService(
            DungeonLayoutRepository layoutRepository,
            DungeonRoomApplicationService roomApplicationService,
            DungeonTransitionRepository transitionRepository
    ) {
        this.layoutRepository = Objects.requireNonNull(layoutRepository, "layoutRepository");
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
            String description,
            DungeonTransitionDestination destination,
            boolean bidirectional,
            DungeonTransitionPlacement.DoorPlacement placement
    ) throws SQLException {
        createTransition(mapId, description, destination, bidirectional, placement);
    }

    public void createStair(
            long mapId,
            String description,
            DungeonTransitionDestination destination,
            boolean bidirectional,
            DungeonStairApplicationService.StairDraft stairDraft
    ) throws SQLException {
        createTransition(mapId, description, destination, bidirectional, stairPlacement(mapId, stairDraft));
    }

    private void createTransition(
            long mapId,
            String description,
            DungeonTransitionDestination destination,
            boolean bidirectional,
            DungeonTransitionPlacement placement
    ) throws SQLException {
        if (mapId <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (placement == null) {
            throw new SQLException("Übergangs-Platzierung fehlt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonTransitionPlacement validatedPlacement = requirePlacement(conn, mapId, placement, null);
                DungeonTransitionDestination validatedDestination = requireDestination(conn, destination, bidirectional);
                long transitionId = transitionRepository.insert(conn, new DungeonTransition(
                        null,
                        mapId,
                        description,
                        validatedPlacement,
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

    public void placePrepared(long transitionId, DungeonTransitionPlacement.DoorPlacement placement) throws SQLException {
        placePreparedTransition(transitionId, placement);
    }

    public void placePreparedStair(long transitionId, DungeonStairApplicationService.StairDraft stairDraft) throws SQLException {
        if (transitionId <= 0) {
            throw new SQLException("Kein vorbereiteter Übergang gewählt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransition transition = requireTransition(conn, transitionId);
            DungeonTransitionPlacement placement = stairPlacement(transition.mapId(), stairDraft);
            placePreparedTransition(transitionId, placement);
        }
    }

    private void placePreparedTransition(long transitionId, DungeonTransitionPlacement placement) throws SQLException {
        if (transitionId <= 0) {
            throw new SQLException("Kein vorbereiteter Übergang gewählt");
        }
        if (placement == null) {
            throw new SQLException("Übergangs-Platzierung fehlt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonTransition transition = requireTransition(conn, transitionId);
                transitionRepository.updatePlacement(
                        conn,
                        transitionId,
                        requirePlacement(conn, transition.mapId(), placement, transitionId));
                return null;
            });
        }
    }

    private DungeonTransitionPlacement stairPlacement(
            long mapId,
            DungeonStairApplicationService.StairDraft stairDraft
    ) throws SQLException {
        if (stairDraft == null) {
            throw new SQLException("Treppen-Platzierung fehlt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonLayout layout = requireLayout(conn, mapId);
            StairDraftResolver.ResolvedStairDraft resolvedDraft = StairDraftResolver.resolveDraft(layout, mapId, stairDraft, false);
            return new DungeonTransitionPlacement.StairPlacement(
                    resolvedDraft.draft().anchorCell(),
                    resolvedDraft.draft().anchorLevelZ(),
                    resolvedDraft.draft().shape(),
                    resolvedDraft.draft().direction(),
                    resolvedDraft.draft().minLevelZ(),
                    resolvedDraft.draft().maxLevelZ(),
                    resolvedDraft.draft().dimension1(),
                    resolvedDraft.draft().dimension2(),
                    resolvedDraft.path(),
                    resolvedDraft.stopLevels());
        }
    }

    private DungeonTransitionPlacement requirePlacement(
            Connection conn,
            long mapId,
            DungeonTransitionPlacement placement,
            Long ignoredTransitionId
    ) throws SQLException {
        DungeonLayout layout = requireLayout(conn, mapId);
        if (placement instanceof DungeonTransitionPlacement.DoorPlacement doorPlacement) {
            return requireDoorPlacement(layout, doorPlacement, ignoredTransitionId);
        }
        if (placement instanceof DungeonTransitionPlacement.StairPlacement stairPlacement) {
            ensureStairCellsFree(layout, stairPlacement, ignoredTransitionId);
            return stairPlacement;
        }
        throw new SQLException("Unbekannte Übergangs-Platzierung");
    }

    private DungeonTransitionPlacement.DoorPlacement requireDoorPlacement(
            DungeonLayout layout,
            DungeonTransitionPlacement.DoorPlacement placement,
            Long ignoredTransitionId
    ) throws SQLException {
        if (layout == null || placement == null) {
            throw new SQLException("Tür-Platzierung fehlt");
        }
        switch (placement.sourceEndpoint().type()) {
            case ROOM -> {
                DungeonLayout.RoomBoundaryDescription boundary = layout.describeRoomBoundary(
                        new DungeonSelectionRef.RoomBoundaryRef(placement.sourceEndpoint().id(), placement.boundarySegment2x()),
                        placement.levelZ());
                if (boundary == null || !boundary.exterior()) {
                    throw new SQLException("Tür-Übergänge benötigen eine freie Raum-Außenwand");
                }
            }
            case CORRIDOR -> {
                DungeonLayout.CorridorBoundaryDescription boundary = layout.describeCorridorBoundary(
                        new DungeonSelectionRef.CorridorBoundaryRef(placement.sourceEndpoint().id(), placement.boundarySegment2x()),
                        placement.levelZ());
                if (boundary == null) {
                    throw new SQLException("Tür-Übergänge benötigen eine freie Corridor-Grenze");
                }
            }
            default -> throw new SQLException("Tür-Übergänge unterstützen nur Raum- oder Corridor-Grenzen");
        }
        if (layout.connectionAt(placement.levelZ(), placement.boundarySegment2x()) != null) {
            throw new SQLException("An dieser Grenze existiert bereits eine Verbindung");
        }
        boolean occupied = layout.transitions().stream()
                .filter(DungeonTransition::isPlaced)
                .filter(transition -> !Objects.equals(transition.transitionId(), ignoredTransitionId))
                .map(DungeonTransition::doorPlacement)
                .filter(Objects::nonNull)
                .anyMatch(existing -> existing.levelZ() == placement.levelZ()
                        && existing.boundarySegment2x().equals(placement.boundarySegment2x()));
        if (occupied) {
            throw new SQLException("An dieser Grenze existiert bereits ein Übergang");
        }
        return placement;
    }

    private void ensureStairCellsFree(
            DungeonLayout layout,
            DungeonTransitionPlacement.StairPlacement stairPlacement,
            Long ignoredTransitionId
    ) throws SQLException {
        boolean occupied = layout.transitions().stream()
                .filter(DungeonTransition::isPlaced)
                .filter(transition -> !Objects.equals(transition.transitionId(), ignoredTransitionId))
                .flatMap(transition -> transition.placement() == null ? java.util.stream.Stream.<CubePoint>of() : transition.placement().occupiedPositions().stream())
                .anyMatch(stairPlacement.occupiedPositions()::contains);
        if (occupied) {
            throw new SQLException("Ein anderer Übergang belegt bereits Teile dieser Treppe");
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
