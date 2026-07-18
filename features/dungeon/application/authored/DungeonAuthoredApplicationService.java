package features.dungeon.application.authored;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonTopology;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.projection.DungeonDerivedState;
import features.dungeon.domain.core.projection.DungeonDerivedStateProjection;
import features.dungeon.domain.core.projection.DungeonAreaType;
import features.dungeon.domain.core.projection.DungeonState;
import features.dungeon.domain.core.projection.DungeonMapFacts;
import features.dungeon.application.authored.port.DungeonMapRepository;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonUnitOfWork;
import features.dungeon.application.authored.port.DungeonUnitOfWorkResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import features.dungeon.application.authored.command.DungeonCommandResult;
import features.dungeon.application.authored.command.DungeonCompoundCommandResult;
import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.CorridorChange;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.command.RoomClusterChange;
import features.dungeon.application.authored.command.RoomRegionChange;
import features.dungeon.application.authored.command.CreateFeatureMarkerCommand;
import features.dungeon.application.authored.command.CreateCorridorCommand;
import features.dungeon.application.authored.command.CreateStairCommand;
import features.dungeon.application.authored.command.CreateTransitionCommand;
import features.dungeon.application.authored.command.ClusterBoundaryCommand;
import features.dungeon.application.authored.command.ClusterBoundaryStretchCommand;
import features.dungeon.application.authored.command.ClusterCornerCommand;
import features.dungeon.application.authored.command.DeleteFeatureMarkerCommand;
import features.dungeon.application.authored.command.DeleteCorridorCommand;
import features.dungeon.application.authored.command.DeleteStairCommand;
import features.dungeon.application.authored.command.DeleteTransitionCommand;
import features.dungeon.application.authored.command.FeatureMarkerSemanticsCommand;
import features.dungeon.application.authored.command.MoveConnectionHandleCommand;
import features.dungeon.application.authored.command.RoomClusterNameCommand;
import features.dungeon.application.authored.command.RoomNameCommand;
import features.dungeon.application.authored.command.RoomNarrationCommand;
import features.dungeon.application.authored.command.RoomRectangleCommand;
import features.dungeon.application.authored.command.UpdateStairGeometryCommand;
import features.dungeon.application.authored.command.TransitionDescriptionCommand;
import features.dungeon.application.authored.command.TransitionLinkCommand;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.DungeonMapOperationFeedbackRules;
import features.dungeon.domain.core.structure.corridor.CorridorDeletionTarget;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorRoutingPolicy;
import features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy;
import features.dungeon.domain.core.structure.corridor.DungeonCorridorEndpoint;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.stair.StairGeometrySpec;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionCatalog;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import features.dungeon.application.editor.interaction.DungeonEditorHandleProjection;
import features.dungeon.api.DungeonEditorHandleKind;
import features.dungeon.application.editor.session.DungeonEditorDungeonState;
import features.dungeon.application.editor.session.DungeonEditorRoomNarrationInput;
import features.dungeon.application.editor.session.DungeonEditorSessionSnapshot;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
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
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import platform.execution.ExecutionLane;

public final class DungeonAuthoredApplicationService implements DungeonAuthoredApi {
    private static final DungeonMapOperationFeedbackRules OPERATION_FEEDBACK_POLICY =
            new DungeonMapOperationFeedbackRules();
    private static final long ABSENT_ID = 0L;
    private static final long MIN_CLUSTER_ID = 0L;
    private static final String DEFAULT_MAP_NAME = "Dungeon Map";
    private static final String DEFAULT_LABEL = "";
    private static final String DEFAULT_DESCRIPTION = "";
    private static final String PREVIEW_ARGUMENT = "preview";

    private final DungeonCatalogStore catalogStore;
    private final DungeonMapRepository repository;
    private final DungeonWindowStore windowStore;
    private final DungeonUnitOfWork unitOfWork;
    private final DungeonAuthoredPublishedState publishedState;
    private final ExecutionLane executionLane;
    private final CorridorRoutingPolicy corridorRoutingPolicy;
    private final CreateCorridorCommand createCorridorCommand;
    private final DeleteCorridorCommand deleteCorridorCommand;
    /* Pointer previews operate on this immutable authored workset. */
    private final ConcurrentMap<Long, DungeonMap> authoredWorkset = new ConcurrentHashMap<>();
    private final DungeonEditHistory editHistory = new DungeonEditHistory();
    private final DungeonWindowProjection windowProjection = new DungeonWindowProjection();
    private final AtomicLong windowRequestGeneration = new AtomicLong();
    private final ConcurrentMap<Long, Long> acceptedPublicationRevisions = new ConcurrentHashMap<>();
    private volatile long acceptedWindowRequestGeneration;
    private final DungeonDerivedStateProjection derivedStateProjection = new DungeonDerivedStateProjection();
    private final PublishDungeonEditorHandlesUseCase publishDungeonEditorHandles =
            new PublishDungeonEditorHandlesUseCase();
    private final AssembleDungeonSnapshotUseCase assembleDungeonSnapshot =
            new AssembleDungeonSnapshotUseCase(derivedStateProjection);
    private final InspectDungeonSelectionUseCase inspectDungeonSelection = new InspectDungeonSelectionUseCase();
    private final PreviewDungeonEditorSurfaceMoveUseCase surfaceMovePreviewUseCase;
    private final MutationPipeline mutationPipeline = new MutationPipeline();
    private final FeatureMarkerSemanticsCommand featureMarkerSemanticsCommand =
            new FeatureMarkerSemanticsCommand();
    private final CreateFeatureMarkerCommand createFeatureMarkerCommand =
            new CreateFeatureMarkerCommand();
    private final DeleteFeatureMarkerCommand deleteFeatureMarkerCommand =
            new DeleteFeatureMarkerCommand();
    private final RoomNarrationCommand roomNarrationCommand = new RoomNarrationCommand();
    private final RoomNameCommand roomNameCommand = new RoomNameCommand();
    private final RoomClusterNameCommand roomClusterNameCommand = new RoomClusterNameCommand();
    private final RoomRectangleCommand roomRectangleCommand = new RoomRectangleCommand();
    private final ClusterBoundaryCommand clusterBoundaryCommand = new ClusterBoundaryCommand();
    private final ClusterCornerCommand clusterCornerCommand = new ClusterCornerCommand();
    private final ClusterBoundaryStretchCommand clusterBoundaryStretchCommand =
            new ClusterBoundaryStretchCommand();
    private final MoveConnectionHandleCommand moveConnectionHandleCommand =
            new MoveConnectionHandleCommand();
    private final CreateStairCommand createStairCommand = new CreateStairCommand();
    private final DeleteStairCommand deleteStairCommand = new DeleteStairCommand();
    private final UpdateStairGeometryCommand updateStairGeometryCommand =
            new UpdateStairGeometryCommand();
    private final CreateTransitionCommand createTransitionCommand = new CreateTransitionCommand();
    private final DeleteTransitionCommand deleteTransitionCommand = new DeleteTransitionCommand();
    private final TransitionDescriptionCommand transitionDescriptionCommand =
            new TransitionDescriptionCommand();
    private final TransitionLinkCommand transitionLinkCommand = new TransitionLinkCommand();
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
            DungeonCatalogStore catalogStore,
            DungeonMapRepository repository,
            DungeonWindowStore windowStore,
            DungeonUnitOfWork unitOfWork,
            ExecutionLane executionLane,
            DungeonAuthoredPublishedState publishedState
    ) {
        this(catalogStore, repository, windowStore, unitOfWork, executionLane, publishedState,
                new OrthogonalCorridorRoutingPolicy());
    }

    public DungeonAuthoredApplicationService(
            DungeonCatalogStore catalogStore,
            DungeonMapRepository repository,
            DungeonWindowStore windowStore,
            DungeonUnitOfWork unitOfWork,
            ExecutionLane executionLane,
            DungeonAuthoredPublishedState publishedState,
            CorridorRoutingPolicy corridorRoutingPolicy
    ) {
        this.catalogStore = Objects.requireNonNull(catalogStore, "catalogStore");
        this.repository = Objects.requireNonNull(repository, "repository");
        this.windowStore = Objects.requireNonNull(windowStore, "windowStore");
        this.unitOfWork = Objects.requireNonNull(unitOfWork, "unitOfWork");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
        this.corridorRoutingPolicy = Objects.requireNonNull(corridorRoutingPolicy, "corridorRoutingPolicy");
        surfaceMovePreviewUseCase = new PreviewDungeonEditorSurfaceMoveUseCase(this.corridorRoutingPolicy);
        createCorridorCommand = new CreateCorridorCommand(this.corridorRoutingPolicy);
        deleteCorridorCommand = new DeleteCorridorCommand(this.corridorRoutingPolicy);
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
    public CompletionStage<DungeonViewportSnapshot> viewport(DungeonViewportRequest request) {
        DungeonViewportRequest safeRequest = Objects.requireNonNull(request, "request");
        CompletableFuture<DungeonViewportSnapshot> completion = new CompletableFuture<>();
        executionLane.execute(() -> {
            try {
                completion.complete(loadViewport(safeRequest));
            } catch (RuntimeException failure) {
                completion.completeExceptionally(failure);
            }
        });
        return completion;
    }

    private DungeonViewportSnapshot loadViewport(DungeonViewportRequest safeRequest) {
        DungeonWindowRequest windowRequest = new DungeonWindowRequest(
                new DungeonMapIdentity(safeRequest.mapId()),
                safeRequest.requestGeneration(),
                List.copyOf(safeRequest.loadingChunks()));
        DungeonWindow window = windowStore.loadWindow(windowRequest)
                .orElseThrow(() -> new IllegalArgumentException("Unknown Dungeon map: " + safeRequest.mapId()));
        validateWindowResult(windowRequest, window);
        return windowProjection.viewport(safeRequest, window);
    }

    public long currentWindowRequestGeneration() {
        return acceptedWindowRequestGeneration;
    }

    private static void validateWindowResult(DungeonWindowRequest request, DungeonWindow window) {
        if (!request.mapId().equals(window.mapHeader().mapId())) {
            throw new IllegalStateException("Dungeon window returned a different map identity.");
        }
        if (request.requestGeneration() != window.requestGeneration()) {
            throw new IllegalStateException("Dungeon window returned a different request generation.");
        }
        Set<features.dungeon.api.DungeonChunkKey> returnedChunks = window.chunkHeaders().stream()
                .map(header -> header.key())
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
        if (!returnedChunks.equals(Set.copyOf(request.chunkKeys()))) {
            throw new IllegalStateException("Dungeon window did not return the exact requested chunk headers.");
        }
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
        OperationResultData result = mutationPipeline.executePatchCommand(
                domainMapId(mapId),
                current -> roomRectangleCommand.plan(current, start, end, deleteMode));
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
        OperationResultData result = mutationPipeline.executePatchCommand(
                domainMapId(mapId),
                current -> clusterBoundaryCommand.plan(
                        current,
                        clusterId,
                        safeEdges,
                        safeBoundaryKind,
                        deleteMode));
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
        DungeonMapIdentity selectedMapId = domainMapId(mapId);
        DungeonEditHistory.Step step = undo
                ? editHistory.peekUndo(selectedMapId)
                : editHistory.peekRedo(selectedMapId);
        if (!step.present()) {
            return;
        }
        DungeonMap currentSingleMap = step.singlePatchEntry()
                ? loadMap(selectedMapId)
                : null;
        DungeonPatch singlePatch = currentSingleMap == null
                ? null
                : step.rebasedSinglePatch(currentSingleMap.revision());
        if (singlePatch != null) {
            applySingleHistoryStep(
                    step,
                    singlePatch,
                    currentSingleMap,
                    session,
                    undo);
            return;
        }
        applyCompoundHistoryStep(step, selectedMapId, session, undo);
    }

    private void applyCompoundHistoryStep(
            DungeonEditHistory.Step step,
            DungeonMapIdentity selectedMapId,
            Session session,
            boolean undo
    ) {
        Map<Long, DungeonMap> currentMaps = new LinkedHashMap<>();
        for (long affectedMapId : step.mapIds()) {
            DungeonMap current = repository.findById(new DungeonMapIdentity(affectedMapId)).orElse(null);
            if (current == null) {
                return;
            }
            currentMaps.put(affectedMapId, current);
        }
        Map<Long, DungeonMap> changedMaps = step.applyTo(currentMaps);
        List<DungeonMap> savedMaps = repository.saveAll(List.copyOf(changedMaps.values()));
        editHistory.complete(step);
        for (DungeonMap savedMap : savedMaps) {
            authoredWorkset.put(savedMap.metadata().mapId().value(), savedMap);
        }
        DungeonMap saved = savedMaps.stream()
                .filter(candidate -> candidate.metadata().mapId().equals(selectedMapId))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("history save omitted the selected map"));
        OperationResultData result = new OperationResultData(
                mutationPipeline.snapshotData(saved, derive(saved)),
                true,
                List.of(),
                List.of(undo ? "undo applied" : "redo applied"),
                DungeonEditorCommandOutcome.accepted(saved.revision()));
        publicationOperations.publishMutation(result, session.dungeonState());
    }

    private void applySingleHistoryStep(
            DungeonEditHistory.Step step,
            DungeonPatch patch,
            DungeonMap current,
            Session session,
            boolean undo
    ) {
        DungeonMap candidate = patch.applyTo(current);
        DungeonUnitOfWorkResult commit = unitOfWork.commit(patch);
        if (commit instanceof DungeonUnitOfWorkResult.Rejected rejected) {
            publicationOperations.publishMutation(
                    rejectedCommit(current, rejected.reason()),
                    session.dungeonState());
            return;
        }
        DungeonUnitOfWorkResult.Committed committed = (DungeonUnitOfWorkResult.Committed) commit;
        validateCommittedPatch(patch, committed);
        authoredWorkset.put(candidate.metadata().mapId().value(), candidate);
        editHistory.complete(step);
        OperationResultData result = new OperationResultData(
                mutationPipeline.snapshotData(candidate, derive(candidate)),
                true,
                List.of(),
                List.of(undo ? "undo applied" : "redo applied"),
                DungeonEditorCommandOutcome.accepted(committed.committedRevision()));
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
            DungeonCorridorEndpoint end
    ) {
        if (start.sameLevelAs(end)) {
            return 0L;
        }
        return repository.nextStairId();
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

    public record FeatureMarkerSemanticsInput(long markerId, String label, String description) {
        public FeatureMarkerSemanticsInput {
            markerId = Math.max(0L, markerId);
            label = label == null ? "" : label;
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

        private OperationResultData executePatchCommand(
                DungeonMapIdentity mapId,
                AuthoredPatchCommand command
        ) {
            DungeonMap current = loadMap(mapId);
            DungeonCommandResult commandResult = command.plan(current);
            if (commandResult instanceof DungeonCommandResult.Rejected rejected) {
                return new OperationResultData(
                        snapshotData(current, derive(current)),
                        false,
                        List.of(),
                        List.of(),
                        DungeonEditorCommandOutcome.rejected(rejected.reason()));
            }
            DungeonCommandResult.Accepted accepted = (DungeonCommandResult.Accepted) commandResult;
            DungeonMap candidate = accepted.patch().applyTo(current);
            DungeonPatch patch = withDerivedSpatialImpact(accepted.patch(), current, candidate);
            DungeonUnitOfWorkResult commit = unitOfWork.commit(patch);
            if (commit instanceof DungeonUnitOfWorkResult.Rejected rejected) {
                return rejectedCommit(current, rejected.reason());
            }
            DungeonUnitOfWorkResult.Committed committed = (DungeonUnitOfWorkResult.Committed) commit;
            validateCommittedPatch(patch, committed);
            authoredWorkset.put(candidate.metadata().mapId().value(), candidate);
            editHistory.recordPatch(patch);
            return new OperationResultData(
                    snapshotData(candidate, derive(candidate)),
                    true,
                    OPERATION_FEEDBACK_POLICY.validationMessages(current, candidate),
                    OPERATION_FEEDBACK_POLICY.reactionMessages(current, candidate),
                    DungeonEditorCommandOutcome.accepted(committed.committedRevision()));
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

    }

    private DungeonPatch withDerivedSpatialImpact(
            DungeonPatch patch,
            DungeonMap current,
            DungeonMap candidate
    ) {
        Map<Long, List<Cell>> oldRoutes = corridorCellsById(derive(current));
        Map<Long, List<Cell>> newRoutes = corridorCellsById(derive(candidate));
        Map<Long, Set<Cell>> oldCorridorSpatial = corridorSpatialCells(current, oldRoutes);
        Map<Long, Set<Cell>> newCorridorSpatial = corridorSpatialCells(candidate, newRoutes);
        Set<Long> corridorIds = new LinkedHashSet<>();
        patch.changes().stream()
                .filter(CorridorChange.class::isInstance)
                .map(change -> change.entityRef().id())
                .forEach(corridorIds::add);
        Set<Long> routeCandidates = new LinkedHashSet<>(oldRoutes.keySet());
        routeCandidates.addAll(newRoutes.keySet());
        for (long corridorId : routeCandidates) {
            if (!oldRoutes.getOrDefault(corridorId, List.of())
                    .equals(newRoutes.getOrDefault(corridorId, List.of()))) {
                corridorIds.add(corridorId);
            }
        }

        Set<Long> clusterIds = affectedClusterIds(patch);
        Set<features.dungeon.api.DungeonChunkKey> chunks = new LinkedHashSet<>();
        List<DungeonPatchEntityRef> entities = new ArrayList<>();
        for (long clusterId : clusterIds) {
            entities.add(DungeonPatchEntityRef.roomCluster(clusterId));
            addChunks(chunks, patch.mapId().value(), clusterSpatialCells(current, clusterId));
            addChunks(chunks, patch.mapId().value(), clusterSpatialCells(candidate, clusterId));
        }
        for (long corridorId : corridorIds) {
            entities.add(DungeonPatchEntityRef.corridor(corridorId));
            addChunks(chunks, patch.mapId().value(), oldCorridorSpatial.getOrDefault(corridorId, Set.of()));
            addChunks(chunks, patch.mapId().value(), newCorridorSpatial.getOrDefault(corridorId, Set.of()));
        }
        return patch.withImpact(chunks, entities);
    }

    private static Set<Long> affectedClusterIds(DungeonPatch patch) {
        Set<Long> result = new LinkedHashSet<>();
        patch.changes().forEach(change -> {
            if (change instanceof RoomRegionChange room) {
                if (room.before() != null) {
                    result.add(room.before().clusterId());
                }
                if (room.after() != null) {
                    result.add(room.after().clusterId());
                }
            } else if (change instanceof RoomClusterChange cluster) {
                result.add(cluster.entityRef().id());
            }
        });
        result.removeIf(id -> id <= 0L);
        return Set.copyOf(result);
    }

    private static Set<Cell> clusterSpatialCells(DungeonMap map, long clusterId) {
        Set<Cell> result = new LinkedHashSet<>();
        for (RoomRegion room : map.rooms().roomsInCluster(clusterId)) {
            result.addAll(room.floorCells());
        }
        RoomCluster cluster = map.topology().roomCluster(clusterId);
        if (cluster != null) {
            cluster.orderedAuthoredBoundaries().forEach(boundary -> result.add(boundary.absoluteCell(cluster.center())));
        }
        return Set.copyOf(result);
    }

    private static Map<Long, Set<Cell>> corridorSpatialCells(
            DungeonMap map,
            Map<Long, List<Cell>> routes
    ) {
        Map<AnchorKey, Cell> anchors = new LinkedHashMap<>();
        for (Corridor corridor : map.corridors()) {
            corridor.bindings().anchorBindings().forEach(anchor -> anchors.put(
                    new AnchorKey(anchor.hostCorridorId(), anchor.anchorId()), anchor.position()));
        }
        Map<Long, Set<Cell>> result = new LinkedHashMap<>();
        for (Corridor corridor : map.corridors()) {
            Set<Cell> cells = new LinkedHashSet<>(routes.getOrDefault(corridor.corridorId(), List.of()));
            corridor.bindings().waypoints().forEach(waypoint -> {
                RoomCluster cluster = map.topology().roomCluster(waypoint.clusterId());
                if (cluster != null) {
                    cells.add(waypoint.absoluteCell(cluster.center()));
                }
            });
            corridor.bindings().doorBindings().forEach(door -> {
                RoomCluster cluster = map.topology().roomCluster(door.clusterId());
                if (cluster != null) {
                    Cell roomCell = new Cell(
                            cluster.center().q() + door.relativeCell().q(),
                            cluster.center().r() + door.relativeCell().r(),
                            door.relativeCell().level());
                    cells.add(roomCell);
                    cells.add(door.direction().neighborOf(roomCell));
                }
            });
            corridor.bindings().anchorBindings().forEach(anchor -> cells.add(anchor.position()));
            corridor.bindings().anchorRefs().forEach(ref -> {
                Cell anchor = anchors.get(new AnchorKey(ref.hostCorridorId(), ref.anchorId()));
                if (anchor != null) {
                    cells.add(anchor);
                }
            });
            result.put(corridor.corridorId(), Set.copyOf(cells));
        }
        return Map.copyOf(result);
    }

    private static Map<Long, List<Cell>> corridorCellsById(DungeonDerivedState state) {
        Map<Long, List<Cell>> result = new LinkedHashMap<>();
        for (DungeonState aggregate : state.aggregates()) {
            if (aggregate.kind() == DungeonAreaType.CORRIDOR) {
                result.put(aggregate.id(), aggregate.cells());
            }
        }
        return Map.copyOf(result);
    }

    private static void addChunks(
            Set<features.dungeon.api.DungeonChunkKey> chunks,
            long mapId,
            Iterable<Cell> cells
    ) {
        for (Cell cell : cells) {
            chunks.add(new features.dungeon.api.DungeonChunkKey(
                    mapId,
                    cell.level(),
                    Math.floorDiv(cell.q(), features.dungeon.api.DungeonChunkKey.CHUNK_SIZE),
                    Math.floorDiv(cell.r(), features.dungeon.api.DungeonChunkKey.CHUNK_SIZE)));
        }
    }

    private record AnchorKey(long hostCorridorId, long anchorId) { }

    private OperationResultData rejectedCommit(
            DungeonMap current,
            DungeonUnitOfWorkResult.Reason reason
    ) {
        DungeonEditorCommandOutcome.RejectionReason rejectionReason = switch (reason) {
            case STALE_REVISION -> DungeonEditorCommandOutcome.RejectionReason.STALE_REVISION;
            case MAP_NOT_FOUND -> DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET;
        };
        return new OperationResultData(
                mutationPipeline.snapshotData(current, derive(current)),
                false,
                List.of(),
                List.of(),
                DungeonEditorCommandOutcome.rejected(rejectionReason));
    }

    private static void validateCommittedPatch(
            DungeonPatch patch,
            DungeonUnitOfWorkResult.Committed committed
    ) {
        Objects.requireNonNull(patch, "patch");
        Objects.requireNonNull(committed, "committed");
        if (!patch.mapId().equals(committed.mapId())
                || patch.committedRevision() != committed.committedRevision()
                || !patch.touchedChunks().equals(committed.chunkRevisions().keySet())
                || !patch.resultFacts().equals(committed.resultFacts())) {
            throw new IllegalStateException("Dungeon unit of work returned facts that do not match the committed patch");
        }
    }

    private final class PublicationOperations {
        private final PublicationAssembler assembler = new PublicationAssembler();

        private synchronized void publishSnapshot(
                LoadDungeonSnapshotUseCase.@Nullable DungeonSnapshotData snapshot,
                DungeonEditorDungeonState state
        ) {
            SnapshotPublication publication = snapshotPublication(snapshot);
            if (publication == null) {
                state.replaceSnapshot(null);
                return;
            }
            if (acceptCommittedPublication(publication.stateFacts())) {
                state.replaceSnapshot(publication.stateFacts());
                publishedState.publishSnapshot(publication.publishedSnapshot());
            }
        }

        private synchronized boolean publishWindowSnapshot(
                DungeonEditorDungeonState.SnapshotFacts snapshot,
                DungeonEditorDungeonState state
        ) {
            DungeonEditorDungeonState.SnapshotFacts safeSnapshot =
                    Objects.requireNonNull(snapshot, "snapshot");
            if (!acceptCommittedPublication(safeSnapshot)) {
                return false;
            }
            state.replaceSnapshot(safeSnapshot);
            return true;
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

        private synchronized void publishMutation(
                @Nullable OperationResultData mutation,
                DungeonEditorDungeonState state
        ) {
            if (mutation == null) {
                return;
            }
            if (!mutation.changed()) {
                state.replaceCommandOutcome(mutation.commandOutcome());
                return;
            }
            SnapshotPublication snapshotPublication = snapshotPublication(mutation.snapshot());
            DungeonEditorDungeonState.SnapshotFacts snapshot = snapshotPublication == null
                    ? null
                    : snapshotPublication.stateFacts();
            if (snapshot == null || !acceptCommittedPublication(snapshot)) {
                return;
            }
            state.replaceMutation(new DungeonEditorDungeonState.MutationFacts(
                    snapshot,
                    mutation.commandOutcome()));
            publishedState.publishMutation(new DungeonAuthoredPublication.Mutation(
                    snapshotPublication.publishedSnapshot(),
                    mutation.validationMessages(),
                    mutation.reactionMessages()));
        }

        private boolean acceptCommittedPublication(
                DungeonEditorDungeonState.SnapshotFacts snapshot
        ) {
            if (snapshot.mapId() == null) {
                return false;
            }
            long mapId = snapshot.mapId().value();
            long revision = snapshot.acceptedRevision();
            long acceptedRevision = acceptedPublicationRevisions.getOrDefault(mapId, 0L);
            if (revision < acceptedRevision) {
                return false;
            }
            acceptedPublicationRevisions.put(mapId, revision);
            return true;
        }

        private @Nullable SnapshotPublication snapshotPublication(
                LoadDungeonSnapshotUseCase.@Nullable DungeonSnapshotData snapshot
        ) {
            if (snapshot == null) {
                return null;
            }
            return assembler.snapshot(
                    snapshot.mapId(),
                    snapshot.mapName(),
                    snapshot.derived(),
                    snapshot.editorHandles(),
                    snapshot.revision());
        }

    }

    private final class LoadOperations {

        private boolean loadInitialWindow(
                MapId mapId,
                int projectionLevel,
                DungeonEditorDungeonState state
        ) {
            long generation = windowRequestGeneration.incrementAndGet();
            DungeonViewportRequest viewport = new DungeonViewportRequest(
                    mapId.value(), generation, projectionLevel, 0, 0, 63, 63);
            DungeonWindowRequest request = new DungeonWindowRequest(
                    domainMapId(mapId), generation, List.copyOf(viewport.loadingChunks()));
            DungeonWindow window = windowStore.loadWindow(request).orElse(null);
            if (window == null) {
                rejectLatestWindow(generation, state);
                return false;
            }
            try {
                validateWindowResult(request, window);
            } catch (IllegalStateException invalidWindow) {
                rejectLatestWindow(generation, state);
                return false;
            }
            long mapIdValue = mapId.value();
            if (generation != windowRequestGeneration.get()
                    || generation <= acceptedWindowRequestGeneration) {
                return false;
            }
            if (!publicationOperations.publishWindowSnapshot(
                    windowProjection.editorSnapshot(window, projectionLevel), state)) {
                return false;
            }
            authoredWorkset.remove(mapIdValue);
            acceptedWindowRequestGeneration = generation;
            return true;
        }

        private void rejectLatestWindow(long generation, DungeonEditorDungeonState state) {
            if (generation == windowRequestGeneration.get()) {
                state.replaceSnapshot(null);
                state.replaceInspector(null);
                state.replacePreview(null);
            }
        }

        private LoadDungeonSnapshotUseCase.DungeonSnapshotData loadAuthoredMap(
                MapId mapId,
                DungeonEditorDungeonState state
        ) {
            LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot =
                    mutationPipeline.snapshotData(reloadMap(domainMapId(mapId)));
            publicationOperations.publishSnapshot(snapshot, state);
            return snapshot;
        }

        private LoadDungeonSnapshotUseCase.InspectorSnapshotData loadInspectorWithSelection(
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
            publicationOperations.publishInspector(inspector, state);
            return inspector;
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
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> createCorridorCommand.plan(
                            current,
                            stairIdForCorridor(current, startEndpoint, endEndpoint),
                            startEndpoint,
                            endEndpoint));
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private void deleteCorridor(MapId mapId, CorridorDeletionTarget target, Session session) {
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> deleteCorridorCommand.plan(current, target));
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private long createFeatureMarker(MapId mapId, FeatureMarkerKind kind, Cell anchor, Session session) {
            Objects.requireNonNull(mapId, "mapId");
            Objects.requireNonNull(kind, "kind");
            Objects.requireNonNull(anchor, "anchor");
            DungeonMap currentMap = loadMap(domainMapId(mapId));
            long markerId = currentMap.nextFeatureMarkerId();
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> createFeatureMarkerCommand.plan(
                            current,
                            markerId,
                            kind,
                            anchor,
                            DEFAULT_LABEL,
                            DEFAULT_DESCRIPTION));
            publicationOperations.publishMutation(result, session.dungeonState());
            return result.changed() ? markerId : 0L;
        }

        private boolean canCreateFeatureMarker(MapId mapId, FeatureMarkerKind kind, Cell anchor) {
            return mapId != null && kind != null && anchor != null;
        }

        private boolean deleteFeatureMarker(MapId mapId, long markerId, Session session) {
            if (mapId == null || markerId <= 0L) {
                return false;
            }
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> deleteFeatureMarkerCommand.plan(current, markerId));
            publicationOperations.publishMutation(result, session.dungeonState());
            return result.changed();
        }
    }

    private final class StairTransitionOperations {

        private void createStair(MapId mapId, StairGeometrySpec spec, Session session) {
            Objects.requireNonNull(mapId, "mapId");
            Objects.requireNonNull(spec, "spec");
            long stairId = repository.nextStairId();
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> createStairCommand.plan(current, stairId, spec));
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private boolean canCreateStair(MapId mapId, StairGeometrySpec spec) {
            return mapId != null && spec != null && loadMap(domainMapId(mapId)).canCreateStair(spec);
        }

        private boolean deleteStair(MapId mapId, long stairId, Session session) {
            if (mapId == null || stairId <= 0L) {
                return false;
            }
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> deleteStairCommand.plan(current, stairId));
            publicationOperations.publishMutation(result, session.dungeonState());
            return result.changed();
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
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> createTransitionCommand.plan(
                            current,
                            transitionId,
                            anchor,
                            destination));
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
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> deleteTransitionCommand.plan(current, transitionId));
            publicationOperations.publishMutation(result, session.dungeonState());
            return result.changed();
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
            OperationResultData result = handleRef.kind() == DungeonEditorHandleKind.CLUSTER_CORNER
                    ? mutationPipeline.executePatchCommand(
                            domainMapId(mapId),
                            current -> clusterCornerCommand.plan(
                                    current,
                                    handleRef.clusterId() > 0L
                                            ? handleRef.clusterId()
                                            : current.clusterIdForTopologyRef(handleRef.topologyRef()),
                                    handleRef.cell(),
                                    safePreview.deltaQ(),
                                    safePreview.deltaR(),
                                    safePreview.deltaLevel()))
                    : mutationPipeline.executePatchCommand(
                            domainMapId(mapId),
                            current -> moveConnectionHandleCommand.planCluster(
                                    current,
                                    handleRef.clusterId() > 0L
                                            ? handleRef.clusterId()
                                            : current.clusterIdForTopologyRef(handleRef.topologyRef()),
                                    safePreview.deltaQ(),
                                    safePreview.deltaR(),
                                    safePreview.deltaLevel()));
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
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> {
                        if (handleRef.corridorId() > ABSENT_ID) {
                            return moveConnectionHandleCommand.planDoorBinding(
                                    current,
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
                        return moveConnectionHandleCommand.planDoorBoundary(
                                current,
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
                result = mutationPipeline.executePatchCommand(
                        domainMapId(mapId),
                        current -> moveConnectionHandleCommand.planCorridorAnchor(
                                current,
                                Math.max(0L, handleRef.corridorId()),
                                Math.max(0, handleRef.index()),
                                handleRef.topologyRef() == null
                                        ? DungeonTopologyRef.empty()
                                        : handleRef.topologyRef(),
                                safePreview.deltaQ(),
                                safePreview.deltaR(),
                                safePreview.deltaLevel()));
            } else if (handleRef.kind() == DungeonEditorHandleKind.CORRIDOR_WAYPOINT) {
                result = mutationPipeline.executePatchCommand(
                        domainMapId(mapId),
                        current -> moveConnectionHandleCommand.planCorridorWaypoint(
                                current,
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
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> moveConnectionHandleCommand.planStairAnchor(
                            current,
                            Math.max(0L, handleRef.ownerId()),
                            Math.max(0, handleRef.index()),
                            safePreview.deltaQ(),
                            safePreview.deltaR(),
                            safePreview.deltaLevel()));
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private void stretchClusterBoundary(
                MapId mapId,
                DungeonEditorSessionValues.MoveBoundaryStretchPreview preview,
                Session session
        ) {
            DungeonEditorSessionValues.MoveBoundaryStretchPreview safePreview =
                    Objects.requireNonNull(preview, PREVIEW_ARGUMENT);
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> clusterBoundaryStretchCommand.plan(
                            current,
                            safePreview.clusterId(),
                            DungeonEditorWorkspaceGeometry.unitEdges(safePreview.sourceEdges()),
                            safePreview.deltaQ(),
                            safePreview.deltaR(),
                            safePreview.deltaLevel()));
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private Edge sourceEdge(DungeonEditorWorkspaceValues.HandleRef handleRef) {
            if (handleRef.sourceEdge() != null) {
                return handleRef.sourceEdge();
            }
            Cell cell = handleRef.cell();
            return handleRef.direction().edgeOf(cell);
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
            String mapName = requestedMapName == null || requestedMapName.isBlank()
                    ? DEFAULT_MAP_NAME
                    : requestedMapName;
            DungeonMapHeader created = catalogStore.create(mapName);
            DungeonMap emptyMap = DungeonMapAuthoring.committedContent(
                    DungeonMapAuthoring.empty(created.mapId(), created.mapName()),
                    created.revision());
            authoredWorkset.put(created.mapId().value(), emptyMap);
            return created.mapId();
        }

        private DungeonMapIdentity renameMap(DungeonMapIdentity mapIdentity, String requestedMapName) {
            String mapName = requestedMapName == null || requestedMapName.isBlank()
                    ? DEFAULT_MAP_NAME
                    : requestedMapName;
            DungeonMapHeader renamed = catalogStore.rename(mapIdentity, mapName);
            authoredWorkset.computeIfPresent(mapIdentity.value(), (ignored, current) ->
                    DungeonMapAuthoring.committedContent(
                            DungeonMapAuthoring.rename(current, renamed.mapName()),
                            renamed.revision()));
            return renamed.mapId();
        }

        private DungeonMapIdentity deleteMap(DungeonMapIdentity mapIdentity) {
            catalogStore.delete(mapIdentity);
            authoredWorkset.remove(mapIdentity.value());
            editHistory.remove(mapIdentity);
            return mapIdentity;
        }

        private CatalogResult searchCatalog(String query) {
            String effectiveQuery = query == null ? "" : query;
            List<MapSummaryData> summaries = new ArrayList<>();
            for (DungeonMapHeader map : catalogStore.search(effectiveQuery)) {
                summaries.add(new MapSummaryData(
                        map.mapId(),
                        map.mapName(),
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
            Set<Long> knownMissingMapIds = new LinkedHashSet<>();
            DungeonCompoundCommandResult commandResult = transitionLinkCommand.plan(
                    pendingMaps.values(),
                    loaded.sourceIdentity().value(),
                    sourceTransitionId,
                    loaded.targetIdentity().value(),
                    targetTransitionId,
                    bidirectional,
                    knownMissingMapIds);
            if (commandResult instanceof DungeonCompoundCommandResult.RequiresMap requiresMap) {
                long mapId = requiresMap.mapId();
                Optional<DungeonMap> requiredMap = repository.findById(new DungeonMapIdentity(mapId));
                if (requiredMap.isPresent()) {
                    pendingMaps.put(mapId, requiredMap.orElseThrow());
                } else {
                    knownMissingMapIds.add(mapId);
                }
                commandResult = transitionLinkCommand.plan(
                        pendingMaps.values(),
                        loaded.sourceIdentity().value(),
                        sourceTransitionId,
                        loaded.targetIdentity().value(),
                        targetTransitionId,
                        bidirectional,
                        knownMissingMapIds);
            }
            if (!(commandResult instanceof DungeonCompoundCommandResult.Accepted accepted)) {
                return null;
            }
            DungeonCompoundPatch patch = accepted.patch();
            Map<Long, DungeonMap> patchedMaps = patch.applyTo(pendingMaps);
            List<DungeonMap> savedMaps = repository.saveAll(List.copyOf(patchedMaps.values()));
            editHistory.recordCompoundPatch(patch);
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
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> roomNarrationCommand.plan(
                            current,
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
            OperationResultData result = switch (safeTargetType) {
                case CLUSTER -> mutationPipeline.executePatchCommand(
                        domainMapId(mapId),
                        current -> roomClusterNameCommand.plan(current, targetId, trimmedName));
                case ROOM -> mutationPipeline.executePatchCommand(
                        domainMapId(mapId),
                        current -> roomNameCommand.plan(current, targetId, trimmedName));
                case EMPTY -> null;
            };
            if (result == null) {
                return;
            }
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
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> transitionDescriptionCommand.plan(current, transitionId, description));
            publicationOperations.publishMutation(result, state);
        }

        private void saveAuthoredFeatureMarkerSemantics(
                MapId mapId,
                long markerId,
                String label,
                String description,
                DungeonEditorDungeonState state
        ) {
            if (mapId == null || markerId <= 0L || label == null || label.isBlank()) {
                return;
            }
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> featureMarkerSemanticsCommand.plan(
                            current, markerId, label, description));
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
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    current -> updateStairGeometryCommand.plan(current, stairId, spec));
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
        private void executeInMemoryPreview(
                DungeonEditorSessionSnapshot.SurfaceData surface,
                DungeonEditorSessionValues.Preview preview,
                DungeonEditorDungeonState state
        ) {
            state.replacePreview(surfaceMovePreviewUseCase.execute(surface, preview));
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

        public void saveAuthoredFeatureMarkerSemantics(
                MapId mapId,
                long markerId,
                String label,
                String description
        ) {
            detailSaveOperations.saveAuthoredFeatureMarkerSemantics(
                    mapId, markerId, label, description, dungeonState);
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

        public boolean loadInitialWindow(MapId mapId, int projectionLevel) {
            return loadOperations.loadInitialWindow(mapId, projectionLevel, dungeonState);
        }

        public void loadInspectorWithSelection(
                MapId mapId,
                DungeonTopologyRef topologyRef,
                long clusterId,
                boolean clusterSelection
        ) {
            loadOperations.loadInspectorWithSelection(
                    mapId,
                    topologyRef,
                    clusterId,
                    clusterSelection,
                    dungeonState);
        }

        public void executeInMemoryPreview(
                DungeonEditorSessionSnapshot.SurfaceData surface,
                DungeonEditorSessionValues.Preview preview
        ) {
            previewOperations.executeInMemoryPreview(surface, preview, dungeonState);
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
    private interface AuthoredPatchCommand {
        DungeonCommandResult plan(DungeonMap current);
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
                long mapId,
                String mapName,
                @Nullable DungeonDerivedState derived,
                List<DungeonEditorHandleProjection> editorHandles,
                long revision
        ) {
            List<DungeonEditorHandleProjection> safeEditorHandles = editorHandles == null
                    ? List.of()
                    : List.copyOf(editorHandles);
            return new SnapshotPublication(
                    stateFacts(mapId, mapName, derived, safeEditorHandles, revision),
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
                long mapId,
                String mapName,
                @Nullable DungeonDerivedState derived,
                List<DungeonEditorHandleProjection> editorHandles,
                long revision
        ) {
            return new DungeonEditorDungeonState.SnapshotFacts(
                    new MapId(mapId),
                    0L,
                    revision,
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
