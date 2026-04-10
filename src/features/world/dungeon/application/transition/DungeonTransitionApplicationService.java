package features.world.dungeon.application.transition;

import database.DatabaseManager;
import features.world.dungeon.application.stair.DungeonStairApplicationService;
import features.world.dungeon.application.support.DungeonTransactionRunner;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.dungeonmap.connections.input.ConnectionEndpoint;
import features.world.dungeon.dungeonmap.connections.input.DungeonConnection;
import features.world.dungeon.model.structures.transition.DungeonTransition;
import features.world.dungeon.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeon.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeon.repository.DungeonTransitionRepository;
import features.world.dungeon.stair.model.StairPlacementSpec;
import features.world.dungeon.transition.TransitionObject;
import features.world.dungeon.transition.input.CreateStairTransitionInput;
import features.world.dungeon.transition.input.CreateTransitionInput;
import features.world.dungeon.transition.input.DeleteTransitionInput;
import features.world.dungeon.transition.input.LoadOverworldTargetsInput;
import features.world.dungeon.transition.input.PlacePreparedStairTransitionInput;
import features.world.dungeon.transition.input.PlacePreparedTransitionInput;
import features.world.read.ReadObject;
import features.world.read.input.FindOverworldMapIdForTileInput;
import features.world.read.input.LoadOverworldTransitionTargetsInput.OverworldTransitionTargetSummaryInput;
import features.world.read.input.LoadOverworldTransitionTargetsInput;

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
@SuppressWarnings("unused")
public final class DungeonTransitionApplicationService {
    private static final ReadObject WORLD_READ_OBJECT = new ReadObject();

    private final DungeonMapRepository mapRepository;
    private final DungeonTransitionRepository transitionRepository;
    private final TransitionObject transitionObject;

    public DungeonTransitionApplicationService(
            DungeonMapRepository mapRepository,
            DungeonTransitionRepository transitionRepository,
            TransitionObject transitionObject
    ) {
        this.mapRepository = Objects.requireNonNull(mapRepository, "mapRepository");
        this.transitionRepository = Objects.requireNonNull(transitionRepository, "transitionRepository");
        this.transitionObject = Objects.requireNonNull(transitionObject, "transitionObject");
    }

    public List<DungeonTransition> loadDungeonTargets(long mapId) throws SQLException {
        if (mapId <= 0) {
            return List.of();
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return requireLayout(conn, mapId).placedTransitions();
        }
    }

    public List<OverworldTransitionTargetSummaryInput> loadOverworldTargets() throws SQLException {
        return WORLD_READ_OBJECT.loadOverworldTransitionTargets(new LoadOverworldTransitionTargetsInput()).targets();
    }

    public void delete(long transitionId) throws SQLException {
        transitionObject.deleteTransition(new DeleteTransitionInput(transitionId));
    }

    public void create(
            long mapId,
            String description,
            DungeonTransitionDestination destination,
            boolean bidirectional,
            DungeonSelectionRef sourceRef,
            int levelZ
    ) throws SQLException {
        if (!(sourceRef instanceof DungeonSelectionRef.DoorRef doorRef)) {
            throw new SQLException("Übergangs-Platzierung fehlt");
        }
        transitionObject.createTransition(new CreateTransitionInput(
                mapId,
                description,
                toDestinationInput(destination),
                bidirectional,
                doorRef.doorId(),
                levelZ));
    }

    public void createStair(
            long mapId,
            String description,
            DungeonTransitionDestination destination,
            boolean bidirectional,
            DungeonStairApplicationService.StairDraft stairDraft
    ) throws SQLException {
        transitionObject.createStairTransition(new CreateStairTransitionInput(
                mapId,
                description,
                toDestinationInput(destination),
                bidirectional,
                toDraftInput(stairDraft)));
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
        if (!(sourceRef instanceof DungeonSelectionRef.DoorRef)) {
            throw new SQLException("Übergangs-Platzierung fehlt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, mapId);
                DungeonTransitionDestination validatedDestination = requireDestination(conn, destination, bidirectional);
                long reservedTransitionId = transitionRepository.nextTransitionId(conn);
                DungeonConnection localConnection = requireDoorConnection(layout, mapId, reservedTransitionId, sourceRef, levelZ);
                long insertedTransitionId = transitionRepository.insert(conn, new DungeonTransition(
                        reservedTransitionId,
                        mapId,
                        description,
                        localConnection,
                        validatedDestination,
                        null,
                        null));
                if (bidirectional
                        && validatedDestination instanceof DungeonTransitionDestination.DungeonMapDestination dungeonDestination) {
                    long counterpartId = transitionRepository.insert(conn, new DungeonTransition(
                            null,
                            dungeonDestination.mapId(),
                            description,
                            null,
                            new DungeonTransitionDestination.DungeonMapDestination(mapId, insertedTransitionId),
                            insertedTransitionId,
                            null));
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
                DungeonMap layout = requireLayout(conn, mapId);
                DungeonTransitionDestination validatedDestination = requireDestination(conn, destination, bidirectional);
                long reservedTransitionId = transitionRepository.nextTransitionId(conn);
                StairPlacementSpec placementSpec = toPlacementSpec(stairDraft);
                DungeonConnection localConnection = requireStairConnection(layout, mapId, reservedTransitionId, stairDraft, null);
                long insertedTransitionId = transitionRepository.insert(conn, new DungeonTransition(
                        reservedTransitionId,
                        mapId,
                        description,
                        localConnection,
                        validatedDestination,
                        null,
                        placementSpec));
                if (bidirectional
                        && validatedDestination instanceof DungeonTransitionDestination.DungeonMapDestination dungeonDestination) {
                    long counterpartId = transitionRepository.insert(conn, new DungeonTransition(
                            null,
                            dungeonDestination.mapId(),
                            description,
                            null,
                            new DungeonTransitionDestination.DungeonMapDestination(mapId, insertedTransitionId),
                            insertedTransitionId,
                            null));
                    transitionRepository.linkPair(conn, insertedTransitionId, counterpartId);
                }
                return null;
            });
        }
    }

    public void placePrepared(long transitionId, DungeonSelectionRef sourceRef, int levelZ) throws SQLException {
        if (!(sourceRef instanceof DungeonSelectionRef.DoorRef doorRef)) {
            throw new SQLException("Übergangs-Platzierung fehlt");
        }
        transitionObject.placePreparedTransition(new PlacePreparedTransitionInput(
                transitionId,
                doorRef.doorId(),
                levelZ));
    }

    public void placePreparedStair(long transitionId, DungeonStairApplicationService.StairDraft stairDraft) throws SQLException {
        transitionObject.placePreparedStairTransition(new PlacePreparedStairTransitionInput(
                transitionId,
                toDraftInput(stairDraft)));
    }

    private static CreateTransitionInput.DestinationInput toDestinationInput(
            DungeonTransitionDestination destination
    ) {
        if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            return new CreateTransitionInput.DestinationInput(
                    overworld.typeKey(),
                    overworld.mapId(),
                    null,
                    overworld.tileId());
        }
        if (destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            return new CreateTransitionInput.DestinationInput(
                    dungeon.typeKey(),
                    dungeon.mapId(),
                    dungeon.transitionId(),
                    0L);
        }
        return null;
    }

    private static PlacePreparedStairTransitionInput.DraftInput toDraftInput(
            DungeonStairApplicationService.StairDraft draft
    ) {
        if (draft == null) {
            return null;
        }
        return new PlacePreparedStairTransitionInput.DraftInput(
                draft.name(),
                draft.anchorCell().x2() / 2,
                draft.anchorCell().y2() / 2,
                draft.anchorCell().z(),
                draft.anchorLevelZ(),
                new PlacePreparedStairTransitionInput.ShapeSpecInput(
                        draft.shapeSpec().kind().name(),
                        draft.shapeSpec().direction().name(),
                        draft.shapeSpec().parameter1(),
                        draft.shapeSpec().parameter2()),
                draft.minLevelZ(),
                draft.maxLevelZ(),
                draft.stopLevels().stream().toList());
    }

    private DungeonConnection requireDoorConnection(
            DungeonMap layout,
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
            DungeonMap layout,
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
            Long resolvedMapId = WORLD_READ_OBJECT.findOverworldMapIdForTile(
                    new FindOverworldMapIdForTileInput(overworld.tileId())).mapId();
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
        Long mapId = transitionRepository.findMapId(conn, transitionId == null ? -1L : transitionId);
        if (mapId == null) {
            throw new SQLException("Übergang existiert nicht");
        }
        DungeonTransition transition = requireLayout(conn, mapId).findTransition(transitionId);
        if (transition == null) {
            throw new SQLException("Übergang existiert nicht");
        }
        return transition;
    }

    private DungeonMap requireLayout(Connection conn, long mapId) throws SQLException {
        DungeonMap layout = mapRepository.loadMap(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }

    private static StairPlacementSpec toPlacementSpec(DungeonStairApplicationService.StairDraft draft) {
        if (draft == null) {
            return null;
        }
        return new StairPlacementSpec(
                draft.anchorCell(),
                draft.anchorLevelZ(),
                draft.shapeSpec(),
                draft.minLevelZ(),
                draft.maxLevelZ(),
                draft.stopLevels());
    }
}
