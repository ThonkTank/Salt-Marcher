package features.dungeon.application.authored;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonTopology;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.projection.DungeonDerivedState;
import features.dungeon.domain.core.projection.DungeonDerivedStateProjection;
import features.dungeon.domain.core.projection.DungeonMapFacts;
import features.dungeon.application.authored.port.DungeonMapRepository;
import features.dungeon.application.authored.port.DungeonChangeSet;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.DungeonMapOperationFeedbackRules;
import features.dungeon.domain.core.structure.corridor.CorridorDeletionTarget;
import features.dungeon.domain.core.structure.corridor.CorridorMapAuthoring;
import features.dungeon.domain.core.structure.corridor.DungeonCorridorEndpoint;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.stair.StairGeometrySpec;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionCatalog;
import features.dungeon.domain.core.structure.transition.TransitionCatalog.AuthoredTransitionLinkMap;
import features.dungeon.domain.core.structure.transition.TransitionCatalog.AuthoredTransitionLinkRewrite;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import features.dungeon.application.editor.interaction.DungeonEditorHandleMutation;
import features.dungeon.application.editor.interaction.DungeonEditorHandleProjection;
import features.dungeon.api.DungeonEditorHandleKind;
import features.dungeon.application.editor.session.DungeonEditorDungeonState;
import features.dungeon.application.editor.session.DungeonEditorRoomNarrationInput;
import features.dungeon.application.editor.session.DungeonEditorSessionSnapshot;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceHandleMovement;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceGeometry;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.application.editor.helper.DungeonEditorAuthoredOperationHelper;
import features.dungeon.application.editor.helper.DungeonEditorSessionPreviewHelper;
import features.dungeon.application.editor.helper.DungeonEditorWorkspaceAreaProjectionHelper;
import features.dungeon.application.editor.helper.DungeonEditorWorkspaceBoundaryProjectionHelper;
import features.dungeon.application.editor.helper.DungeonEditorWorkspaceFeatureProjectionHelper;
import features.dungeon.application.editor.helper.DungeonEditorWorkspaceHandleProjectionHelper;
import features.dungeon.application.editor.usecase.AssembleDungeonSnapshotUseCase;
import features.dungeon.application.editor.usecase.InspectDungeonSelectionUseCase;
import features.dungeon.application.editor.usecase.LoadDungeonSnapshotUseCase;
import features.dungeon.application.editor.usecase.PreviewDungeonEditorSurfaceMoveUseCase;
import features.dungeon.application.editor.usecase.PublishDungeonEditorHandlesUseCase;
import features.dungeon.api.DungeonAuthoredMutationModel;
import features.dungeon.api.DungeonAuthoredReadModel;
import features.dungeon.api.DungeonMapCatalogModel;
import features.dungeon.api.authored.DungeonAuthoredApi;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.api.DungeonViewportRequest;
import features.dungeon.api.DungeonViewportSnapshot;

public final class DungeonAuthoredApplicationService implements DungeonAuthoredApi {
    private static final DungeonMapOperationFeedbackRules OPERATION_FEEDBACK_POLICY =
            new DungeonMapOperationFeedbackRules();
    private static final DungeonEditorHandleMutation HANDLE_MUTATION = new DungeonEditorHandleMutation();
    private static final CorridorMapAuthoring CORRIDOR_AUTHORING = new CorridorMapAuthoring();
    private static final long PREVIEW_STAIR_ID = Long.MAX_VALUE;
    private static final long ABSENT_ID = 0L;
    private static final long MIN_CLUSTER_ID = 0L;
    private static final String DEFAULT_MAP_NAME = "Dungeon Map";
    private static final String DEFAULT_LABEL = "";
    private static final String DEFAULT_DESCRIPTION = "";
    private static final String PREVIEW_ARGUMENT = "preview";

    private final DungeonMapRepository repository;
    private final DungeonAuthoredPublishedState publishedState;
    /* Pointer previews operate on this immutable authored workset. */
    private final ConcurrentMap<Long, DungeonMap> authoredWorkset = new ConcurrentHashMap<>();
    private final DungeonEditHistory editHistory = new DungeonEditHistory();
    private final DungeonViewportProjection viewportProjection = new DungeonViewportProjection();
    private final DungeonDerivedStateProjection derivedStateProjection = new DungeonDerivedStateProjection();
    private final PublishDungeonEditorHandlesUseCase publishDungeonEditorHandles =
            new PublishDungeonEditorHandlesUseCase();
    private final AssembleDungeonSnapshotUseCase assembleDungeonSnapshot =
            new AssembleDungeonSnapshotUseCase(derivedStateProjection);
    private final InspectDungeonSelectionUseCase inspectDungeonSelection = new InspectDungeonSelectionUseCase();
    private final PreviewDungeonEditorSurfaceMoveUseCase surfaceMovePreviewUseCase =
            new PreviewDungeonEditorSurfaceMoveUseCase();
    private final MutationPipeline mutationPipeline = new MutationPipeline();
    private final PublicationOperations publicationOperations = new PublicationOperations();
    private final PreviewOperations previewOperations = new PreviewOperations();
    private final DetailSaveOperations detailSaveOperations = new DetailSaveOperations();
    private final TransitionLinkOperations transitionLinkOperations = new TransitionLinkOperations();
    private final CatalogOperations catalogOperations = new CatalogOperations();
    private final HandleOperations handleOperations = new HandleOperations();
    private final CorridorFeatureOperations corridorFeatureOperations = new CorridorFeatureOperations();
    private final StairTransitionOperations stairTransitionOperations = new StairTransitionOperations();
    private final LoadOperations loadOperations = new LoadOperations();

    public DungeonAuthoredApplicationService(
            DungeonMapRepository repository,
            DungeonAuthoredPublishedState publishedState
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
    }

    public Session openSession(DungeonEditorDungeonState dungeonState) {
        return new Session(
                catalogOperations,
                loadOperations,
                previewOperations,
                detailSaveOperations,
                Objects.requireNonNull(dungeonState, "dungeonState"));
    }

    @Override
    public DungeonAuthoredReadModel authoredMaps() {
        return publishedState.authoredReadModel();
    }

    @Override
    public DungeonAuthoredMutationModel authoredMutations() {
        return publishedState.authoredMutationModel();
    }

    @Override
    public DungeonMapCatalogModel mapCatalog() {
        return publishedState.mapCatalogModel();
    }

    @Override
    public DungeonViewportSnapshot viewport(DungeonViewportRequest request) {
        DungeonViewportRequest safeRequest = Objects.requireNonNull(request, "request");
        DungeonMap map = loadMap(new DungeonMapIdentity(safeRequest.mapId()));
        DungeonDerivedState derived = derive(map);
        return viewportProjection.project(
                safeRequest,
                map.revision(),
                DungeonPublishedMapProjectionServiceAssembly.mapSnapshot(
                        derived.map(),
                        publishDungeonEditorHandles.execute(map)));
    }

    public DungeonMap loadMap(@Nullable DungeonMapIdentity mapId) {
        if (mapId != null) {
            DungeonMap cached = authoredWorkset.get(mapId.value());
            if (cached != null) {
                return cached;
            }
            Optional<DungeonMap> map = repository.findById(mapId);
            if (map.isPresent()) {
                DungeonMap loaded = map.get();
                authoredWorkset.put(mapId.value(), loaded);
                return loaded;
            }
        }
        DungeonMap fallback = repository.firstMap().orElse(emptyFallbackMap());
        authoredWorkset.putIfAbsent(fallback.metadata().mapId().value(), fallback);
        return fallback;
    }

    public Optional<DungeonMap> findMap(DungeonMapIdentity mapId) {
        return repository.findById(mapId);
    }

    private DungeonMap reloadMap(@Nullable DungeonMapIdentity mapId) {
        DungeonMap loaded = mapId == null
                ? repository.firstMap().orElse(emptyFallbackMap())
                : repository.findById(mapId)
                        .or(repository::firstMap)
                        .orElseGet(DungeonAuthoredApplicationService::emptyFallbackMap);
        authoredWorkset.put(loaded.metadata().mapId().value(), loaded);
        return loaded;
    }

    public DungeonDerivedState derive(DungeonMap dungeonMap) {
        return derivedStateProjection.project(dungeonMap);
    }

    public void applyRoomRectangle(MapId mapId, Cell start, Cell end, boolean deleteMode, Session session) {
        Objects.requireNonNull(start, "start");
        Objects.requireNonNull(end, "end");
        OperationResultData result = mutationPipeline.executeOperation(
                domainMapId(mapId),
                deleteMode ? current -> current.deleteRoomRectangle(start, end)
                        : current -> current.paintRoomRectangle(start, end));
        publicationOperations.publishMutation(result, session.dungeonState());
    }

    public void applyClusterBoundaries(
            MapId mapId,
            long clusterId,
            List<Edge> edges,
            BoundaryKind boundaryKind,
            boolean deleteMode,
            Session session
    ) {
        if (clusterId < MIN_CLUSTER_ID) {
            throw new IllegalArgumentException("clusterId must be non-negative");
        }
        List<Edge> safeEdges = List.copyOf(Objects.requireNonNull(edges, "edges"));
        BoundaryKind safeBoundaryKind = Objects.requireNonNull(boundaryKind, "boundaryKind");
        DungeonEditorCommandOutcome.RejectionReason rejectionReason = !deleteMode
                ? DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT
                : safeBoundaryKind == BoundaryKind.WALL
                        ? DungeonEditorCommandOutcome.RejectionReason.PROTECTED_EXTERIOR_WALL
                        : DungeonEditorCommandOutcome.RejectionReason.REFERENCED_CONNECTION;
        OperationResultData result = mutationPipeline.executeOperation(
                domainMapId(mapId),
                current -> current.editClusterBoundaries(clusterId, safeEdges, safeBoundaryKind, deleteMode),
                rejectionReason);
        publicationOperations.publishMutation(result, session.dungeonState());
    }

    public void applyDoorBoundary(MapId mapId, long clusterId, List<Edge> edges, boolean deleteMode, Session session) {
        applyClusterBoundaries(mapId, clusterId, edges, BoundaryKind.DOOR, deleteMode, session);
    }

    public void applyWallBoundary(MapId mapId, long clusterId, List<Edge> edges, boolean deleteMode, Session session) {
        applyClusterBoundaries(mapId, clusterId, edges, BoundaryKind.WALL, deleteMode, session);
    }

    public void moveClusterHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview, Session session) {
        handleOperations.moveClusterHandle(mapId, preview, session);
    }

    public void moveDoorHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview, Session session) {
        handleOperations.moveDoorHandle(mapId, preview, session);
    }

    public void moveCorridorHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview, Session session) {
        handleOperations.moveCorridorHandle(mapId, preview, session);
    }

    public void moveStairHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview, Session session) {
        handleOperations.moveStairHandle(mapId, preview, session);
    }

    public void stretchClusterBoundary(
            MapId mapId,
            DungeonEditorSessionValues.MoveBoundaryStretchPreview preview,
            Session session
    ) {
        handleOperations.stretchClusterBoundary(mapId, preview, session);
    }

    public void applyPreview(MapId mapId, DungeonEditorSessionValues.Preview preview, Session session) {
        if (preview instanceof DungeonEditorSessionValues.MoveHandlePreview move) {
            moveStairHandle(mapId, move, session);
        }
    }

    public boolean canUndo(MapId mapId) {
        return mapId != null && editHistory.canUndo(domainMapId(mapId));
    }

    public boolean canRedo(MapId mapId) {
        return mapId != null && editHistory.canRedo(domainMapId(mapId));
    }

    public void undo(MapId mapId, Session session) {
        applyHistoryStep(mapId, session, true);
    }

    public void redo(MapId mapId, Session session) {
        applyHistoryStep(mapId, session, false);
    }

    private void applyHistoryStep(MapId mapId, Session session, boolean undo) {
        if (mapId == null || session == null) {
            return;
        }
        DungeonMap current = loadMap(domainMapId(mapId));
        DungeonMap snapshot = undo ? editHistory.undo(current) : editHistory.redo(current);
        if (snapshot.equals(current)) {
            return;
        }
        DungeonMap restored = DungeonMapAuthoring.restoreContent(snapshot, current.revision() + 1L);
        DungeonMap saved;
        try {
            saved = repository.saveChange(new DungeonChangeSet(current, restored));
        } catch (RuntimeException failure) {
            if (undo) {
                editHistory.redo(current);
            } else {
                editHistory.undo(current);
            }
            throw failure;
        }
        authoredWorkset.put(saved.metadata().mapId().value(), saved);
        OperationResultData result = new OperationResultData(
                mutationPipeline.snapshotData(saved, derive(saved)),
                true,
                List.of(),
                List.of(undo ? "undo applied" : "redo applied"),
                DungeonEditorCommandOutcome.accepted(saved.revision()));
        publicationOperations.publishMutation(result, session.dungeonState());
    }

    public void createCorridor(
            MapId mapId,
            DungeonEditorWorkspaceValues.CorridorEndpoint start,
            DungeonEditorWorkspaceValues.CorridorEndpoint end,
            Session session
    ) {
        corridorFeatureOperations.createCorridor(mapId, start, end, session);
    }

    public void deleteCorridor(MapId mapId, CorridorDeletionTarget target, Session session) {
        corridorFeatureOperations.deleteCorridor(mapId, target, session);
    }

    public void createStair(MapId mapId, StairGeometrySpec spec, Session session) {
        stairTransitionOperations.createStair(mapId, spec, session);
    }

    public boolean canCreateStair(MapId mapId, StairGeometrySpec spec, Session session) {
        return stairTransitionOperations.canCreateStair(mapId, spec);
    }

    public boolean deleteStair(MapId mapId, long stairId, Session session) {
        return stairTransitionOperations.deleteStair(mapId, stairId, session);
    }

    public void createTransition(
            MapId mapId,
            TransitionAnchor anchor,
            TransitionDestination destination,
            Session session
    ) {
        stairTransitionOperations.createTransition(mapId, anchor, destination, session);
    }

    public boolean canCreateTransition(
            MapId mapId,
            TransitionAnchor anchor,
            TransitionDestination destination,
            Session session
    ) {
        return stairTransitionOperations.canCreateTransition(mapId, anchor, destination);
    }

    public boolean deleteTransition(MapId mapId, long transitionId, Session session) {
        return stairTransitionOperations.deleteTransition(mapId, transitionId, session);
    }

    public long createFeatureMarker(MapId mapId, FeatureMarkerKind kind, Cell anchor, Session session) {
        return corridorFeatureOperations.createFeatureMarker(mapId, kind, anchor, session);
    }

    public boolean canCreateFeatureMarker(MapId mapId, FeatureMarkerKind kind, Cell anchor, Session session) {
        return corridorFeatureOperations.canCreateFeatureMarker(mapId, kind, anchor);
    }

    public boolean deleteFeatureMarker(MapId mapId, long markerId, Session session) {
        return corridorFeatureOperations.deleteFeatureMarker(mapId, markerId, session);
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    private static MapId mapId(DungeonMapIdentity mapId) {
        return new MapId(mapId.value());
    }

    private static DungeonMap emptyFallbackMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), DEFAULT_MAP_NAME);
    }

    private long stairIdForCorridor(
            DungeonMap current,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end,
            boolean reservePersistentIds
    ) {
        if (start.sameLevelAs(end)) {
            return 0L;
        }
        return reservePersistentIds ? repository.nextStairId() : nextPreviewStairId(current);
    }

    private static long nextPreviewStairId(DungeonMap current) {
        long highestStairId = 0L;
        for (Stair stair : current.stairs().stairs()) {
            highestStairId = Math.max(highestStairId, stair.stairId());
        }
        return highestStairId + 1L;
    }

    private static DungeonCorridorEndpoint corridorEndpoint(
            DungeonEditorWorkspaceValues.CorridorEndpoint endpoint
    ) {
        return switch (endpoint) {
            case DungeonEditorWorkspaceValues.CorridorDoorEndpoint door -> DungeonCorridorEndpoint.door(
                    door.roomId(),
                    door.clusterId(),
                    door.roomCell(),
                    door.direction(),
                    door.topologyRef());
            case DungeonEditorWorkspaceValues.CorridorAnchorEndpoint anchor -> DungeonCorridorEndpoint.anchor(
                    anchor.hostCorridorId(),
                    anchor.anchorCell(),
                    anchor.topologyRef());
            case null -> DungeonCorridorEndpoint.door(
                    0L,
                    0L,
                    new Cell(0, 0, 0),
                    Direction.NORTH,
                    DungeonTopologyRef.empty());
        };
    }

    public record RoomNarrationInput(
            long roomId,
            String visualDescription,
            List<RoomNarrationExitInput> exits
    ) {
        public RoomNarrationInput {
            roomId = Math.max(0L, roomId);
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = safeExits(exits);
        }

        @Override
        public List<RoomNarrationExitInput> exits() {
            return List.copyOf(exits);
        }

        private static List<RoomNarrationExitInput> safeExits(List<RoomNarrationExitInput> exits) {
            if (exits == null || exits.isEmpty()) {
                return List.of();
            }
            return exits.stream()
                    .map(exit -> exit == null ? RoomNarrationExitInput.empty() : exit)
                    .toList();
        }
    }

    public record RoomNarrationExitInput(
            String label,
            int q,
            int r,
            int level,
            String direction,
            String description
    ) {
        public RoomNarrationExitInput {
            label = label == null ? "" : label;
            direction = direction == null ? "" : direction;
            description = description == null ? "" : description;
        }

        static RoomNarrationExitInput empty() {
            return new RoomNarrationExitInput("", 0, 0, 0, "", "");
        }
    }

    public record LabelNameInput(LabelTargetKind targetType, long targetId, String name) {
        public LabelNameInput {
            targetType = targetType == null ? LabelTargetKind.EMPTY : targetType;
            targetId = Math.max(0L, targetId);
            name = name == null ? "" : name.trim();
            if (targetType == LabelTargetKind.EMPTY || targetId == 0L) {
                targetType = LabelTargetKind.EMPTY;
                targetId = 0L;
            }
        }
    }

    public enum LabelTargetKind {
        EMPTY,
        ROOM,
        CLUSTER
    }

    public record TransitionLinkInput(
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        public TransitionLinkInput {
            sourceTransitionId = Math.max(0L, sourceTransitionId);
            targetMapId = Math.max(0L, targetMapId);
            targetTransitionId = Math.max(0L, targetTransitionId);
        }
    }

    public record OperationResult(DungeonEditorCommandOutcome commandOutcome) {
        public OperationResult {
            commandOutcome = commandOutcome == null ? DungeonEditorCommandOutcome.idle() : commandOutcome;
        }

        public static OperationResult fromNullable(Object result) {
            return new OperationResult(result == null
                    ? DungeonEditorCommandOutcome.rejected(
                            DungeonEditorCommandOutcome.RejectionReason.MISSING_TRANSITION_DESTINATION)
                    : DungeonEditorCommandOutcome.accepted(0L));
        }

        public boolean present() {
            return commandOutcome instanceof DungeonEditorCommandOutcome.Accepted;
        }
    }

    public record TransitionDescriptionInput(long transitionId, String description) {
        public TransitionDescriptionInput {
            transitionId = Math.max(0L, transitionId);
            description = description == null ? "" : description;
        }
    }

    public record StairGeometryInput(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        public StairGeometryInput {
            stairId = Math.max(0L, stairId);
            shapeName = shapeName == null ? "" : shapeName.trim().toUpperCase(Locale.ROOT);
            directionName = directionName == null ? "" : directionName.trim().toUpperCase(Locale.ROOT);
            dimension1 = Math.max(0, dimension1);
            dimension2 = Math.max(0, dimension2);
        }
    }

    private final class MutationPipeline {

        private OperationResultData executeOperation(
                @Nullable DungeonMapIdentity mapId,
                @Nullable AuthoredMapMutation operation
        ) {
            return executeOperation(mapId, operation, DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT);
        }

        private OperationResultData executeOperation(
                @Nullable DungeonMapIdentity mapId,
                @Nullable AuthoredMapMutation operation,
                DungeonEditorCommandOutcome.RejectionReason rejectionReason
        ) {
            DungeonMap current = loadMap(mapId);
            DungeonMap operationResult = applyOperation(current, operation);
            boolean changed = !operationResult.equals(current);
            DungeonMap mutated = changed
                    ? DungeonMapAuthoring.committedContent(operationResult, current.revision() + 1L)
                    : current;
            List<String> validationMessages = OPERATION_FEEDBACK_POLICY.validationMessages(current, mutated);
            List<String> reactionMessages = OPERATION_FEEDBACK_POLICY.reactionMessages(current, mutated);
            DungeonDerivedState derived = derive(mutated);
            DungeonMap saved = changed
                    ? repository.saveChange(new DungeonChangeSet(current, mutated))
                    : current;
            authoredWorkset.put(saved.metadata().mapId().value(), saved);
            if (changed) {
                editHistory.record(current, saved);
            }
            DungeonEditorCommandOutcome outcome = changed
                    ? DungeonEditorCommandOutcome.accepted(saved.revision())
                    : DungeonEditorCommandOutcome.rejected(rejectionReason);
            return new OperationResultData(
                    snapshotData(saved, derived), changed, validationMessages, reactionMessages, outcome);
        }

        private OperationResultData previewOperation(
                @Nullable DungeonMapIdentity mapId,
                @Nullable AuthoredMapMutation operation
        ) {
            DungeonMap current = loadMap(mapId);
            DungeonMap mutated = applyOperation(current, operation);
            DungeonDerivedState derived = derive(mutated);
            return new OperationResultData(
                    snapshotData(mutated, derived),
                    !mutated.equals(current),
                    OPERATION_FEEDBACK_POLICY.validationMessages(current, mutated),
                    OPERATION_FEEDBACK_POLICY.reactionMessages(current, mutated),
                    DungeonEditorCommandOutcome.idle());
        }

        private LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshotData(DungeonMap dungeonMap) {
            return assembleDungeonSnapshot.execute(dungeonMap, publishDungeonEditorHandles.execute(dungeonMap));
        }

        private LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshotData(
                DungeonMap dungeonMap,
                DungeonDerivedState derived
        ) {
            return assembleDungeonSnapshot.execute(dungeonMap, derived, publishDungeonEditorHandles.execute(dungeonMap));
        }

        private DungeonMap applyOperation(DungeonMap current, @Nullable AuthoredMapMutation operation) {
            return operation == null ? current : operation.apply(current);
        }
    }

    private final class PublicationOperations {
        private final PublicationAssembler assembler = new PublicationAssembler();

        private void publishSnapshot(
                LoadDungeonSnapshotUseCase.@Nullable DungeonSnapshotData snapshot,
                DungeonEditorDungeonState state
        ) {
            SnapshotPublication publication = snapshotPublication(snapshot);
            state.replaceSnapshot(publication == null ? null : publication.stateFacts());
            if (publication != null) {
                publishedState.publishSnapshot(publication.publishedSnapshot());
            }
        }

        private void publishInspector(
                LoadDungeonSnapshotUseCase.@Nullable InspectorSnapshotData inspector,
                DungeonEditorDungeonState state
        ) {
            InspectorPublication publication = assembler.inspector(inspector);
            state.replaceInspector(publication == null ? null : publication.workspaceInspector());
            if (publication != null) {
                publishedState.publishInspector(publication.publishedInspector());
            }
        }

        private void publishMutation(
                @Nullable OperationResultData mutation,
                DungeonEditorDungeonState state
        ) {
            SnapshotPublication snapshotPublication = snapshotPublication(mutation == null ? null : mutation.snapshot());
            DungeonEditorDungeonState.SnapshotFacts snapshot = snapshotPublication == null
                    ? null
                    : snapshotPublication.stateFacts();
            state.replaceMutation(snapshot == null
                    ? null
                    : new DungeonEditorDungeonState.MutationFacts(snapshot, mutation.commandOutcome()));
            if (mutation != null && snapshotPublication != null) {
                publishedState.publishMutation(new DungeonAuthoredPublication.Mutation(
                        snapshotPublication.publishedSnapshot(),
                        mutation.validationMessages(),
                        mutation.reactionMessages()));
            }
        }

        private @Nullable SnapshotPublication snapshotPublication(
                LoadDungeonSnapshotUseCase.@Nullable DungeonSnapshotData snapshot
        ) {
            if (snapshot == null) {
                return null;
            }
            return assembler.snapshot(
                    snapshot.mapName(),
                    snapshot.derived(),
                    snapshot.editorHandles(),
                    snapshot.revision());
        }

    }

    private final class LoadOperations {

        private LoadDungeonSnapshotUseCase.DungeonSnapshotData loadAuthoredMap(
                MapId mapId,
                DungeonEditorDungeonState state
        ) {
            LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot =
                    mutationPipeline.snapshotData(reloadMap(domainMapId(mapId)));
            publicationOperations.publishSnapshot(snapshot, state);
            return snapshot;
        }

        private LoadDungeonSnapshotUseCase.AuthoredSurfaceData loadAuthoredMapWithSelection(
                MapId mapId,
                DungeonTopologyRef topologyRef,
                long clusterId,
                boolean clusterSelection,
                DungeonEditorDungeonState state
        ) {
            DungeonMap dungeonMap = reloadMap(domainMapId(mapId));
            LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot = mutationPipeline.snapshotData(dungeonMap);
            LoadDungeonSnapshotUseCase.InspectorSnapshotData inspector = inspectDungeonSelection.execute(
                    dungeonMap,
                    snapshot.derived(),
                    topologyRef,
                    clusterId,
                    clusterSelection);
            publicationOperations.publishSnapshot(snapshot, state);
            publicationOperations.publishInspector(inspector, state);
            return new LoadDungeonSnapshotUseCase.AuthoredSurfaceData(snapshot, inspector);
        }
    }

    private final class CorridorFeatureOperations {

        private void createCorridor(
                MapId mapId,
                DungeonEditorWorkspaceValues.CorridorEndpoint start,
                DungeonEditorWorkspaceValues.CorridorEndpoint end,
                Session session
        ) {
            DungeonCorridorEndpoint startEndpoint = corridorEndpoint(start);
            DungeonCorridorEndpoint endEndpoint = corridorEndpoint(end);
            OperationResultData result = mutationPipeline.executeOperation(
                    domainMapId(mapId),
                    current -> current.createCorridor(
                            stairIdForCorridor(current, startEndpoint, endEndpoint, true),
                            startEndpoint,
                            endEndpoint),
                    DungeonEditorCommandOutcome.RejectionReason.BLOCKED_ROUTE);
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private void deleteCorridor(MapId mapId, CorridorDeletionTarget target, Session session) {
            OperationResultData result = mutationPipeline.executeOperation(
                    domainMapId(mapId),
                    current -> CORRIDOR_AUTHORING.deleteCorridor(current, target),
                    DungeonEditorCommandOutcome.RejectionReason.BLOCKED_ROUTE);
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private long createFeatureMarker(MapId mapId, FeatureMarkerKind kind, Cell anchor, Session session) {
            Objects.requireNonNull(mapId, "mapId");
            Objects.requireNonNull(kind, "kind");
            Objects.requireNonNull(anchor, "anchor");
            DungeonMap currentMap = loadMap(domainMapId(mapId));
            long markerId = currentMap.nextFeatureMarkerId();
            OperationResultData result = mutationPipeline.executeOperation(
                    domainMapId(mapId),
                    current -> current.withFeatureMarkers(current.featureMarkers().withCreated(
                            markerId,
                            current.metadata().mapId(),
                            kind,
                            anchor,
                            DEFAULT_LABEL,
                            DEFAULT_DESCRIPTION)));
            publicationOperations.publishMutation(result, session.dungeonState());
            return markerId;
        }

        private boolean canCreateFeatureMarker(MapId mapId, FeatureMarkerKind kind, Cell anchor) {
            return mapId != null && kind != null && anchor != null;
        }

        private boolean deleteFeatureMarker(MapId mapId, long markerId, Session session) {
            if (mapId == null || markerId <= 0L) {
                return false;
            }
            DungeonMapIdentity mapIdentity = domainMapId(mapId);
            DungeonMap currentMap = loadMap(mapIdentity);
            if (!currentMap.canDeleteFeatureMarker(markerId)) {
                return false;
            }
            OperationResultData result =
                    mutationPipeline.executeOperation(mapIdentity, current -> current.deleteFeatureMarker(markerId));
            publicationOperations.publishMutation(result, session.dungeonState());
            return true;
        }
    }

    private final class StairTransitionOperations {

        private void createStair(MapId mapId, StairGeometrySpec spec, Session session) {
            Objects.requireNonNull(mapId, "mapId");
            Objects.requireNonNull(spec, "spec");
            long stairId = repository.nextStairId();
            OperationResultData result = mutationPipeline.executeOperation(
                    domainMapId(mapId),
                    current -> current.createStair(stairId, spec),
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_STAIR_GEOMETRY);
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private boolean canCreateStair(MapId mapId, StairGeometrySpec spec) {
            return mapId != null && spec != null && loadMap(domainMapId(mapId)).canCreateStair(spec);
        }

        private boolean deleteStair(MapId mapId, long stairId, Session session) {
            if (mapId == null || stairId <= 0L) {
                return false;
            }
            DungeonMapIdentity mapIdentity = domainMapId(mapId);
            if (!loadMap(mapIdentity).canDeleteStair(stairId)) {
                return false;
            }
            OperationResultData result =
                    mutationPipeline.executeOperation(
                            mapIdentity,
                            current -> current.deleteStair(stairId),
                            DungeonEditorCommandOutcome.RejectionReason.REFERENCED_CONNECTION);
            publicationOperations.publishMutation(result, session.dungeonState());
            return true;
        }

        private void createTransition(
                MapId mapId,
                TransitionAnchor anchor,
                TransitionDestination destination,
                Session session
        ) {
            Objects.requireNonNull(mapId, "mapId");
            Objects.requireNonNull(anchor, "anchor");
            Objects.requireNonNull(destination, "destination");
            long transitionId = repository.nextTransitionId();
            OperationResultData result = mutationPipeline.executeOperation(
                    domainMapId(mapId),
                    current -> current.withTransitionCatalog(current.transitionCatalog().withCreated(
                            transitionId,
                            current.metadata().mapId().value(),
                            anchor,
                            destination)),
                    DungeonEditorCommandOutcome.RejectionReason.MISSING_TRANSITION_DESTINATION);
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private boolean canCreateTransition(
                MapId mapId,
                TransitionAnchor anchor,
                TransitionDestination destination
        ) {
            return mapId != null
                    && anchor != null
                    && destination != null
                    && loadMap(domainMapId(mapId)).transitionCatalog().canCreate(anchor, destination);
        }

        private boolean deleteTransition(MapId mapId, long transitionId, Session session) {
            if (mapId == null || transitionId <= 0L) {
                return false;
            }
            DungeonMapIdentity mapIdentity = domainMapId(mapId);
            if (!loadMap(mapIdentity).canDeleteTransition(transitionId)) {
                return false;
            }
            OperationResultData result =
                    mutationPipeline.executeOperation(
                            mapIdentity,
                            current -> current.deleteTransition(transitionId),
                            DungeonEditorCommandOutcome.RejectionReason.REFERENCED_CONNECTION);
            publicationOperations.publishMutation(result, session.dungeonState());
            return true;
        }
    }

    private final class HandleOperations {

        private void moveClusterHandle(
                MapId mapId,
                DungeonEditorSessionValues.MoveHandlePreview preview,
                Session session
        ) {
            DungeonEditorSessionValues.MoveHandlePreview safePreview =
                    Objects.requireNonNull(preview, PREVIEW_ARGUMENT);
            DungeonEditorWorkspaceValues.HandleRef handleRef = safePreview.handleRef();
            if (!DungeonEditorSessionPreviewHelper.directClusterMoveCommitHandle(handleRef.kind())) {
                return;
            }
            OperationResultData result = applyHandleMovement(domainMapId(mapId), handleRef, safePreview);
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private void moveDoorHandle(
                MapId mapId,
                DungeonEditorSessionValues.MoveHandlePreview preview,
                Session session
        ) {
            DungeonEditorSessionValues.MoveHandlePreview safePreview =
                    Objects.requireNonNull(preview, PREVIEW_ARGUMENT);
            DungeonEditorWorkspaceValues.HandleRef handleRef = safePreview.handleRef();
            if (handleRef.kind() != DungeonEditorHandleKind.DOOR) {
                return;
            }
            OperationResultData result = mutationPipeline.executeOperation(
                    domainMapId(mapId),
                    current -> {
                        if (stationary(safePreview)) {
                            return current;
                        }
                        if (handleRef.corridorId() > ABSENT_ID) {
                            return current.moveDoorBinding(
                                    handleRef.corridorId(),
                                    Math.max(0, handleRef.index()),
                                    Math.max(0L, handleRef.roomId()),
                                    safePreview.deltaQ(),
                                    safePreview.deltaR(),
                                    safePreview.deltaLevel());
                        }
                        DungeonTopologyRef topologyRef = handleRef.topologyRef() == null
                                ? DungeonTopologyRef.empty()
                                : handleRef.topologyRef();
                        return current.moveDoorBoundary(
                                topologyRef,
                                handleRef.clusterId() > 0L
                                        ? handleRef.clusterId()
                                        : current.clusterIdForTopologyRef(topologyRef),
                                Math.max(0L, handleRef.roomId()),
                                sourceEdge(handleRef),
                                safePreview.deltaQ(),
                                safePreview.deltaR(),
                            safePreview.deltaLevel());
                    });
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private void moveCorridorHandle(
                MapId mapId,
                DungeonEditorSessionValues.MoveHandlePreview preview,
                Session session
        ) {
            DungeonEditorSessionValues.MoveHandlePreview safePreview =
                    Objects.requireNonNull(preview, PREVIEW_ARGUMENT);
            DungeonEditorWorkspaceValues.HandleRef handleRef = safePreview.handleRef();
            OperationResultData result;
            if (handleRef.kind() == DungeonEditorHandleKind.CORRIDOR_ANCHOR) {
                result = mutationPipeline.executeOperation(
                        domainMapId(mapId),
                        current -> stationary(safePreview)
                                ? current
                                : current.moveCorridorAnchor(
                                        Math.max(0L, handleRef.corridorId()),
                                        Math.max(0, handleRef.index()),
                                        handleRef.topologyRef() == null
                                                ? DungeonTopologyRef.empty()
                                                : handleRef.topologyRef(),
                                        safePreview.deltaQ(),
                                        safePreview.deltaR(),
                                        safePreview.deltaLevel()));
            } else if (handleRef.kind() == DungeonEditorHandleKind.CORRIDOR_WAYPOINT) {
                result = mutationPipeline.executeOperation(
                        domainMapId(mapId),
                        current -> stationary(safePreview)
                                ? current
                                : current.moveCorridorWaypoint(
                                        Math.max(0L, handleRef.corridorId()),
                                        Math.max(0, handleRef.index()),
                                        safePreview.deltaQ(),
                                        safePreview.deltaR(),
                                        safePreview.deltaLevel()));
            } else {
                return;
            }
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private void moveStairHandle(
                MapId mapId,
                DungeonEditorSessionValues.MoveHandlePreview preview,
                Session session
        ) {
            DungeonEditorSessionValues.MoveHandlePreview safePreview =
                    Objects.requireNonNull(preview, PREVIEW_ARGUMENT);
            DungeonEditorWorkspaceValues.HandleRef handleRef = safePreview.handleRef();
            if (handleRef.kind() != DungeonEditorHandleKind.STAIR_ANCHOR) {
                return;
            }
            OperationResultData result = applyHandleMovement(domainMapId(mapId), handleRef, safePreview);
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private void stretchClusterBoundary(
                MapId mapId,
                DungeonEditorSessionValues.MoveBoundaryStretchPreview preview,
                Session session
        ) {
            DungeonEditorSessionValues.MoveBoundaryStretchPreview safePreview =
                    Objects.requireNonNull(preview, PREVIEW_ARGUMENT);
            OperationResultData result = mutationPipeline.executeOperation(
                    domainMapId(mapId),
                    current -> current.moveBoundaryStretch(
                            safePreview.clusterId(),
                            DungeonEditorWorkspaceGeometry.unitEdges(safePreview.sourceEdges()),
                            safePreview.deltaQ(),
                            safePreview.deltaR(),
                            safePreview.deltaLevel()));
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private OperationResultData applyHandleMovement(
                DungeonMapIdentity mapId,
                DungeonEditorWorkspaceValues.HandleRef handleRef,
                DungeonEditorSessionValues.MoveHandlePreview preview
        ) {
            return mutationPipeline.executeOperation(
                    mapId,
                    current -> HANDLE_MUTATION.apply(
                            current,
                            DungeonEditorWorkspaceHandleMovement.from(handleRef),
                            preview.deltaQ(),
                            preview.deltaR(),
                            preview.deltaLevel()));
        }

        private Edge sourceEdge(DungeonEditorWorkspaceValues.HandleRef handleRef) {
            if (handleRef.sourceEdge() != null) {
                return handleRef.sourceEdge();
            }
            Cell cell = handleRef.cell();
            return handleRef.direction().edgeOf(cell);
        }

        private boolean stationary(DungeonEditorSessionValues.MoveHandlePreview preview) {
            return preview.deltaQ() == 0 && preview.deltaR() == 0 && preview.deltaLevel() == 0;
        }
    }

    private final class CatalogOperations {
        private final Comparator<MapSummaryData> mapSummaryOrder = (left, right) -> {
            int nameComparison = Comparator.nullsFirst(String.CASE_INSENSITIVE_ORDER)
                    .compare(left.mapName(), right.mapName());
            return nameComparison == 0
                    ? Long.compare(left.mapId().value(), right.mapId().value())
                    : nameComparison;
        };

        private void searchMaps(String query, DungeonEditorDungeonState state) {
            CatalogResult catalog = searchCatalog(query);
            state.replaceCatalog(catalogFacts(catalog));
            publishedState.publishSearch(catalogPublication(catalog));
        }

        private DungeonMapIdentity createMapCatalog(String mapName, DungeonEditorDungeonState state) {
            DungeonMapIdentity mapId = createMap(mapName);
            state.replaceMutationMapId(mapId(mapId));
            publishedState.publishCreated(new DungeonAuthoredPublication.MapMutation(mapId));
            return mapId;
        }

        private DungeonMapIdentity renameMapCatalog(MapId mapId, String mapName, DungeonEditorDungeonState state) {
            DungeonMapIdentity mutationMapId = renameMap(domainMapId(mapId), mapName);
            state.replaceMutationMapId(mapId(mutationMapId));
            publishedState.publishRenamed(new DungeonAuthoredPublication.MapMutation(mutationMapId));
            return mutationMapId;
        }

        private DungeonMapIdentity deleteMapCatalog(MapId mapId, DungeonEditorDungeonState state) {
            DungeonMapIdentity deletedMapId = deleteMap(domainMapId(mapId));
            CatalogResult catalog = searchCatalog("");
            MapId firstMapId = catalog.maps().isEmpty()
                    ? null
                    : mapId(catalog.maps().stream().min(mapSummaryOrder).orElseThrow().mapId());
            state.replaceCatalog(catalogFacts(catalog));
            state.replaceMutationMapId(firstMapId);
            publishedState.publishDeleted(new DungeonAuthoredPublication.MapMutation(deletedMapId));
            publishedState.publishSearch(catalogPublication(catalog));
            return deletedMapId;
        }

        private DungeonMapIdentity createMap(String requestedMapName) {
            DungeonMapIdentity mapIdentity = repository.nextMapId();
            String mapName = requestedMapName == null || requestedMapName.isBlank()
                    ? DEFAULT_MAP_NAME
                    : requestedMapName;
            DungeonMap dungeonMap = DungeonMapAuthoring.empty(mapIdentity, mapName);
            DungeonMap saved = repository.save(dungeonMap);
            authoredWorkset.put(saved.metadata().mapId().value(), saved);
            return saved.metadata().mapId();
        }

        private DungeonMapIdentity renameMap(DungeonMapIdentity mapIdentity, String requestedMapName) {
            DungeonMap foundMap = loadMap(mapIdentity);
            if (!foundMap.metadata().mapId().equals(mapIdentity)) {
                throw new IllegalArgumentException("Unknown dungeon map: " + mapIdentity.value());
            }
            String mapName = requestedMapName == null || requestedMapName.isBlank()
                    ? DEFAULT_MAP_NAME
                    : requestedMapName;
            DungeonMap renamed = repository.saveChange(new DungeonChangeSet(
                    foundMap,
                    DungeonMapAuthoring.rename(foundMap, mapName)));
            authoredWorkset.put(renamed.metadata().mapId().value(), renamed);
            return renamed.metadata().mapId();
        }

        private DungeonMapIdentity deleteMap(DungeonMapIdentity mapIdentity) {
            repository.delete(mapIdentity);
            authoredWorkset.remove(mapIdentity.value());
            editHistory.remove(mapIdentity);
            return mapIdentity;
        }

        private CatalogResult searchCatalog(String query) {
            String effectiveQuery = query == null ? "" : query;
            List<MapSummaryData> summaries = new ArrayList<>();
            for (DungeonMap map : repository.searchByName(effectiveQuery)) {
                summaries.add(new MapSummaryData(
                        map.metadata().mapId(),
                        map.metadata().mapName(),
                        map.revision()));
            }
            summaries.sort(mapSummaryOrder);
            return new CatalogResult(summaries);
        }

        private DungeonAuthoredPublication.Catalog catalogPublication(CatalogResult catalog) {
            List<DungeonAuthoredPublication.MapSummary> maps = new ArrayList<>();
            for (MapSummaryData map : catalog.maps()) {
                maps.add(new DungeonAuthoredPublication.MapSummary(map.mapId(), map.mapName(), map.revision()));
            }
            return new DungeonAuthoredPublication.Catalog(maps);
        }

        private List<DungeonEditorWorkspaceValues.MapSummary> catalogFacts(CatalogResult catalog) {
            List<DungeonEditorWorkspaceValues.MapSummary> result = new ArrayList<>();
            for (MapSummaryData map : catalog.maps()) {
                result.add(new DungeonEditorWorkspaceValues.MapSummary(
                        mapId(map.mapId()),
                        map.mapName(),
                        map.revision()));
            }
            return List.copyOf(result);
        }

        private record CatalogResult(List<MapSummaryData> maps) {
            CatalogResult {
                maps = maps == null ? List.of() : List.copyOf(maps);
            }

            @Override
            public List<MapSummaryData> maps() {
                return List.copyOf(maps);
            }
        }

        private record MapSummaryData(DungeonMapIdentity mapId, String mapName, long revision) {
        }
    }

    private final class TransitionLinkOperations {

        private @Nullable OperationResultData transitionLinkOperation(
                @Nullable DungeonMapIdentity sourceMapId,
                long sourceTransitionId,
                @Nullable DungeonMapIdentity targetMapId,
                long targetTransitionId,
                boolean bidirectional
        ) {
            LoadedTransitionLink loaded = loadTransitionLink(
                    sourceMapId,
                    sourceTransitionId,
                    targetMapId,
                    targetTransitionId);
            if (loaded == null) {
                return null;
            }
            Map<Long, DungeonMap> pendingMaps = loadedMaps(loaded.sourceMap(), loaded.targetMap());
            AuthoredTransitionLinkRewrite rewrite = transitionLinkRewrite(
                    pendingMaps,
                    loaded.sourceIdentity().value(),
                    sourceTransitionId,
                    loaded.targetIdentity().value(),
                    targetTransitionId,
                    bidirectional);
            OptionalLong requestedMapId = rewrite.requestedMapId();
            if (requestedMapId.isPresent()) {
                long mapId = requestedMapId.orElseThrow();
                Optional<DungeonMap> requiredMap = repository.findById(new DungeonMapIdentity(mapId));
                if (requiredMap.isPresent()) {
                    pendingMaps.put(mapId, requiredMap.orElseThrow());
                    rewrite = transitionLinkRewrite(
                            pendingMaps,
                            loaded.sourceIdentity().value(),
                            sourceTransitionId,
                            loaded.targetIdentity().value(),
                            targetTransitionId,
                            bidirectional);
                } else {
                    rewrite = rewrite.acceptMissingRequestedMap();
                }
            }
            if (!rewrite.accepted()) {
                return null;
            }
            applyCatalogUpdates(pendingMaps, rewrite);
            List<DungeonMap> savedMaps = repository.saveAll(List.copyOf(pendingMaps.values()));
            for (DungeonMap savedMap : savedMaps) {
                authoredWorkset.put(savedMap.metadata().mapId().value(), savedMap);
            }
            DungeonMap savedSourceMap = savedSourceMap(savedMaps, loaded.sourceIdentity().value());
            DungeonDerivedState derived = derive(savedSourceMap);
            return new OperationResultData(
                    mutationPipeline.snapshotData(savedSourceMap, derived),
                    true,
                    List.of(),
                    List.of("transition link saved"),
                    DungeonEditorCommandOutcome.accepted(savedSourceMap.revision()));
        }

        private @Nullable LoadedTransitionLink loadTransitionLink(
                @Nullable DungeonMapIdentity sourceMapId,
                long sourceTransitionId,
                @Nullable DungeonMapIdentity targetMapId,
                long targetTransitionId
        ) {
            if (sourceMapId == null || targetMapId == null || sourceTransitionId <= 0L || targetTransitionId <= 0L) {
                return null;
            }
            DungeonMap sourceMap = repository.findById(sourceMapId).orElse(null);
            DungeonMap targetMap = repository.findById(targetMapId).orElse(null);
            if (sourceMap == null || targetMap == null) {
                return null;
            }
            return new LoadedTransitionLink(sourceMapId, targetMapId, sourceMap, targetMap);
        }

        private Map<Long, DungeonMap> loadedMaps(DungeonMap sourceMap, DungeonMap targetMap) {
            Map<Long, DungeonMap> pendingMaps = new LinkedHashMap<>();
            pendingMaps.put(sourceMap.metadata().mapId().value(), sourceMap);
            pendingMaps.put(targetMap.metadata().mapId().value(), targetMap);
            return pendingMaps;
        }

        private AuthoredTransitionLinkRewrite transitionLinkRewrite(
                Map<Long, DungeonMap> pendingMaps,
                long sourceMapId,
                long sourceTransitionId,
                long targetMapId,
                long targetTransitionId,
                boolean bidirectional
        ) {
            List<AuthoredTransitionLinkMap> loadedCatalogs = new ArrayList<>();
            for (DungeonMap map : pendingMaps.values()) {
                loadedCatalogs.add(new AuthoredTransitionLinkMap(
                        map.metadata().mapId().value(),
                        map.transitionCatalog()));
            }
            return TransitionCatalog.authoredTransitionLinkRewrite(
                    loadedCatalogs,
                    sourceMapId,
                    sourceTransitionId,
                    targetMapId,
                    targetTransitionId,
                    bidirectional);
        }

        private void applyCatalogUpdates(
                Map<Long, DungeonMap> pendingMaps,
                AuthoredTransitionLinkRewrite rewrite
        ) {
            for (Map.Entry<Long, DungeonMap> entry : pendingMaps.entrySet()) {
                DungeonMap map = entry.getValue();
                TransitionCatalog nextCatalog = rewrite.catalogFor(entry.getKey(), map.transitionCatalog());
                entry.setValue(map.withTransitionCatalog(nextCatalog));
            }
        }

        private DungeonMap savedSourceMap(List<DungeonMap> savedMaps, long sourceMapId) {
            for (DungeonMap map : savedMaps) {
                if (map.metadata().mapId().value() == sourceMapId) {
                    return map;
                }
            }
            throw new IllegalStateException("Atomic transition link save did not return the source map.");
        }

        private record LoadedTransitionLink(
                DungeonMapIdentity sourceIdentity,
                DungeonMapIdentity targetIdentity,
                DungeonMap sourceMap,
                DungeonMap targetMap
        ) {
        }
    }

    private final class DetailSaveOperations {

        private void saveAuthoredRoomNarration(
                MapId mapId,
                DungeonEditorRoomNarrationInput roomNarration,
                DungeonEditorDungeonState state
        ) {
            if (roomNarration == null || !DungeonEditorWorkspaceValues.hasId(roomNarration.roomId())) {
                return;
            }
            OperationResultData result = mutationPipeline.executeOperation(
                    domainMapId(mapId),
                    current -> current.saveRoomNarration(
                            roomNarration.roomId(),
                            DungeonEditorAuthoredOperationHelper.roomNarration(roomNarration)));
            publicationOperations.publishMutation(result, state);
        }

        private void saveAuthoredLabelName(
                MapId mapId,
                LabelTargetKind targetType,
                long targetId,
                String name,
                DungeonEditorDungeonState state
        ) {
            if (targetId <= 0L || name == null || name.isBlank()) {
                return;
            }
            LabelTargetKind safeTargetType = targetType == null ? LabelTargetKind.EMPTY : targetType;
            String trimmedName = name.trim();
            OperationResultData result = mutationPipeline.executeOperation(
                    domainMapId(mapId),
                    current -> switch (safeTargetType) {
                        case CLUSTER -> current.saveClusterName(targetId, trimmedName);
                        case ROOM -> current.saveRoomName(targetId, trimmedName);
                        case EMPTY -> current;
                    });
            publicationOperations.publishMutation(result, state);
        }

        private void saveAuthoredTransitionDescription(
                MapId mapId,
                long transitionId,
                String description,
                DungeonEditorDungeonState state
        ) {
            if (mapId == null || transitionId <= 0L) {
                return;
            }
            OperationResultData result = mutationPipeline.executeOperation(
                    domainMapId(mapId),
                    current -> current.saveTransitionDescription(transitionId, description));
            publicationOperations.publishMutation(result, state);
        }

        private boolean saveAuthoredTransitionLink(
                MapId sourceMapId,
                long sourceTransitionId,
                long targetMapId,
                long targetTransitionId,
                boolean bidirectional,
                DungeonEditorDungeonState state
        ) {
            if (sourceMapId == null || sourceTransitionId <= 0L || targetMapId <= 0L || targetTransitionId <= 0L) {
                return false;
            }
            OperationResultData result = transitionLinkOperations.transitionLinkOperation(
                    new DungeonMapIdentity(sourceMapId.value()),
                    sourceTransitionId,
                    new DungeonMapIdentity(targetMapId),
                    targetTransitionId,
                    bidirectional);
            if (result == null) {
                return false;
            }
            publicationOperations.publishMutation(result, state);
            return true;
        }

        private void saveAuthoredStairGeometry(
                MapId mapId,
                long stairId,
                StairGeometrySpec spec,
                DungeonEditorDungeonState state
        ) {
            if (mapId == null || stairId <= 0L || spec == null) {
                return;
            }
            OperationResultData result = mutationPipeline.executeOperation(
                    domainMapId(mapId),
                    current -> current.saveStairGeometry(stairId, spec),
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_STAIR_GEOMETRY);
            publicationOperations.publishMutation(result, state);
        }

        private boolean canSaveStairGeometry(
                MapId mapId,
                long stairId,
                StairGeometrySpec spec
        ) {
            return mapId != null
                    && stairId > 0L
                    && spec != null
                    && loadMap(domainMapId(mapId)).canSaveStairGeometry(stairId, spec);
        }

        private @Nullable StairGeometrySpec stairGeometrySpec(
                MapId mapId,
                long stairId,
                StairShape shape,
                Direction direction,
                int dimension1,
                int dimension2
        ) {
            if (mapId == null || stairId <= 0L || shape == null || direction == null
                    || dimension1 <= 0 || dimension2 <= 0) {
                return null;
            }
            Cell anchor = loadMap(domainMapId(mapId)).stairs().anchorOf(stairId);
            return anchor == null ? null : new StairGeometrySpec(shape, anchor, direction, dimension1, dimension2);
        }
    }

    private final class PreviewOperations {

        private boolean executeAuthoredDragPreview(
                MapId mapId,
                DungeonEditorSessionValues.Preview preview,
                DungeonEditorDungeonState state
        ) {
            if (!(preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview
                    || preview instanceof DungeonEditorSessionValues.MoveHandlePreview move
                    && DungeonEditorSessionPreviewHelper.directClusterMoveCommitHandle(move.handleRef().kind()))) {
                return false;
            }
            executePreview(mapId, preview, state);
            return true;
        }

        private void executeInMemoryPreview(
                DungeonEditorSessionSnapshot.SurfaceData surface,
                DungeonEditorSessionValues.Preview preview,
                DungeonEditorDungeonState state
        ) {
            state.replacePreview(surfaceMovePreviewUseCase.execute(surface, preview));
        }

        private void executePreview(
                MapId mapId,
                DungeonEditorSessionValues.Preview preview,
                DungeonEditorDungeonState state
        ) {
            state.replacePreview(previewFacts(dispatchPreview(mapId, preview)));
        }

        private DungeonEditorDungeonState.@Nullable PreviewFacts previewFacts(
                @Nullable OperationResultData preview
        ) {
            SnapshotPublication publication =
                    publicationOperations.snapshotPublication(preview == null ? null : preview.snapshot());
            if (publication == null) {
                return null;
            }
            String status = "";
            if (preview != null && !preview.reactionMessages().isEmpty()) {
                status = preview.reactionMessages().getFirst();
            } else if (preview != null && !preview.validationMessages().isEmpty()) {
                status = preview.validationMessages().getFirst();
            }
            return new DungeonEditorDungeonState.PreviewFacts(publication.stateFacts(), status);
        }

        private @Nullable OperationResultData dispatchPreview(
                @Nullable MapId mapId,
                DungeonEditorSessionValues.Preview preview
        ) {
            if (mapId == null) {
                return null;
            }
            DungeonMapIdentity domainMapId = new DungeonMapIdentity(mapId.value());
            if (preview instanceof DungeonEditorSessionValues.StairCreatePreview stair) {
                return stairPreview(domainMapId, stair);
            }
            OperationResultData roomWallPreview = roomWallPreview(domainMapId, preview);
            if (roomWallPreview != null) {
                return roomWallPreview;
            }
            OperationResultData corridorPreview = corridorPreview(domainMapId, preview);
            if (corridorPreview != null) {
                return corridorPreview;
            }
            return movePreview(domainMapId, preview);
        }

        private @Nullable OperationResultData roomWallPreview(
                DungeonMapIdentity domainMapId,
                DungeonEditorSessionValues.Preview preview
        ) {
            if (preview instanceof DungeonEditorSessionValues.RoomRectanglePreview room) {
                return mutationPipeline.previewOperation(
                        domainMapId,
                        room.deleteMode()
                                ? current -> current.deleteRoomRectangle(
                                        room.start(),
                                        room.end())
                                : current -> current.paintRoomRectangle(
                                        room.start(),
                                        room.end()));
            }
            if (preview instanceof DungeonEditorSessionValues.ClusterBoundariesPreview boundaries
                    && !boundaries.boundaryKind().isDoor()) {
                return mutationPipeline.previewOperation(
                        domainMapId,
                        current -> current.editClusterBoundaries(
                                boundaries.clusterId(),
                                DungeonEditorWorkspaceGeometry.unitEdges(boundaries.edges()),
                                boundaries.boundaryKind(),
                                boundaries.deleteMode()));
            }
            return null;
        }

        private @Nullable OperationResultData corridorPreview(
                DungeonMapIdentity domainMapId,
                DungeonEditorSessionValues.Preview preview
        ) {
            if (preview instanceof DungeonEditorSessionValues.CorridorCreatePreview corridor) {
                DungeonCorridorEndpoint startEndpoint = corridorEndpoint(corridor.start());
                DungeonCorridorEndpoint endEndpoint = corridorEndpoint(corridor.end());
                return mutationPipeline.previewOperation(
                        domainMapId,
                        current -> current.createCorridor(
                                stairIdForCorridor(current, startEndpoint, endEndpoint, false),
                                startEndpoint,
                                endEndpoint));
            }
            if (preview instanceof DungeonEditorSessionValues.DeleteCorridorPreview corridor) {
                return mutationPipeline.previewOperation(
                        domainMapId,
                        current -> CORRIDOR_AUTHORING.deleteCorridor(current, corridor.target()));
            }
            return null;
        }

        private @Nullable OperationResultData movePreview(
                DungeonMapIdentity domainMapId,
                DungeonEditorSessionValues.Preview preview
        ) {
            if (preview instanceof DungeonEditorSessionValues.MoveHandlePreview move
                    && (move.handleRef().kind() == DungeonEditorHandleKind.STAIR_ANCHOR
                    || DungeonEditorSessionPreviewHelper.directClusterMoveCommitHandle(move.handleRef().kind()))) {
                return mutationPipeline.previewOperation(
                        domainMapId,
                        current -> HANDLE_MUTATION.apply(
                                current,
                                DungeonEditorWorkspaceHandleMovement.from(move.handleRef()),
                                move.deltaQ(),
                                move.deltaR(),
                                move.deltaLevel()));
            }
            if (preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch) {
                return mutationPipeline.previewOperation(
                        domainMapId,
                        current -> current.moveBoundaryStretch(
                                stretch.clusterId(),
                                DungeonEditorWorkspaceGeometry.unitEdges(stretch.sourceEdges()),
                                stretch.deltaQ(),
                                stretch.deltaR(),
                                stretch.deltaLevel()));
            }
            return null;
        }

        private @Nullable OperationResultData stairPreview(
                DungeonMapIdentity domainMapId,
                DungeonEditorSessionValues.StairCreatePreview stair
        ) {
            StairShape shape = StairShape.supportedEditorShape(stair.shapeName());
            Direction direction = Direction.supportedCardinal(stair.directionName());
            StairGeometrySpec spec = shape == null || direction == null
                    ? null
                    : new StairGeometrySpec(
                            shape,
                            stair.specAnchor(),
                            direction,
                            stair.dimension1(),
                            stair.dimension2());
            if (spec == null || !stair.valid()) {
                return null;
            }
            return mutationPipeline.previewOperation(
                    domainMapId,
                    current -> current.createStair(PREVIEW_STAIR_ID, spec));
        }
    }

    public static final class Session {
        private final CatalogOperations catalogOperations;
        private final LoadOperations loadOperations;
        private final PreviewOperations previewOperations;
        private final DetailSaveOperations detailSaveOperations;
        private final DungeonEditorDungeonState dungeonState;

        private Session(
                CatalogOperations catalogOperations,
                LoadOperations loadOperations,
                PreviewOperations previewOperations,
                DetailSaveOperations detailSaveOperations,
                DungeonEditorDungeonState dungeonState
        ) {
            this.catalogOperations = Objects.requireNonNull(catalogOperations, "catalogOperations");
            this.loadOperations = Objects.requireNonNull(loadOperations, "loadOperations");
            this.previewOperations = Objects.requireNonNull(previewOperations, "previewOperations");
            this.detailSaveOperations = Objects.requireNonNull(detailSaveOperations, "detailSaveOperations");
            this.dungeonState = Objects.requireNonNull(dungeonState, "dungeonState");
        }

        private DungeonEditorDungeonState dungeonState() {
            return dungeonState;
        }

        public void createMapCatalog(String mapName) {
            catalogOperations.createMapCatalog(mapName, dungeonState);
        }

        public void renameMapCatalog(MapId mapId, String mapName) {
            catalogOperations.renameMapCatalog(mapId, mapName, dungeonState);
        }

        public void deleteMapCatalog(MapId mapId) {
            catalogOperations.deleteMapCatalog(mapId, dungeonState);
        }

        public void saveAuthoredRoomNarration(MapId mapId, DungeonEditorRoomNarrationInput roomNarration) {
            detailSaveOperations.saveAuthoredRoomNarration(mapId, roomNarration, dungeonState);
        }

        public void saveAuthoredLabelName(MapId mapId, LabelTargetKind targetType, long targetId, String name) {
            detailSaveOperations.saveAuthoredLabelName(mapId, targetType, targetId, name, dungeonState);
        }

        public void saveAuthoredTransitionDescription(MapId mapId, long transitionId, String description) {
            detailSaveOperations.saveAuthoredTransitionDescription(mapId, transitionId, description, dungeonState);
        }

        public boolean saveAuthoredTransitionLink(
                MapId sourceMapId,
                long sourceTransitionId,
                long targetMapId,
                long targetTransitionId,
                boolean bidirectional
        ) {
            return detailSaveOperations.saveAuthoredTransitionLink(
                    sourceMapId,
                    sourceTransitionId,
                    targetMapId,
                    targetTransitionId,
                    bidirectional,
                    dungeonState);
        }

        public void saveAuthoredStairGeometry(MapId mapId, long stairId, StairGeometrySpec spec) {
            detailSaveOperations.saveAuthoredStairGeometry(mapId, stairId, spec, dungeonState);
        }

        public boolean canSaveStairGeometry(MapId mapId, long stairId, StairGeometrySpec spec) {
            return detailSaveOperations.canSaveStairGeometry(mapId, stairId, spec);
        }

        public @Nullable StairGeometrySpec stairGeometrySpec(
                MapId mapId,
                long stairId,
                StairShape shape,
                Direction direction,
                int dimension1,
                int dimension2
        ) {
            return detailSaveOperations.stairGeometrySpec(
                    mapId,
                    stairId,
                    shape,
                    direction,
                    dimension1,
                    dimension2);
        }

        public void searchMaps(String query) {
            catalogOperations.searchMaps(query, dungeonState);
        }

        public void loadMap(MapId mapId) {
            loadOperations.loadAuthoredMap(mapId, dungeonState);
        }

        public void loadMapWithSelection(
                MapId mapId,
                DungeonTopologyRef topologyRef,
                long clusterId,
                boolean clusterSelection
        ) {
            loadOperations.loadAuthoredMapWithSelection(
                    mapId,
                    topologyRef,
                    clusterId,
                    clusterSelection,
                    dungeonState);
        }

        public boolean executeAuthoredDragPreview(MapId mapId, DungeonEditorSessionValues.Preview preview) {
            return previewOperations.executeAuthoredDragPreview(mapId, preview, dungeonState);
        }

        public void executeInMemoryPreview(
                DungeonEditorSessionSnapshot.SurfaceData surface,
                DungeonEditorSessionValues.Preview preview
        ) {
            previewOperations.executeInMemoryPreview(surface, preview, dungeonState);
        }

        public void executePreview(MapId mapId, DungeonEditorSessionValues.Preview preview) {
            previewOperations.executePreview(mapId, preview, dungeonState);
        }
    }

    private record OperationResultData(
            LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot,
            boolean changed,
            List<String> validationMessages,
            List<String> reactionMessages,
            DungeonEditorCommandOutcome commandOutcome
    ) {
        OperationResultData {
            validationMessages = validationMessages == null ? List.of() : List.copyOf(validationMessages);
            reactionMessages = reactionMessages == null ? List.of() : List.copyOf(reactionMessages);
            commandOutcome = commandOutcome == null ? DungeonEditorCommandOutcome.idle() : commandOutcome;
        }

        @Override
        public List<String> validationMessages() {
            return List.copyOf(validationMessages);
        }

        @Override
        public List<String> reactionMessages() {
            return List.copyOf(reactionMessages);
        }
    }

    @FunctionalInterface
    private interface AuthoredMapMutation {
        DungeonMap apply(DungeonMap current);
    }

    private record SnapshotPublication(
            DungeonEditorDungeonState.SnapshotFacts stateFacts,
            DungeonAuthoredPublication.Snapshot publishedSnapshot
    ) {
    }

    private record InspectorPublication(
            DungeonEditorWorkspaceValues.Inspector workspaceInspector,
            DungeonAuthoredPublication.Inspector publishedInspector
    ) {
    }

    private static final class PublicationAssembler {
        private final DungeonEditorWorkspaceAreaProjectionHelper areas =
                new DungeonEditorWorkspaceAreaProjectionHelper();
        private final DungeonEditorWorkspaceBoundaryProjectionHelper boundaries =
                new DungeonEditorWorkspaceBoundaryProjectionHelper();
        private final DungeonEditorWorkspaceFeatureProjectionHelper features =
                new DungeonEditorWorkspaceFeatureProjectionHelper();
        private final DungeonEditorWorkspaceHandleProjectionHelper handles =
                new DungeonEditorWorkspaceHandleProjectionHelper();

        private SnapshotPublication snapshot(
                String mapName,
                @Nullable DungeonDerivedState derived,
                List<DungeonEditorHandleProjection> editorHandles,
                long revision
        ) {
            List<DungeonEditorHandleProjection> safeEditorHandles = editorHandles == null
                    ? List.of()
                    : List.copyOf(editorHandles);
            return new SnapshotPublication(
                    stateFacts(mapName, derived, safeEditorHandles, revision),
                    DungeonAuthoredPublication.snapshot(mapName, derived, safeEditorHandles, revision));
        }

        private @Nullable InspectorPublication inspector(
                LoadDungeonSnapshotUseCase.@Nullable InspectorSnapshotData inspector
        ) {
            if (inspector == null) {
                return null;
            }
            StatePanelPublication statePanel = statePanelFacts(inspector.statePanelFacts());
            List<RoomNarrationPublication> rooms = roomNarrations(inspector.roomNarrations());
            return new InspectorPublication(
                    new DungeonEditorWorkspaceValues.Inspector(
                            inspector.title(),
                            inspector.description(),
                            statePanel.workspaceFacts(),
                            rooms.stream().map(RoomNarrationPublication::workspaceCard).toList()),
                    new DungeonAuthoredPublication.Inspector(
                            inspector.title(),
                            inspector.description(),
                            statePanel.publishedFacts(),
                            rooms.stream().map(RoomNarrationPublication::publishedCard).toList()));
        }

        private DungeonEditorDungeonState.SnapshotFacts stateFacts(
                String mapName,
                @Nullable DungeonDerivedState derived,
                List<DungeonEditorHandleProjection> editorHandles,
                long revision
        ) {
            return new DungeonEditorDungeonState.SnapshotFacts(
                    mapName,
                    stateRevision(revision),
                    workspaceSnapshot(derived, editorHandles));
        }

        private MapSnapshot workspaceSnapshot(
                @Nullable DungeonDerivedState derived,
                List<DungeonEditorHandleProjection> sourceHandles
        ) {
            DungeonMapFacts safeFacts = safeFacts(derived);
            return new MapSnapshot(
                    safeFacts.topology(),
                    safeFacts.width(),
                    safeFacts.height(),
                    areas.project(safeFacts),
                    boundaries.project(safeFacts),
                    features.project(safeFacts),
                    handles.project(sourceHandles));
        }

        private static StatePanelPublication statePanelFacts(
                LoadDungeonSnapshotUseCase.StatePanelFacts facts
        ) {
            LoadDungeonSnapshotUseCase.StatePanelFacts safeFacts = facts == null
                    ? LoadDungeonSnapshotUseCase.StatePanelFacts.empty()
                    : facts;
            StairGeometryPublication stair = stairGeometryFacts(safeFacts.stairGeometry());
            TransitionDestinationPublication transition = transitionDestinationFacts(safeFacts.transitionDestination());
            return new StatePanelPublication(
                    new DungeonEditorWorkspaceValues.InspectorStatePanelState(
                            stair.workspaceFacts(),
                            transition.workspaceFacts()),
                    new DungeonAuthoredPublication.StatePanelFacts(
                            stair.publishedFacts(),
                            transition.publishedFacts()));
        }

        private static StairGeometryPublication stairGeometryFacts(
                LoadDungeonSnapshotUseCase.StairGeometryPanelFacts facts
        ) {
            LoadDungeonSnapshotUseCase.StairGeometryPanelFacts safeFacts = facts == null
                    ? LoadDungeonSnapshotUseCase.StairGeometryPanelFacts.empty()
                    : facts;
            return new StairGeometryPublication(
                    new DungeonEditorWorkspaceValues.InspectorStairGeometryState(
                            safeFacts.present(),
                            safeFacts.stairId(),
                            safeFacts.shapeName(),
                            safeFacts.directionName(),
                            safeFacts.dimension1(),
                            safeFacts.dimension2()),
                    new DungeonAuthoredPublication.StairGeometry(
                            safeFacts.present(),
                            safeFacts.stairId(),
                            safeFacts.shapeName(),
                            safeFacts.directionName(),
                            safeFacts.dimension1(),
                            safeFacts.dimension2()));
        }

        private static TransitionDestinationPublication transitionDestinationFacts(
                LoadDungeonSnapshotUseCase.TransitionDestinationPanelFacts facts
        ) {
            LoadDungeonSnapshotUseCase.TransitionDestinationPanelFacts safeFacts = facts == null
                    ? LoadDungeonSnapshotUseCase.TransitionDestinationPanelFacts.empty()
                    : facts;
            return new TransitionDestinationPublication(
                    new DungeonEditorWorkspaceValues.InspectorTransitionDestinationState(
                            safeFacts.present(),
                            safeFacts.destinationTypeKey(),
                            safeFacts.mapId(),
                            safeFacts.tileId(),
                            safeFacts.transitionId()),
                    new DungeonAuthoredPublication.TransitionDestination(
                            safeFacts.present(),
                            safeFacts.destinationTypeKey(),
                            safeFacts.mapId(),
                            safeFacts.tileId(),
                            safeFacts.transitionId()));
        }

        private static List<RoomNarrationPublication> roomNarrations(
                List<LoadDungeonSnapshotUseCase.RoomNarrationData> roomNarrations
        ) {
            List<RoomNarrationPublication> result = new ArrayList<>();
            for (LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration : roomNarrations) {
                result.add(roomNarration(roomNarration));
            }
            return List.copyOf(result);
        }

        private static RoomNarrationPublication roomNarration(
                LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration
        ) {
            List<RoomExitPublication> exits = roomExits(roomNarration.exits());
            return new RoomNarrationPublication(
                    new DungeonEditorWorkspaceValues.RoomNarrationCard(
                            roomNarration.roomId(),
                            roomNarration.roomName(),
                            roomNarration.visualDescription(),
                            exits.stream().map(RoomExitPublication::workspaceExit).toList()),
                    new DungeonAuthoredPublication.RoomNarration(
                            roomNarration.roomId(),
                            roomNarration.roomName(),
                            roomNarration.visualDescription(),
                            exits.stream().map(RoomExitPublication::publishedExit).toList()));
        }

        private static List<RoomExitPublication> roomExits(
                List<LoadDungeonSnapshotUseCase.RoomExitNarrationData> exits
        ) {
            List<RoomExitPublication> result = new ArrayList<>();
            for (LoadDungeonSnapshotUseCase.RoomExitNarrationData exit : exits) {
                Cell cell = exit.cell();
                result.add(new RoomExitPublication(
                        new DungeonEditorWorkspaceValues.RoomExitNarration(
                                exit.label(),
                                cell == null
                                        ? Cell.empty()
                                        : new Cell(cell.q(), cell.r(), cell.level()),
                                exit.direction().name(),
                                exit.description()),
                        new DungeonAuthoredPublication.RoomExitNarration(
                                exit.label(),
                                exit.cell(),
                                exit.direction(),
                                exit.description())));
            }
            return List.copyOf(result);
        }

        private static int stateRevision(long revision) {
            if (revision > Integer.MAX_VALUE) {
                return Integer.MAX_VALUE;
            }
            return Math.max(0, (int) revision);
        }

        private static DungeonMapFacts safeFacts(@Nullable DungeonDerivedState derived) {
            return derived == null || derived.map() == null
                    ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                    : derived.map();
        }

        private record StatePanelPublication(
                DungeonEditorWorkspaceValues.InspectorStatePanelState workspaceFacts,
                DungeonAuthoredPublication.StatePanelFacts publishedFacts
        ) {
        }

        private record StairGeometryPublication(
                DungeonEditorWorkspaceValues.InspectorStairGeometryState workspaceFacts,
                DungeonAuthoredPublication.StairGeometry publishedFacts
        ) {
        }

        private record TransitionDestinationPublication(
                DungeonEditorWorkspaceValues.InspectorTransitionDestinationState workspaceFacts,
                DungeonAuthoredPublication.TransitionDestination publishedFacts
        ) {
        }

        private record RoomNarrationPublication(
                DungeonEditorWorkspaceValues.RoomNarrationCard workspaceCard,
                DungeonAuthoredPublication.RoomNarration publishedCard
        ) {
        }

        private record RoomExitPublication(
                DungeonEditorWorkspaceValues.RoomExitNarration workspaceExit,
                DungeonAuthoredPublication.RoomExitNarration publishedExit
        ) {
        }
    }
}
