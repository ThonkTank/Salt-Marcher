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
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonIdentityAllocator;
import features.dungeon.application.authored.port.DungeonIdentityKind;
import features.dungeon.application.authored.port.DungeonIdentityRange;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonCompoundUnitOfWorkResult;
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
    private final DungeonWindowStore windowStore;
    private final DungeonUnitOfWork unitOfWork;
    private final DungeonIdentityAllocator identityAllocator;
    private final DungeonCommandWorksetLoader commandWorksetLoader;
    private final DungeonAuthoredPublishedState publishedState;
    private final ExecutionLane executionLane;
    private final CorridorRoutingPolicy corridorRoutingPolicy;
    private final CreateCorridorCommand createCorridorCommand;
    private final DeleteCorridorCommand deleteCorridorCommand;
    private final ConcurrentMap<Long, DungeonCommandReadSpecs.AcceptedViewport> acceptedViewports =
            new ConcurrentHashMap<>();
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
            DungeonWindowStore windowStore,
            DungeonUnitOfWork unitOfWork,
            DungeonIdentityAllocator identityAllocator,
            ExecutionLane executionLane,
            DungeonAuthoredPublishedState publishedState
    ) {
        this(catalogStore, windowStore, unitOfWork, identityAllocator, executionLane, publishedState,
                new OrthogonalCorridorRoutingPolicy());
    }

    public DungeonAuthoredApplicationService(
            DungeonCatalogStore catalogStore,
            DungeonWindowStore windowStore,
            DungeonUnitOfWork unitOfWork,
            DungeonIdentityAllocator identityAllocator,
            ExecutionLane executionLane,
            DungeonAuthoredPublishedState publishedState,
            CorridorRoutingPolicy corridorRoutingPolicy
    ) {
        this.catalogStore = Objects.requireNonNull(catalogStore, "catalogStore");
        this.windowStore = Objects.requireNonNull(windowStore, "windowStore");
        this.unitOfWork = Objects.requireNonNull(unitOfWork, "unitOfWork");
        this.identityAllocator = Objects.requireNonNull(identityAllocator, "identityAllocator");
        this.commandWorksetLoader = new DungeonCommandWorksetLoader(this.catalogStore, this.windowStore);
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

    public void invalidateAcceptedWindow(MapId mapId) {
        if (mapId == null) {
            return;
        }
        DungeonCommandReadSpecs.AcceptedViewport accepted = acceptedViewports.get(mapId.value());
        if (accepted != null) {
            windowStore.invalidateChunks(accepted.chunkKeys());
        }
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

    private DungeonDerivedState derive(DungeonMap dungeonMap) {
        return derivedStateProjection.project(dungeonMap);
    }

    public void applyRoomRectangle(MapId mapId, Cell start, Cell end, boolean deleteMode, Session session) {
        Objects.requireNonNull(start, "start");
        Objects.requireNonNull(end, "end");
        if (start.level() != end.level()) {
            publicationOperations.publishMutation(
                    rejectedResult(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET),
                    session.dungeonState());
            return;
        }
        OperationResultData result = mutationPipeline.executePatchCommand(
                domainMapId(mapId),
                session.dungeonState(),
                DungeonCommandReadSpecs.rectangleWithRing(mapId.value(), start, end),
                List.of(),
                DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                current -> {
                    int identityBound = roomIdentityBound(current, rectangleCellCount(start, end));
                    return roomRectangleCommand.plan(
                            current,
                            start,
                            end,
                            deleteMode,
                            reserve(DungeonIdentityKind.ROOM_CLUSTER, identityBound),
                            reserve(DungeonIdentityKind.ROOM, identityBound));
                });
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
                session.dungeonState(),
                DungeonCommandReadSpecs.edgesWithRing(mapId.value(), safeEdges),
                clusterId > 0L ? List.of(DungeonPatchEntityRef.roomCluster(clusterId)) : List.of(),
                DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                current -> {
                    int identityBound = roomIdentityBound(current, safeEdges.size() * 2L);
                    return clusterBoundaryCommand.plan(
                            current,
                            clusterId,
                            safeEdges,
                            safeBoundaryKind,
                            deleteMode,
                            reserve(DungeonIdentityKind.ROOM_CLUSTER, identityBound),
                            reserve(DungeonIdentityKind.ROOM, identityBound));
                });
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
        DungeonCommandReadSpecs.AcceptedViewport selectedViewport =
                acceptedViewport(selectedMapId, session.dungeonState());
        if (selectedViewport == null) {
            publicationOperations.publishMutation(
                    rejectedResult(DungeonEditorCommandOutcome.RejectionReason.STALE_REVISION),
                    session.dungeonState());
            return;
        }
        List<DungeonWindowStore.Lease> editLeases = new ArrayList<>();
        try {
        Map<Long, HistoryLoadedMap> loadedMaps = new LinkedHashMap<>();
        Map<Long, DungeonMap> currentMaps = new LinkedHashMap<>();
        for (DungeonPatch selectedPatch : step.selectedPatches()) {
            DungeonMapIdentity affectedMapId = selectedPatch.mapId();
            DungeonCommandReadSpec readSpec = historyReadSpec(
                    selectedPatch, selectedMapId, selectedViewport);
            if (readSpec == null) {
                publicationOperations.publishMutation(
                        rejectedResult(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET),
                        session.dungeonState());
                return;
            }
            editLeases.add(windowStore.protectEditChunks(readSpec.chunkKeys()));
            DungeonCommandWorksetResult loaded = commandWorksetLoader.load(readSpec);
            if (!(loaded instanceof DungeonCommandWorksetResult.Complete complete)
                    || !complete.workset().containsComplete(readSpec)) {
                DungeonEditorCommandOutcome.RejectionReason reason =
                        loaded instanceof DungeonCommandWorksetResult.Rejected rejected
                                ? worksetRejection(rejected.reason())
                                : DungeonEditorCommandOutcome.RejectionReason.INSUFFICIENT_LOADED_CLOSURE;
                publicationOperations.publishMutation(rejectedResult(reason), session.dungeonState());
                return;
            }
            DungeonMap current = complete.workset().aggregateFor(readSpec);
            loadedMaps.put(affectedMapId.value(), new HistoryLoadedMap(complete.workset(), readSpec));
            currentMaps.put(affectedMapId.value(), current);
        }
        if (step.singlePatchEntry()) {
            DungeonMap current = currentMaps.get(selectedMapId.value());
            DungeonPatch patch = current == null ? null : step.rebasedSinglePatch(current.revision());
            if (patch == null) {
                throw new IllegalStateException("single history step omitted the selected map");
            }
            DungeonUnitOfWorkResult commit = unitOfWork.commit(patch);
            if (commit instanceof DungeonUnitOfWorkResult.Rejected rejected) {
                publicationOperations.publishMutation(
                        rejectedCommit(rejected.reason()), session.dungeonState());
                return;
            }
            DungeonUnitOfWorkResult.Committed committed = (DungeonUnitOfWorkResult.Committed) commit;
            validateCommittedPatch(patch, committed);
            windowStore.invalidateChunks(committed.chunkRevisions().keySet());
            completeHistoryStep(step, loadedMaps, List.of(patch), selectedMapId, session, undo);
            return;
        }
        DungeonCompoundPatch patch = step.rebasedCompoundPatch(currentMaps);
        if (patch == null) {
            throw new IllegalStateException("compound history step did not expose a compound patch");
        }
        DungeonCompoundUnitOfWorkResult commit = unitOfWork.commit(patch);
        if (commit instanceof DungeonCompoundUnitOfWorkResult.Rejected rejected) {
            publicationOperations.publishMutation(
                    rejectedCommit(rejected.reason()), session.dungeonState());
            return;
        }
        DungeonCompoundUnitOfWorkResult.Committed committed =
                (DungeonCompoundUnitOfWorkResult.Committed) commit;
        validateCommittedCompoundPatch(patch, committed);
        invalidateCommittedChunks(committed);
        completeHistoryStep(step, loadedMaps, patch.patches(), selectedMapId, session, undo);
        } finally {
            closeLeases(editLeases);
        }
    }

    private void completeHistoryStep(
            DungeonEditHistory.Step step,
            Map<Long, HistoryLoadedMap> loadedMaps,
            List<DungeonPatch> committedPatches,
            DungeonMapIdentity selectedMapId,
            Session session,
            boolean undo
    ) {
        for (DungeonPatch committedPatch : committedPatches) {
            acceptedViewports.computeIfPresent(
                    committedPatch.mapId().value(),
                    (ignored, viewport) -> viewport.committed(committedPatch.committedRevision()));
        }
        editHistory.complete(step);
        DungeonPatch selectedPatch = committedPatches.stream()
                .filter(candidate -> candidate.mapId().equals(selectedMapId))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("history omitted the selected map patch"));
        HistoryLoadedMap selected = loadedMaps.get(selectedMapId.value());
        if (selected == null) {
            throw new IllegalStateException("history omitted the selected map workset");
        }
        OperationResultData result = new OperationResultData(
                mutationPipeline.snapshotData(selected.workset(), selected.spec(), selectedPatch),
                true,
                List.of(),
                List.of(undo ? "undo applied" : "redo applied"),
                DungeonEditorCommandOutcome.accepted(selectedPatch.committedRevision()));
        publicationOperations.publishMutation(result, session.dungeonState());
    }

    private @Nullable DungeonCommandReadSpec historyReadSpec(
            DungeonPatch patch,
            DungeonMapIdentity selectedMapId,
            DungeonCommandReadSpecs.AcceptedViewport selectedViewport
    ) {
        Set<features.dungeon.api.DungeonChunkKey> chunks =
                DungeonCommandReadSpecs.withRing(patch.touchedChunks());
        List<DungeonPatchEntityRef> seeds = historySeedRefs(patch);
        if (patch.mapId().equals(selectedMapId)) {
            return DungeonCommandReadSpecs.forViewport(
                    selectedViewport,
                    chunks,
                    seeds,
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                    DungeonCommandReadSpec.CommandIntent.HISTORY);
        }
        DungeonMapHeader header = catalogStore.find(patch.mapId()).orElse(null);
        return header == null ? null : DungeonCommandReadSpecs.forHeader(
                header,
                windowRequestGeneration.incrementAndGet(),
                chunks,
                seeds,
                DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                DungeonCommandReadSpec.CommandIntent.HISTORY);
    }

    private static List<DungeonPatchEntityRef> historySeedRefs(DungeonPatch patch) {
        List<DungeonPatchEntityRef> result = new ArrayList<>();
        patch.changes().forEach(change -> {
            boolean existsBefore = switch (change) {
                case features.dungeon.application.authored.command.FeatureMarkerChange marker -> marker.before() != null;
                case RoomRegionChange room -> room.before() != null;
                case RoomClusterChange cluster -> cluster.before() != null;
                case features.dungeon.application.authored.command.StairChange stair -> stair.before() != null;
                case features.dungeon.application.authored.command.TransitionChange transition ->
                        transition.before() != null;
                case CorridorChange corridor -> corridor.before() != null;
            };
            if (existsBefore) {
                result.add(change.entityRef());
            }
        });
        return List.copyOf(result);
    }

    private record HistoryLoadedMap(DungeonCommandWorkset workset, DungeonCommandReadSpec spec) { }

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
        return stairTransitionOperations.canCreateStair(mapId, spec, session);
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
        return stairTransitionOperations.canCreateTransition(mapId, anchor, destination, session);
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

    private static @Nullable DungeonMapIdentity domainMapId(@Nullable MapId mapId) {
        return mapId == null ? null : new DungeonMapIdentity(mapId.value());
    }

    private static MapId mapId(DungeonMapIdentity mapId) {
        return new MapId(mapId.value());
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

    private static List<DungeonPatchEntityRef> entityRefs(DungeonPatchEntityRef... refs) {
        List<DungeonPatchEntityRef> result = new ArrayList<>();
        for (DungeonPatchEntityRef ref : refs == null ? new DungeonPatchEntityRef[0] : refs) {
            if (ref != null && !result.contains(ref)) {
                result.add(ref);
            }
        }
        return List.copyOf(result);
    }

    private static @Nullable DungeonPatchEntityRef roomRef(long roomId) {
        return roomId > 0L ? DungeonPatchEntityRef.room(roomId) : null;
    }

    private static @Nullable DungeonPatchEntityRef clusterRef(long clusterId) {
        return clusterId > 0L ? DungeonPatchEntityRef.roomCluster(clusterId) : null;
    }

    private static @Nullable DungeonPatchEntityRef corridorRef(long corridorId) {
        return corridorId > 0L ? DungeonPatchEntityRef.corridor(corridorId) : null;
    }

    private static @Nullable DungeonPatchEntityRef stairRef(long stairId) {
        return stairId > 0L ? DungeonPatchEntityRef.stair(stairId) : null;
    }

    private static @Nullable DungeonPatchEntityRef transitionRef(long transitionId) {
        return transitionId > 0L ? DungeonPatchEntityRef.transition(transitionId) : null;
    }

    private static @Nullable DungeonPatchEntityRef markerRef(long markerId) {
        return markerId > 0L ? DungeonPatchEntityRef.featureMarker(markerId) : null;
    }

    private DungeonIdentityRange reserve(DungeonIdentityKind kind, int count) {
        return identityAllocator.reserve(kind, Math.max(1, count));
    }

    private static int roomIdentityBound(DungeonMap current, long additionalCells) {
        long loadedCells = 0L;
        if (current != null) {
            for (RoomRegion room : current.rooms().rooms()) {
                loadedCells += room.floorCells().size();
            }
        }
        return positiveBound(loadedCells + Math.max(0L, additionalCells));
    }

    private static int positiveBound(long value) {
        return (int) Math.max(1L, Math.min(Integer.MAX_VALUE, value));
    }

    private static long rectangleCellCount(Cell start, Cell end) {
        if (start == null || end == null) {
            return 1L;
        }
        long width = Math.abs((long) start.q() - end.q()) + 1L;
        long height = Math.abs((long) start.r() - end.r()) + 1L;
        try {
            return Math.multiplyExact(width, height);
        } catch (ArithmeticException ignored) {
            return Integer.MAX_VALUE;
        }
    }

    private static List<DungeonPatchEntityRef> corridorEndpointRefs(
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        List<DungeonPatchEntityRef> result = new ArrayList<>();
        addCorridorEndpointRefs(result, start);
        addCorridorEndpointRefs(result, end);
        return List.copyOf(result);
    }

    private static void addCorridorEndpointRefs(
            List<DungeonPatchEntityRef> target,
            DungeonCorridorEndpoint endpoint
    ) {
        if (endpoint == null) {
            return;
        }
        if (endpoint.isDoorEndpoint()) {
            DungeonPatchEntityRef room = roomRef(endpoint.roomId());
            DungeonPatchEntityRef cluster = clusterRef(endpoint.clusterId());
            if (room != null && !target.contains(room)) {
                target.add(room);
            }
            if (cluster != null && !target.contains(cluster)) {
                target.add(cluster);
            }
        } else if (endpoint.isAnchorEndpoint()) {
            DungeonPatchEntityRef corridor = corridorRef(endpoint.hostCorridorId());
            if (corridor != null && !target.contains(corridor)) {
                target.add(corridor);
            }
        }
    }

    private static Set<features.dungeon.api.DungeonChunkKey> corridorRouteChunks(
            long mapId,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        Cell startCell = corridorEndpointCell(start);
        Cell endCell = corridorEndpointCell(end);
        List<Cell> cells = new ArrayList<>();
        if (startCell != null && endCell != null) {
            if (start.sameLevelAs(end)) {
                cells.addAll(features.dungeon.domain.core.geometry.Route.horizontalFirstOnStartLevel(
                        startCell, endCell));
                cells.addAll(features.dungeon.domain.core.geometry.Route.verticalFirstOnStartLevel(
                        startCell, endCell));
            } else {
                cells.addAll(features.dungeon.domain.core.geometry.Route.horizontalFirst(startCell, endCell));
                cells.addAll(features.dungeon.domain.core.geometry.Route.verticalFirst(startCell, endCell));
            }
        }
        return DungeonCommandReadSpecs.cellsWithRing(mapId, cells);
    }

    private static Set<features.dungeon.api.DungeonChunkKey> stairGeometryChunks(
            long mapId,
            StairGeometrySpec spec
    ) {
        if (spec == null) {
            return Set.of();
        }
        return DungeonCommandReadSpecs.cellsWithRing(
                mapId,
                java.util.stream.Stream.concat(
                                spec.generatedPath().stream(),
                                spec.generatedExitCells().stream())
                        .toList());
    }

    private static @Nullable Cell corridorEndpointCell(@Nullable DungeonCorridorEndpoint endpoint) {
        if (endpoint == null) {
            return null;
        }
        if (endpoint.isDoorEndpoint()) {
            return endpoint.direction().neighborOf(endpoint.roomCell());
        }
        return endpoint.isAnchorEndpoint() ? endpoint.anchorCell() : null;
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

        private <T> T readCommand(
                DungeonMapIdentity mapId,
                DungeonEditorDungeonState state,
                java.util.Collection<features.dungeon.api.DungeonChunkKey> commandChunks,
                java.util.Collection<DungeonPatchEntityRef> seedRefs,
                DungeonCommandReadSpec.DependencyExpansion expansion,
                DungeonCommandReadSpec.CommandIntent intent,
                T fallback,
                java.util.function.Function<DungeonMap, T> reader
        ) {
            DungeonCommandReadSpecs.AcceptedViewport viewport = acceptedViewport(mapId, state);
            if (viewport == null) {
                return fallback;
            }
            DungeonCommandReadSpec spec = DungeonCommandReadSpecs.forViewport(
                    viewport, commandChunks, seedRefs, expansion, intent);
            try (DungeonWindowStore.Lease editLease = windowStore.protectEditChunks(spec.chunkKeys())) {
                DungeonCommandWorksetResult loaded = commandWorksetLoader.load(spec);
                if (!(loaded instanceof DungeonCommandWorksetResult.Complete complete)
                        || !complete.workset().containsComplete(spec)) {
                    return fallback;
                }
                return reader.apply(complete.workset().aggregateFor(spec));
            }
        }

        private OperationResultData executePatchCommand(
                DungeonMapIdentity mapId,
                DungeonEditorDungeonState state,
                java.util.Collection<features.dungeon.api.DungeonChunkKey> commandChunks,
                java.util.Collection<DungeonPatchEntityRef> seedRefs,
                DungeonCommandReadSpec.DependencyExpansion expansion,
                AuthoredPatchCommand command
        ) {
            DungeonCommandReadSpecs.AcceptedViewport viewport = acceptedViewport(mapId, state);
            if (viewport == null) {
                return rejectedResult(DungeonEditorCommandOutcome.RejectionReason.STALE_REVISION);
            }
            DungeonCommandReadSpec spec = DungeonCommandReadSpecs.forViewport(
                    viewport,
                    commandChunks,
                    seedRefs,
                    expansion,
                    DungeonCommandReadSpec.CommandIntent.AUTHORED_MUTATION);
            try (DungeonWindowStore.Lease editLease = windowStore.protectEditChunks(spec.chunkKeys())) {
            DungeonCommandWorksetResult loaded = commandWorksetLoader.load(spec);
            if (loaded instanceof DungeonCommandWorksetResult.Rejected rejected) {
                return rejectedResult(worksetRejection(rejected.reason()));
            }
            DungeonCommandWorkset workset = ((DungeonCommandWorksetResult.Complete) loaded).workset();
            if (!workset.containsComplete(spec)) {
                return rejectedResult(DungeonEditorCommandOutcome.RejectionReason.INSUFFICIENT_LOADED_CLOSURE);
            }
            DungeonMap current = workset.aggregateFor(spec);
            DungeonCommandResult commandResult = command.plan(current);
            if (commandResult instanceof DungeonCommandResult.Rejected rejected) {
                return rejectedResult(rejected.reason());
            }
            DungeonCommandResult.Accepted accepted = (DungeonCommandResult.Accepted) commandResult;
            DungeonMap candidate = accepted.patch().applyTo(current);
            DungeonPatch patch = withDerivedSpatialImpact(accepted.patch(), current, candidate);
            if (!Set.copyOf(spec.chunkKeys()).containsAll(patch.touchedChunks())) {
                Set<features.dungeon.api.DungeonChunkKey> expandedChunks = new LinkedHashSet<>(spec.chunkKeys());
                expandedChunks.addAll(DungeonCommandReadSpecs.withRing(patch.touchedChunks()));
                spec = DungeonCommandReadSpecs.forViewport(
                        viewport,
                        expandedChunks,
                        seedRefs,
                        expansion,
                        DungeonCommandReadSpec.CommandIntent.AUTHORED_MUTATION);
                loaded = commandWorksetLoader.load(spec);
                if (!(loaded instanceof DungeonCommandWorksetResult.Complete expanded)
                        || !expanded.workset().containsComplete(spec)) {
                    return rejectedResult(loaded instanceof DungeonCommandWorksetResult.Rejected rejected
                            ? worksetRejection(rejected.reason())
                            : DungeonEditorCommandOutcome.RejectionReason.INSUFFICIENT_LOADED_CLOSURE);
                }
                workset = expanded.workset();
                current = workset.aggregateFor(spec);
                commandResult = command.plan(current);
                if (!(commandResult instanceof DungeonCommandResult.Accepted replanned)) {
                    DungeonEditorCommandOutcome.RejectionReason reason =
                            ((DungeonCommandResult.Rejected) commandResult).reason();
                    return rejectedResult(reason);
                }
                candidate = replanned.patch().applyTo(current);
                patch = withDerivedSpatialImpact(replanned.patch(), current, candidate);
                if (!Set.copyOf(spec.chunkKeys()).containsAll(patch.touchedChunks())) {
                    return rejectedResult(
                            DungeonEditorCommandOutcome.RejectionReason.INSUFFICIENT_LOADED_CLOSURE);
                }
            }
            DungeonUnitOfWorkResult commit = unitOfWork.commit(patch);
            if (commit instanceof DungeonUnitOfWorkResult.Rejected rejected) {
                return rejectedCommit(rejected.reason());
            }
            DungeonUnitOfWorkResult.Committed committed = (DungeonUnitOfWorkResult.Committed) commit;
            validateCommittedPatch(patch, committed);
            windowStore.invalidateChunks(committed.chunkRevisions().keySet());
            acceptedViewports.computeIfPresent(
                    mapId.value(),
                    (ignored, acceptedViewport) -> acceptedViewport.committed(committed.committedRevision()));
            editHistory.recordPatch(patch);
            return new OperationResultData(
                    snapshotData(workset, spec, patch),
                    true,
                    OPERATION_FEEDBACK_POLICY.validationMessages(current, candidate),
                    OPERATION_FEEDBACK_POLICY.reactionMessages(current, candidate),
                    DungeonEditorCommandOutcome.accepted(committed.committedRevision()));
            }
        }

        private LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshotData(
                DungeonCommandWorkset workset,
                DungeonCommandReadSpec spec,
                DungeonPatch patch
        ) {
            if (!workset.containsComplete(spec)) {
                throw new IllegalStateException("Dungeon surface projection requires the complete command workset");
            }
            DungeonMap commandScopedCandidate = patch.applyTo(workset.aggregateFor(spec));
            DungeonDerivedState derived = derive(commandScopedCandidate);
            return assembleDungeonSnapshot.execute(
                    commandScopedCandidate,
                    derived,
                    publishDungeonEditorHandles.execute(commandScopedCandidate));
        }

    }

    private DungeonCommandReadSpecs.AcceptedViewport acceptedViewport(
            @Nullable DungeonMapIdentity mapId,
            @Nullable DungeonEditorDungeonState state
    ) {
        if (mapId == null || state == null) {
            return null;
        }
        DungeonCommandReadSpecs.AcceptedViewport viewport = acceptedViewports.get(mapId.value());
        DungeonEditorSessionSnapshot.SurfaceData surface =
                state.committedFacts(new MapId(mapId.value())).surface();
        if (viewport == null
                || surface == null
                || surface.mapId() == null
                || surface.mapId().value() != mapId.value()
                || surface.acceptedRevision() != viewport.revision()
                || surface.requestGeneration() != viewport.requestGeneration()) {
            return null;
        }
        return viewport;
    }

    private static OperationResultData rejectedResult(
            DungeonEditorCommandOutcome.RejectionReason reason
    ) {
        return new OperationResultData(
                null,
                false,
                List.of(),
                List.of(),
                DungeonEditorCommandOutcome.rejected(reason));
    }

    private static DungeonEditorCommandOutcome.RejectionReason worksetRejection(
            DungeonCommandWorksetResult.Reason reason
    ) {
        return switch (reason) {
            case STALE_REVISION -> DungeonEditorCommandOutcome.RejectionReason.STALE_REVISION;
            case MAP_MISSING, ENTITY_MISSING -> DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET;
            case MALFORMED_ENTITY, INCOMPLETE_ENTITY ->
                    DungeonEditorCommandOutcome.RejectionReason.INSUFFICIENT_LOADED_CLOSURE;
        };
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

    private OperationResultData rejectedCommit(DungeonUnitOfWorkResult.Reason reason) {
        DungeonEditorCommandOutcome.RejectionReason rejectionReason = switch (reason) {
            case STALE_REVISION -> DungeonEditorCommandOutcome.RejectionReason.STALE_REVISION;
            case MAP_NOT_FOUND -> DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET;
        };
        return rejectedResult(rejectionReason);
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

    private static void validateCommittedCompoundPatch(
            DungeonCompoundPatch patch,
            DungeonCompoundUnitOfWorkResult.Committed committed
    ) {
        Objects.requireNonNull(patch, "patch");
        Objects.requireNonNull(committed, "committed");
        Map<DungeonMapIdentity, DungeonPatch> expectedByMap = new LinkedHashMap<>();
        for (DungeonPatch mapPatch : patch.patches()) {
            expectedByMap.put(mapPatch.mapId(), mapPatch);
        }
        Set<DungeonMapIdentity> returnedMapIds = new LinkedHashSet<>();
        long previousMapId = Long.MIN_VALUE;
        for (DungeonUnitOfWorkResult.Committed mapCommit : committed.committedMaps()) {
            if (mapCommit.mapId().value() <= previousMapId
                    || !returnedMapIds.add(mapCommit.mapId())) {
                throw new IllegalStateException("Dungeon compound unit of work returned unordered or duplicate maps");
            }
            previousMapId = mapCommit.mapId().value();
            DungeonPatch expected = expectedByMap.get(mapCommit.mapId());
            if (expected == null) {
                throw new IllegalStateException("Dungeon compound unit of work returned an unexpected map");
            }
            validateCommittedPatch(expected, mapCommit);
        }
        if (returnedMapIds.size() != expectedByMap.size()
                || !returnedMapIds.equals(expectedByMap.keySet())) {
            throw new IllegalStateException("Dungeon compound unit of work omitted a committed map");
        }
    }

    private void invalidateCommittedChunks(DungeonCompoundUnitOfWorkResult.Committed committed) {
        for (DungeonUnitOfWorkResult.Committed mapCommit : committed.committedMaps()) {
            windowStore.invalidateChunks(mapCommit.chunkRevisions().keySet());
        }
    }

    private static void closeLeases(List<DungeonWindowStore.Lease> leases) {
        for (int index = leases.size() - 1; index >= 0; index--) {
            leases.get(index).close();
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

        private ViewportLoadResult loadViewportWindow(
                MapId mapId,
                int projectionLevel,
                int minimumQ,
                int minimumR,
                int maximumQ,
                int maximumR,
                DungeonEditorDungeonState state
        ) {
            if (mapId == null || maximumQ < minimumQ || maximumR < minimumR) {
                return ViewportLoadResult.REJECTED;
            }
            DungeonViewportRequest requestedViewport = new DungeonViewportRequest(
                    mapId.value(),
                    0L,
                    projectionLevel,
                    minimumQ,
                    minimumR,
                    maximumQ,
                    maximumR);
            var requestedChunks = List.copyOf(requestedViewport.loadingChunks());
            DungeonMapHeader expectedHeader = catalogStore.find(domainMapId(mapId)).orElse(null);
            if (expectedHeader == null) {
                return ViewportLoadResult.REJECTED;
            }
            long generation = windowRequestGeneration.incrementAndGet();
            DungeonViewportRequest viewport = new DungeonViewportRequest(
                    mapId.value(),
                    generation,
                    projectionLevel,
                    minimumQ,
                    minimumR,
                    maximumQ,
                    maximumR);
            DungeonWindowRequest request = new DungeonWindowRequest(
                    domainMapId(mapId), generation, requestedChunks);
            DungeonWindow window = windowStore.loadWindow(request).orElse(null);
            if (window == null) {
                return ViewportLoadResult.REJECTED;
            }
            try {
                validateWindowResult(request, window);
            } catch (IllegalStateException invalidWindow) {
                return ViewportLoadResult.REJECTED;
            }
            long mapIdValue = mapId.value();
            if (generation != windowRequestGeneration.get()
                    || generation <= acceptedWindowRequestGeneration
                    || window.mapHeader().revision() != expectedHeader.revision()) {
                return ViewportLoadResult.REJECTED;
            }
            if (!publicationOperations.publishWindowSnapshot(
                    windowProjection.editorSnapshot(window, projectionLevel), state)) {
                return ViewportLoadResult.REJECTED;
            }
            acceptedViewports.put(
                    mapIdValue,
                    new DungeonCommandReadSpecs.AcceptedViewport(
                            window.mapHeader().mapId(),
                            window.mapHeader().revision(),
                            window.requestGeneration(),
                            projectionLevel,
                            minimumQ,
                            minimumR,
                            maximumQ,
                            maximumR,
                            request.chunkKeys()));
            windowStore.protectVisibleChunks(viewport.visibleChunks());
            acceptedWindowRequestGeneration = generation;
            return ViewportLoadResult.ACCEPTED;
        }

        private LoadDungeonSnapshotUseCase.@Nullable InspectorSnapshotData loadInspectorWithSelection(
                MapId mapId,
                DungeonTopologyRef topologyRef,
                long clusterId,
                boolean clusterSelection,
                DungeonEditorWorkspaceValues.HandleRef handleRef,
                DungeonEditorDungeonState state
        ) {
            if (mapId == null) {
                return null;
            }
            DungeonEditorWorkspaceValues.HandleRef safeHandle = handleRef == null
                    ? DungeonEditorWorkspaceValues.HandleRef.empty()
                    : handleRef;
            List<DungeonPatchEntityRef> seeds = inspectorSeeds(
                    topologyRef, clusterId, clusterSelection, safeHandle);
            Set<features.dungeon.api.DungeonChunkKey> chunks =
                    safeHandle.equals(DungeonEditorWorkspaceValues.HandleRef.empty())
                            ? Set.of()
                            : DungeonCommandReadSpecs.cellsWithRing(mapId.value(), List.of(safeHandle.cell()));
            LoadDungeonSnapshotUseCase.InspectorSnapshotData inspector = mutationPipeline.readCommand(
                    domainMapId(mapId),
                    state,
                    chunks,
                    seeds,
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND,
                    DungeonCommandReadSpec.CommandIntent.INSPECTOR,
                    null,
                    current -> inspectDungeonSelection.execute(
                            current,
                            derive(current),
                            topologyRef,
                            clusterId,
                            clusterSelection));
            publicationOperations.publishInspector(inspector, state);
            return inspector;
        }

        private List<DungeonPatchEntityRef> inspectorSeeds(
                @Nullable DungeonTopologyRef topologyRef,
                long clusterId,
                boolean clusterSelection,
                DungeonEditorWorkspaceValues.HandleRef handleRef
        ) {
            if (clusterSelection) {
                return entityRefs(clusterRef(clusterId));
            }
            DungeonTopologyRef ref = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
            var kind = ref.kind();
            if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.ROOM) {
                return entityRefs(roomRef(ref.id()));
            }
            if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.CORRIDOR) {
                return entityRefs(corridorRef(ref.id()));
            }
            if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.STAIR) {
                return entityRefs(stairRef(ref.id()));
            }
            if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.TRANSITION) {
                return entityRefs(transitionRef(ref.id()));
            }
            if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.FEATURE_MARKER) {
                return entityRefs(markerRef(ref.id()));
            }
            if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.CORRIDOR_ANCHOR) {
                return entityRefs(corridorRef(handleRef.corridorId()));
            }
            if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.DOOR
                    || kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.WALL) {
                return entityRefs(clusterRef(handleRef.clusterId() > 0L
                        ? handleRef.clusterId()
                        : clusterId));
            }
            return entityRefs(
                    corridorRef(handleRef.corridorId()),
                    stairRef(handleRef.kind() == DungeonEditorHandleKind.STAIR_ANCHOR
                            ? handleRef.ownerId()
                            : 0L),
                    clusterRef(handleRef.clusterId()),
                    roomRef(handleRef.roomId()));
        }
    }

    private enum ViewportLoadResult {
        ACCEPTED,
        REJECTED
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
                    session.dungeonState(),
                    corridorRouteChunks(mapId.value(), startEndpoint, endEndpoint),
                    corridorEndpointRefs(startEndpoint, endEndpoint),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                    current -> {
                        boolean crossLevel = !startEndpoint.sameLevelAs(endEndpoint);
                        int endpointRoomBound = roomIdentityBound(current, 2L);
                        int combinedRoomBound = positiveBound(endpointRoomBound * 2L);
                        CreateCorridorCommand.ReservedIdentities identities =
                                new CreateCorridorCommand.ReservedIdentities(
                                        reserve(DungeonIdentityKind.CORRIDOR, 1).firstId(),
                                        reserve(DungeonIdentityKind.CORRIDOR_ANCHOR, 2),
                                        crossLevel ? reserve(DungeonIdentityKind.STAIR, 1).firstId() : 0L,
                                        crossLevel
                                                ? reserve(
                                                        DungeonIdentityKind.STAIR_EXIT,
                                                        Math.abs(startEndpoint.level() - endEndpoint.level()) + 1)
                                                : null,
                                        reserve(DungeonIdentityKind.ROOM_CLUSTER, Math.max(2, combinedRoomBound)),
                                        reserve(DungeonIdentityKind.ROOM, Math.max(2, combinedRoomBound)));
                        return createCorridorCommand.plan(
                                current, identities, startEndpoint, endEndpoint);
                    });
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private void deleteCorridor(MapId mapId, CorridorDeletionTarget target, Session session) {
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    session.dungeonState(),
                    List.of(),
                    entityRefs(corridorRef(target == null ? 0L : target.corridorId())),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                    current -> deleteCorridorCommand.plan(current, target));
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private long createFeatureMarker(MapId mapId, FeatureMarkerKind kind, Cell anchor, Session session) {
            Objects.requireNonNull(mapId, "mapId");
            Objects.requireNonNull(kind, "kind");
            Objects.requireNonNull(anchor, "anchor");
            long[] markerId = {0L};
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    session.dungeonState(),
                    DungeonCommandReadSpecs.cellsWithRing(mapId.value(), List.of(anchor)),
                    List.of(),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                    current -> createFeatureMarkerCommand.plan(
                            current,
                            markerId[0] = identityAllocator.reserveFeatureMarkerId(),
                            kind,
                            anchor,
                            DEFAULT_LABEL,
                            DEFAULT_DESCRIPTION));
            publicationOperations.publishMutation(result, session.dungeonState());
            return result.changed() ? markerId[0] : 0L;
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
                    session.dungeonState(),
                    List.of(),
                    entityRefs(markerRef(markerId)),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                    current -> deleteFeatureMarkerCommand.plan(current, markerId));
            publicationOperations.publishMutation(result, session.dungeonState());
            return result.changed();
        }
    }

    private final class StairTransitionOperations {

        private void createStair(MapId mapId, StairGeometrySpec spec, Session session) {
            Objects.requireNonNull(mapId, "mapId");
            Objects.requireNonNull(spec, "spec");
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    session.dungeonState(),
                    DungeonCommandReadSpecs.cellsWithRing(
                            mapId.value(),
                            java.util.stream.Stream.concat(
                                            spec.generatedPath().stream(),
                                            spec.generatedExitCells().stream())
                                    .toList()),
                    List.of(),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                    current -> createStairCommand.plan(
                            current,
                            reserve(DungeonIdentityKind.STAIR, 1).firstId(),
                            reserve(DungeonIdentityKind.STAIR_EXIT, Math.max(1, spec.dimension2() + 1)),
                            spec));
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private boolean canCreateStair(MapId mapId, StairGeometrySpec spec, Session session) {
            if (mapId == null || spec == null || session == null) {
                return false;
            }
            Set<features.dungeon.api.DungeonChunkKey> chunks = DungeonCommandReadSpecs.cellsWithRing(
                    mapId.value(),
                    java.util.stream.Stream.concat(
                                    spec.generatedPath().stream(),
                                    spec.generatedExitCells().stream())
                            .toList());
            return mutationPipeline.readCommand(
                    domainMapId(mapId),
                    session.dungeonState(),
                    chunks,
                    List.of(),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                    DungeonCommandReadSpec.CommandIntent.INSPECTOR,
                    false,
                    current -> current.canCreateStair(spec));
        }

        private boolean deleteStair(MapId mapId, long stairId, Session session) {
            if (mapId == null || stairId <= 0L) {
                return false;
            }
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    session.dungeonState(),
                    List.of(),
                    entityRefs(stairRef(stairId)),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
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
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    session.dungeonState(),
                    DungeonCommandReadSpecs.cellsWithRing(
                            mapId.value(), anchor.cell() == null ? List.of() : List.of(anchor.cell())),
                    List.of(),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                    current -> createTransitionCommand.plan(
                            current,
                            identityAllocator.reserveTransitionId(),
                            anchor,
                            destination));
            publicationOperations.publishMutation(result, session.dungeonState());
        }

        private boolean canCreateTransition(
                MapId mapId,
                TransitionAnchor anchor,
                TransitionDestination destination,
                Session session
        ) {
            if (mapId == null || anchor == null || destination == null || session == null) {
                return false;
            }
            return mutationPipeline.readCommand(
                    domainMapId(mapId),
                    session.dungeonState(),
                    DungeonCommandReadSpecs.cellsWithRing(
                            mapId.value(), anchor.cell() == null ? List.of() : List.of(anchor.cell())),
                    List.of(),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND,
                    DungeonCommandReadSpec.CommandIntent.INSPECTOR,
                    false,
                    current -> current.transitionCatalog().canCreate(anchor, destination));
        }

        private boolean deleteTransition(MapId mapId, long transitionId, Session session) {
            if (mapId == null || transitionId <= 0L) {
                return false;
            }
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    session.dungeonState(),
                    List.of(),
                    entityRefs(transitionRef(transitionId)),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
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
            if (handleRef.clusterId() <= 0L) {
                publicationOperations.publishMutation(
                        rejectedResult(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET),
                        session.dungeonState());
                return;
            }
            Set<features.dungeon.api.DungeonChunkKey> chunks = DungeonCommandReadSpecs.movedCellWithRing(
                    mapId.value(),
                    handleRef.cell(),
                    safePreview.deltaQ(),
                    safePreview.deltaR(),
                    safePreview.deltaLevel());
            OperationResultData result = handleRef.kind() == DungeonEditorHandleKind.CLUSTER_CORNER
                    ? mutationPipeline.executePatchCommand(
                            domainMapId(mapId),
                            session.dungeonState(),
                            chunks,
                            List.of(DungeonPatchEntityRef.roomCluster(handleRef.clusterId())),
                            DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                            current -> {
                                int identityBound = roomIdentityBound(current, 1L);
                                return clusterCornerCommand.plan(
                                        current,
                                        handleRef.clusterId(),
                                        handleRef.cell(),
                                        safePreview.deltaQ(),
                                        safePreview.deltaR(),
                                        safePreview.deltaLevel(),
                                        reserve(DungeonIdentityKind.ROOM_CLUSTER, identityBound),
                                        reserve(DungeonIdentityKind.ROOM, identityBound));
                            })
                    : mutationPipeline.executePatchCommand(
                            domainMapId(mapId),
                            session.dungeonState(),
                            chunks,
                            List.of(DungeonPatchEntityRef.roomCluster(handleRef.clusterId())),
                            DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                            current -> moveConnectionHandleCommand.planCluster(
                                    current,
                                    handleRef.clusterId(),
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
            Edge movedEdge = sourceEdge(handleRef);
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    session.dungeonState(),
                    DungeonCommandReadSpecs.translatedEdgesWithRing(
                            mapId.value(),
                            List.of(movedEdge),
                            safePreview.deltaQ(),
                            safePreview.deltaR(),
                            safePreview.deltaLevel()),
                    entityRefs(
                            corridorRef(handleRef.corridorId()),
                            roomRef(handleRef.roomId()),
                            clusterRef(handleRef.clusterId())),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
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
                                handleRef.clusterId(),
                                Math.max(0L, handleRef.roomId()),
                                movedEdge,
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
                        session.dungeonState(),
                        DungeonCommandReadSpecs.movedCellWithRing(
                                mapId.value(),
                                handleRef.cell(),
                                safePreview.deltaQ(),
                                safePreview.deltaR(),
                                safePreview.deltaLevel()),
                        entityRefs(corridorRef(handleRef.corridorId())),
                        DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
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
                        session.dungeonState(),
                        DungeonCommandReadSpecs.movedCellWithRing(
                                mapId.value(),
                                handleRef.cell(),
                                safePreview.deltaQ(),
                                safePreview.deltaR(),
                                safePreview.deltaLevel()),
                        entityRefs(corridorRef(handleRef.corridorId())),
                        DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
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
                    session.dungeonState(),
                    DungeonCommandReadSpecs.movedCellWithRing(
                            mapId.value(),
                            handleRef.cell(),
                            safePreview.deltaQ(),
                            safePreview.deltaR(),
                            safePreview.deltaLevel()),
                    entityRefs(stairRef(handleRef.ownerId())),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
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
            List<Edge> sourceEdges = DungeonEditorWorkspaceGeometry.unitEdges(safePreview.sourceEdges());
            OperationResultData result = mutationPipeline.executePatchCommand(
                    domainMapId(mapId),
                    session.dungeonState(),
                    DungeonCommandReadSpecs.translatedEdgesWithRing(
                            mapId.value(),
                            sourceEdges,
                            safePreview.deltaQ(),
                            safePreview.deltaR(),
                            safePreview.deltaLevel()),
                    entityRefs(clusterRef(safePreview.clusterId())),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                    current -> {
                        int identityBound = roomIdentityBound(current, sourceEdges.size() * 2L);
                        return clusterBoundaryStretchCommand.plan(
                                current,
                                safePreview.clusterId(),
                                sourceEdges,
                                safePreview.deltaQ(),
                                safePreview.deltaR(),
                                safePreview.deltaLevel(),
                                reserve(DungeonIdentityKind.ROOM_CLUSTER, identityBound),
                                reserve(DungeonIdentityKind.ROOM, identityBound));
                    });
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
            return created.mapId();
        }

        private DungeonMapIdentity renameMap(DungeonMapIdentity mapIdentity, String requestedMapName) {
            String mapName = requestedMapName == null || requestedMapName.isBlank()
                    ? DEFAULT_MAP_NAME
                    : requestedMapName;
            DungeonMapHeader renamed = catalogStore.rename(mapIdentity, mapName);
            acceptedViewports.computeIfPresent(
                    mapIdentity.value(),
                    (ignored, viewport) -> viewport.committed(renamed.revision()));
            return renamed.mapId();
        }

        private DungeonMapIdentity deleteMap(DungeonMapIdentity mapIdentity) {
            catalogStore.delete(mapIdentity);
            windowStore.invalidateMap(mapIdentity.value());
            acceptedViewports.remove(mapIdentity.value());
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
                boolean bidirectional,
                DungeonEditorDungeonState state
        ) {
            if (sourceMapId == null
                    || targetMapId == null
                    || sourceTransitionId <= 0L
                    || targetTransitionId <= 0L
                    || state == null) {
                return null;
            }
            DungeonCommandReadSpecs.AcceptedViewport sourceViewport = acceptedViewport(sourceMapId, state);
            if (sourceViewport == null) {
                return rejectedResult(DungeonEditorCommandOutcome.RejectionReason.STALE_REVISION);
            }
            List<DungeonWindowStore.Lease> editLeases = new ArrayList<>();
            try {
            Map<Long, List<DungeonPatchEntityRef>> initialSeeds = new LinkedHashMap<>();
            initialSeeds.computeIfAbsent(sourceMapId.value(), ignored -> new ArrayList<>())
                    .add(transitionRef(sourceTransitionId));
            initialSeeds.computeIfAbsent(targetMapId.value(), ignored -> new ArrayList<>())
                    .add(transitionRef(targetTransitionId));
            Map<Long, LinkLoadedMap> loadedMaps = new LinkedHashMap<>();
            Map<Long, DungeonMap> pendingMaps = new LinkedHashMap<>();
            for (Map.Entry<Long, List<DungeonPatchEntityRef>> entry : initialSeeds.entrySet()) {
                DungeonMapIdentity mapId = new DungeonMapIdentity(entry.getKey());
                LinkLoadResult load = loadLinkMap(
                        mapId,
                        entry.getValue(),
                        mapId.equals(sourceMapId) ? sourceViewport : null,
                        editLeases);
                if (load.rejectionReason() != null) {
                    return rejectedResult(load.rejectionReason());
                }
                LinkLoadedMap loaded = Objects.requireNonNull(load.loaded(), "loaded transition-link workset");
                loadedMaps.put(entry.getKey(), loaded);
                pendingMaps.put(entry.getKey(), loaded.workset().aggregateFor(loaded.spec()));
            }
            Set<Long> knownMissingMapIds = new LinkedHashSet<>();
            DungeonCompoundCommandResult commandResult = transitionLinkCommand.plan(
                    pendingMaps.values(),
                    sourceMapId.value(),
                    sourceTransitionId,
                    targetMapId.value(),
                    targetTransitionId,
                    bidirectional,
                    knownMissingMapIds);
            while (commandResult instanceof DungeonCompoundCommandResult.RequiresMap requiresMap) {
                long mapId = requiresMap.mapId();
                if (loadedMaps.containsKey(mapId) || knownMissingMapIds.contains(mapId)) {
                    return rejectedResult(
                            DungeonEditorCommandOutcome.RejectionReason.INSUFFICIENT_LOADED_CLOSURE);
                }
                DungeonMapIdentity requiredIdentity = new DungeonMapIdentity(mapId);
                if (catalogStore.find(requiredIdentity).isEmpty()) {
                    knownMissingMapIds.add(mapId);
                } else {
                    List<DungeonPatchEntityRef> priorLinkSeeds = priorLinkSeeds(pendingMaps, mapId);
                    if (priorLinkSeeds.isEmpty()) {
                        return rejectedResult(
                                DungeonEditorCommandOutcome.RejectionReason.INSUFFICIENT_LOADED_CLOSURE);
                    }
                    LinkLoadResult load = loadLinkMap(requiredIdentity, priorLinkSeeds, null, editLeases);
                    if (load.rejectionReason() != null) {
                        return rejectedResult(load.rejectionReason());
                    }
                    LinkLoadedMap loaded = Objects.requireNonNull(load.loaded(), "loaded prior-link workset");
                    loadedMaps.put(mapId, loaded);
                    pendingMaps.put(mapId, loaded.workset().aggregateFor(loaded.spec()));
                }
                commandResult = transitionLinkCommand.plan(
                        pendingMaps.values(),
                        sourceMapId.value(),
                        sourceTransitionId,
                        targetMapId.value(),
                        targetTransitionId,
                        bidirectional,
                        knownMissingMapIds);
            }
            if (commandResult instanceof DungeonCompoundCommandResult.Rejected rejected) {
                return rejectedResult(rejected.reason());
            }
            DungeonCompoundCommandResult.Accepted accepted =
                    (DungeonCompoundCommandResult.Accepted) commandResult;
            DungeonCompoundPatch patch = accepted.patch();
            for (DungeonPatch mapPatch : patch.patches()) {
                if (!loadedMaps.containsKey(mapPatch.mapId().value())) {
                    return rejectedResult(
                            DungeonEditorCommandOutcome.RejectionReason.INSUFFICIENT_LOADED_CLOSURE);
                }
            }
            DungeonCompoundUnitOfWorkResult commit = unitOfWork.commit(patch);
            if (commit instanceof DungeonCompoundUnitOfWorkResult.Rejected rejected) {
                return rejectedCommit(rejected.reason());
            }
            DungeonCompoundUnitOfWorkResult.Committed committed =
                    (DungeonCompoundUnitOfWorkResult.Committed) commit;
            validateCommittedCompoundPatch(patch, committed);
            invalidateCommittedChunks(committed);
            for (DungeonPatch mapPatch : patch.patches()) {
                acceptedViewports.computeIfPresent(
                        mapPatch.mapId().value(),
                        (ignored, viewport) -> viewport.committed(mapPatch.committedRevision()));
            }
            editHistory.recordCompoundPatch(patch);
            DungeonPatch sourcePatch = patch.patches().stream()
                    .filter(candidate -> candidate.mapId().equals(sourceMapId))
                    .findFirst()
                    .orElse(null);
            LinkLoadedMap loadedSource = loadedMaps.get(sourceMapId.value());
            if (sourcePatch == null || loadedSource == null) {
                throw new IllegalStateException("Atomic transition link commit omitted the source map.");
            }
            return new OperationResultData(
                    mutationPipeline.snapshotData(
                            loadedSource.workset(), loadedSource.spec(), sourcePatch),
                    true,
                    List.of(),
                    List.of("transition link saved"),
                    DungeonEditorCommandOutcome.accepted(sourcePatch.committedRevision()));
            } finally {
                closeLeases(editLeases);
            }
        }

        private LinkLoadResult loadLinkMap(
                DungeonMapIdentity mapId,
                List<DungeonPatchEntityRef> seedRefs,
                DungeonCommandReadSpecs.AcceptedViewport viewport,
                List<DungeonWindowStore.Lease> editLeases
        ) {
            DungeonCommandReadSpec spec;
            if (viewport != null) {
                spec = DungeonCommandReadSpecs.forViewport(
                        viewport,
                        List.of(),
                        seedRefs,
                        DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                        DungeonCommandReadSpec.CommandIntent.TRANSITION_LINK);
            } else {
                DungeonMapHeader header = catalogStore.find(mapId).orElse(null);
                if (header == null) {
                    return LinkLoadResult.rejected(
                            DungeonEditorCommandOutcome.RejectionReason.MISSING_TRANSITION_DESTINATION);
                }
                spec = DungeonCommandReadSpecs.forHeader(
                        header,
                        windowRequestGeneration.incrementAndGet(),
                        List.of(),
                        seedRefs,
                        DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                        DungeonCommandReadSpec.CommandIntent.TRANSITION_LINK);
            }
            editLeases.add(windowStore.protectEditChunks(spec.chunkKeys()));
            DungeonCommandWorksetResult result = commandWorksetLoader.load(spec);
            if (result instanceof DungeonCommandWorksetResult.Rejected rejected) {
                return LinkLoadResult.rejected(transitionLinkWorksetRejection(rejected.reason()));
            }
            DungeonCommandWorkset workset = ((DungeonCommandWorksetResult.Complete) result).workset();
            return workset.containsComplete(spec)
                    ? LinkLoadResult.loaded(new LinkLoadedMap(workset, spec))
                    : LinkLoadResult.rejected(
                            DungeonEditorCommandOutcome.RejectionReason.INSUFFICIENT_LOADED_CLOSURE);
        }

        private DungeonEditorCommandOutcome.RejectionReason transitionLinkWorksetRejection(
                DungeonCommandWorksetResult.Reason reason
        ) {
            return switch (reason) {
                case STALE_REVISION -> DungeonEditorCommandOutcome.RejectionReason.STALE_REVISION;
                case MAP_MISSING, ENTITY_MISSING ->
                        DungeonEditorCommandOutcome.RejectionReason.MISSING_TRANSITION_DESTINATION;
                case MALFORMED_ENTITY, INCOMPLETE_ENTITY ->
                        DungeonEditorCommandOutcome.RejectionReason.INSUFFICIENT_LOADED_CLOSURE;
            };
        }

        private List<DungeonPatchEntityRef> priorLinkSeeds(
                Map<Long, DungeonMap> loadedMaps,
                long requiredMapId
        ) {
            List<DungeonPatchEntityRef> result = new ArrayList<>();
            for (DungeonMap loadedMap : loadedMaps.values()) {
                for (features.dungeon.domain.core.structure.transition.Transition transition
                        : loadedMap.transitionCatalog().transitions()) {
                    Long destinationTransitionId = transition.destination().transitionId();
                    if (transition.destination().isDungeonMap()
                            && transition.destination().mapId() == requiredMapId
                            && destinationTransitionId != null
                            && destinationTransitionId > 0L) {
                        result.add(transitionRef(destinationTransitionId));
                    }
                }
            }
            return result.stream().distinct().toList();
        }

        private record LinkLoadedMap(DungeonCommandWorkset workset, DungeonCommandReadSpec spec) { }

        private record LinkLoadResult(
                @Nullable LinkLoadedMap loaded,
                DungeonEditorCommandOutcome.RejectionReason rejectionReason
        ) {
            private static LinkLoadResult loaded(LinkLoadedMap loaded) {
                return new LinkLoadResult(Objects.requireNonNull(loaded, "loaded"), null);
            }

            private static LinkLoadResult rejected(
                    DungeonEditorCommandOutcome.RejectionReason reason
            ) {
                return new LinkLoadResult(null, Objects.requireNonNull(reason, "reason"));
            }
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
                    state,
                    List.of(),
                    entityRefs(roomRef(roomNarration.roomId())),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND,
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
                        state,
                        List.of(),
                        entityRefs(clusterRef(targetId)),
                        DungeonCommandReadSpec.DependencyExpansion.OUTBOUND,
                        current -> roomClusterNameCommand.plan(current, targetId, trimmedName));
                case ROOM -> mutationPipeline.executePatchCommand(
                        domainMapId(mapId),
                        state,
                        List.of(),
                        entityRefs(roomRef(targetId)),
                        DungeonCommandReadSpec.DependencyExpansion.OUTBOUND,
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
                    state,
                    List.of(),
                    entityRefs(transitionRef(transitionId)),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND,
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
                    state,
                    List.of(),
                    entityRefs(markerRef(markerId)),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND,
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
                    bidirectional,
                    state);
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
                    state,
                    stairGeometryChunks(mapId.value(), spec),
                    entityRefs(stairRef(stairId)),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                    current -> updateStairGeometryCommand.plan(
                            current,
                            stairId,
                            reserve(DungeonIdentityKind.STAIR_EXIT, Math.max(1, spec.dimension2() + 1)),
                            spec));
            publicationOperations.publishMutation(result, state);
        }

        private boolean canSaveStairGeometry(
                MapId mapId,
                long stairId,
                StairGeometrySpec spec,
                DungeonEditorDungeonState state
        ) {
            if (mapId == null || stairId <= 0L || spec == null) {
                return false;
            }
            return mutationPipeline.readCommand(
                    domainMapId(mapId),
                    state,
                    stairGeometryChunks(mapId.value(), spec),
                    entityRefs(stairRef(stairId)),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                    DungeonCommandReadSpec.CommandIntent.INSPECTOR,
                    false,
                    current -> current.canSaveStairGeometry(stairId, spec));
        }

        private @Nullable StairGeometrySpec stairGeometrySpec(
                MapId mapId,
                long stairId,
                StairShape shape,
                Direction direction,
                int dimension1,
                int dimension2,
                DungeonEditorDungeonState state
        ) {
            if (mapId == null || stairId <= 0L || shape == null || direction == null
                    || dimension1 <= 0 || dimension2 <= 0) {
                return null;
            }
            Cell anchor = mutationPipeline.readCommand(
                    domainMapId(mapId),
                    state,
                    List.of(),
                    entityRefs(stairRef(stairId)),
                    DungeonCommandReadSpec.DependencyExpansion.OUTBOUND,
                    DungeonCommandReadSpec.CommandIntent.INSPECTOR,
                    null,
                    current -> current.stairs().anchorOf(stairId));
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
            return detailSaveOperations.canSaveStairGeometry(mapId, stairId, spec, dungeonState);
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
                    dimension2,
                    dungeonState);
        }

        public void searchMaps(String query) {
            catalogOperations.searchMaps(query, dungeonState);
        }

        public boolean loadViewport(
                MapId mapId,
                int projectionLevel,
                int minimumQ,
                int minimumR,
                int maximumQ,
                int maximumR
        ) {
            return loadOperations.loadViewportWindow(
                    mapId,
                    projectionLevel,
                    minimumQ,
                    minimumR,
                    maximumQ,
                    maximumR,
                    dungeonState) == ViewportLoadResult.ACCEPTED;
        }

        public boolean refreshViewport(
                MapId mapId,
                int projectionLevel,
                int minimumQ,
                int minimumR,
                int maximumQ,
                int maximumR
        ) {
            return loadOperations.loadViewportWindow(
                    mapId,
                    projectionLevel,
                    minimumQ,
                    minimumR,
                    maximumQ,
                    maximumR,
                    dungeonState) == ViewportLoadResult.ACCEPTED;
        }

        public void loadInspectorWithSelection(
                MapId mapId,
                DungeonTopologyRef topologyRef,
                long clusterId,
                boolean clusterSelection,
                DungeonEditorWorkspaceValues.HandleRef handleRef
        ) {
            loadOperations.loadInspectorWithSelection(
                    mapId,
                    topologyRef,
                    clusterId,
                    clusterSelection,
                    handleRef,
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
