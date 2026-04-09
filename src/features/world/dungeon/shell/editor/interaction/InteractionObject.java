package features.world.dungeon.shell.editor.interaction;

import features.world.dungeon.application.stair.DungeonStairApplicationService;
import features.world.dungeon.application.stair.StairDraftResolver;
import features.world.dungeon.application.transition.DungeonTransitionApplicationService;
import features.world.dungeon.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeon.dungeonmap.api.DoorDescription;
import features.world.dungeon.dungeonmap.api.PreviewMovedClusterRequest;
import features.world.dungeon.dungeonmap.api.PreviewMovedLocalDoorRequest;
import features.world.dungeon.dungeonmap.api.PreviewReplacedCorridorRequest;
import features.world.dungeon.dungeonmap.api.PreviewReplacedStairRequest;
import features.world.dungeon.dungeonmap.api.ResolveCorridorRequest;
import features.world.dungeon.dungeonmap.application.DungeonMapApplicationService;
import features.world.dungeon.dungeonmap.application.DungeonMapLoadingService;
import features.world.dungeon.dungeonmap.cluster.application.ApplicationObject;
import features.world.dungeon.dungeonmap.cluster.application.input.ClusterDoorMoveRequest;
import features.world.dungeon.dungeonmap.cluster.application.input.ClusterMoveRequest;
import features.world.dungeon.dungeonmap.corridor.application.CorridorInputEditor;
import features.world.dungeon.dungeonmap.corridor.application.DungeonCorridorApplicationService;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.dungeonmap.state.DungeonMapState;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.shell.editor.interaction.input.ComposeInteractionInput;
import features.world.dungeon.shell.editor.interaction.input.EditorInteractionCapability;
import features.world.dungeon.shell.editor.interaction.input.EditorInteractionInput;
import features.world.dungeon.shell.editor.interaction.input.EditorTool;
import features.world.dungeon.shell.editor.interaction.input.EditorToolContext;
import features.world.dungeon.shell.editor.interaction.input.EditorToolPhase;
import features.world.dungeon.shell.editor.interaction.input.InteractionResultInput;
import features.world.dungeon.shell.editor.interaction.state.BoundaryTool;
import features.world.dungeon.shell.editor.interaction.state.CorridorTool;
import features.world.dungeon.shell.editor.interaction.state.DoorTool;
import features.world.dungeon.shell.editor.interaction.state.EditorInteraction;
import features.world.dungeon.shell.editor.interaction.state.FloorTool;
import features.world.dungeon.shell.editor.interaction.state.PaintTool;
import features.world.dungeon.shell.editor.interaction.state.StairTool;
import features.world.dungeon.shell.editor.interaction.state.TransitionTool;
import features.world.dungeon.shell.editor.interaction.tasks.EditorCapabilities;
import features.world.dungeon.shell.editor.statepane.StatePaneObject;
import features.world.dungeon.state.DungeonEditorSessionState;
import features.world.dungeon.state.DungeonEditorTool;
import features.world.dungeon.state.EditorInteractionState;
import features.world.dungeon.state.EditorPreview;
import javafx.scene.Node;
import ui.async.UiErrorReporter;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Public root owner object for dungeon editor interaction.
 */
@SuppressWarnings("unused")
public final class InteractionObject {

    private final InteractionResultInput interactionResult;

    public InteractionObject(ComposeInteractionInput input) {
        ComposeInteractionInput resolvedInput = Objects.requireNonNull(input, "input");
        DungeonMapState mapState = Objects.requireNonNull(resolvedInput.mapState(), "mapState");
        DungeonMapLoadingService loadingService = Objects.requireNonNull(resolvedInput.loadingService(), "loadingService");
        DungeonEditorSessionState sessionState = Objects.requireNonNull(resolvedInput.sessionState(), "sessionState");
        DungeonMapApplicationService mapApplicationService =
                Objects.requireNonNull(resolvedInput.mapApplicationService(), "mapApplicationService");
        ApplicationObject clusterApplicationService =
                Objects.requireNonNull(resolvedInput.clusterApplicationService(), "clusterApplicationService");
        DungeonCorridorApplicationService corridorApplicationService =
                Objects.requireNonNull(resolvedInput.corridorApplicationService(), "corridorApplicationService");
        DungeonStairApplicationService stairApplicationService =
                Objects.requireNonNull(resolvedInput.stairApplicationService(), "stairApplicationService");
        features.world.dungeon.shell.interaction.DungeonHitCollector hitCollector =
                Objects.requireNonNull(resolvedInput.hitCollector(), "hitCollector");
        EditorInteractionState interactionState =
                Objects.requireNonNull(resolvedInput.interactionState(), "interactionState");
        StatePaneObject statePaneObject = Objects.requireNonNull(resolvedInput.statePaneObject(), "statePaneObject");
        DungeonTransitionApplicationService transitionApplicationService =
                Objects.requireNonNull(resolvedInput.transitionApplicationService(), "transitionApplicationService");

        StairTool stairTool = new StairTool(
                mapState,
                loadingService,
                mapApplicationService,
                stairApplicationService,
                interactionState);

        List<EditorTool> editorTools = List.of(
                new SelectionEditorTool(
                        mapState,
                        loadingService,
                        mapApplicationService,
                        clusterApplicationService,
                        corridorApplicationService,
                        stairApplicationService,
                        statePaneObject,
                        stairTool,
                        interactionState),
                new PaintTool(
                        mapState,
                        loadingService,
                        sessionState,
                        clusterApplicationService,
                        interactionState),
                new FloorTool(
                        mapState,
                        loadingService,
                        sessionState,
                        clusterApplicationService,
                        interactionState),
                new BoundaryTool(
                        mapState,
                        loadingService,
                        sessionState,
                        clusterApplicationService,
                        interactionState),
                new DoorTool(
                        mapState,
                        loadingService,
                        clusterApplicationService,
                        interactionState),
                new CorridorTool(
                        mapState,
                        loadingService,
                        corridorApplicationService,
                        interactionState),
                stairTool,
                new TransitionTool(
                        mapState,
                        loadingService,
                        sessionState,
                        mapApplicationService,
                        transitionApplicationService,
                        interactionState));
        EditorInteraction editorInteraction = new EditorInteraction(
                mapState,
                sessionState,
                interactionState,
                hitCollector,
                editorTools);
        this.interactionResult = new InteractionResultInput(editorInteraction);
    }

    public InteractionResultInput editorInteraction(EditorInteractionInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return interactionResult;
    }

    public InteractionResultInput composeInteraction(ComposeInteractionInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return interactionResult;
    }

    private static final class SelectionEditorTool implements EditorTool {

        private final DungeonMapState mapState;
        private final DungeonMapLoadingService loadingService;
        private final DungeonMapApplicationService mapApplicationService;
        private final ApplicationObject roomApplicationService;
        private final DungeonCorridorApplicationService corridorApplicationService;
        private final DungeonStairApplicationService stairApplicationService;
        private final EditorInteractionState state;
        private final StatePaneObject statePaneObject;
        private final StairTool stairTool;

        private ClusterDragSession dragSession;
        private StairDragSession stairDragSession;
        private CorridorNodeDragSession corridorNodeDragSession;
        private CorridorTileDragSession corridorTileDragSession;
        private DoorDragSession doorDragSession;
        private DungeonEditorTool activeTool;
        private Runnable refreshCallback = () -> { };
        private DungeonSelectionRef previousNarrationSelectionRef;
        private DungeonMap previousNarrationMap;
        private int previousNarrationLevel = Integer.MIN_VALUE;

        private SelectionEditorTool(
                DungeonMapState mapState,
                DungeonMapLoadingService loadingService,
                DungeonMapApplicationService mapApplicationService,
                ApplicationObject roomApplicationService,
                DungeonCorridorApplicationService corridorApplicationService,
                DungeonStairApplicationService stairApplicationService,
                StatePaneObject statePaneObject,
                StairTool stairTool,
                EditorInteractionState state
        ) {
            this.mapState = Objects.requireNonNull(mapState, "mapState");
            this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
            this.mapApplicationService = Objects.requireNonNull(mapApplicationService, "mapApplicationService");
            this.roomApplicationService = Objects.requireNonNull(roomApplicationService, "roomApplicationService");
            this.corridorApplicationService = Objects.requireNonNull(corridorApplicationService, "corridorApplicationService");
            this.stairApplicationService = Objects.requireNonNull(stairApplicationService, "stairApplicationService");
            this.statePaneObject = Objects.requireNonNull(statePaneObject, "statePaneObject");
            this.stairTool = Objects.requireNonNull(stairTool, "stairTool");
            this.state = Objects.requireNonNull(state, "state");
            this.state.addListener(this::refreshNarrationContext);
            this.mapState.addListener(this::refreshNarrationContext);
        }

        @Override
        public Set<DungeonEditorTool> supportedTools() {
            return Set.of(DungeonEditorTool.SELECT);
        }

        @Override
        public void activate(DungeonEditorTool tool) {
            activeTool = tool;
            previousNarrationSelectionRef = null;
            previousNarrationMap = null;
            previousNarrationLevel = Integer.MIN_VALUE;
            refreshStatePane();
        }

        @Override
        public void deactivate() {
            activeTool = null;
            clear();
            refreshStatePane();
        }

        @Override
        public boolean pressed(EditorToolContext ctx) {
            DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
            if (event == null || !event.isPrimaryButton()) {
                clear();
                return false;
            }
            DungeonSelectionRef hit = ctx == null ? null : ctx.hitRef();
            DungeonSelectionRef resolvedSelectionRef = ctx == null ? null : ctx.resolvedRef();
            clear();
            if (hit instanceof DungeonSelectionRef.StairRef stairRef) {
                state.selectRef(resolvedSelectionRef);
                focusSelectedStair(ctx);
                StairDragSourceSnapshot stairDragSource = stairDragSource();
                if (stairDragSource != null && Objects.equals(stairDragSource.stairId(), stairRef.stairId())) {
                    stairDragSession = StairDragSession.start(
                            stairDragSource.stairId(),
                            mapState.activeMap(),
                            stairDragSource.draft(),
                            event.gridCell(),
                            mapState.activeProjectionLevel());
                }
                return true;
            }
            if (hit instanceof DungeonSelectionRef.CorridorNodeRef corridorNodeHit
                    && corridorNodeHit.corridorId() != null
                    && corridorNodeHit.nodeId() != null) {
                state.selectRef(resolvedSelectionRef);
                corridorNodeDragSession = new CorridorNodeDragSession(
                        corridorNodeHit.corridorId(),
                        corridorNodeHit.nodeId(),
                        corridorNodeHit.point(),
                        corridorNodeHit.point());
                return true;
            }
            if (hit instanceof DungeonSelectionRef.CorridorTileRef corridorTileHit
                    && corridorTileHit.corridorId() != null) {
                state.selectRef(resolvedSelectionRef);
                corridorTileDragSession = new CorridorTileDragSession(
                        corridorTileHit.corridorId(),
                        corridorTileHit.cell(),
                        corridorTileHit.point(),
                        corridorTileHit.point());
                return true;
            }
            if (hit instanceof DungeonSelectionRef.DoorRef doorHit) {
                state.selectRef(resolvedSelectionRef == null ? doorHit : resolvedSelectionRef);
                doorDragSession = DoorDragSession.start(
                        mapState.activeMap(),
                        mapState.activeProjectionLevel(),
                        doorHit);
                return true;
            }
            if (hit instanceof DungeonSelectionRef.ClusterRef clusterLabelHit) {
                state.selectRef(resolvedSelectionRef);
                dragSession = ClusterDragSession.start(
                        clusterLabelHit.clusterId(),
                        mapState.activeMap(),
                        event.gridCell(),
                        mapState.activeProjectionLevel());
                return true;
            }
            if (hit instanceof DungeonSelectionRef.TransitionRef) {
                state.selectRef(resolvedSelectionRef);
                return true;
            }
            if (resolvedSelectionRef != null && mapState.activeMap().ownerRef(resolvedSelectionRef) != null) {
                state.selectRef(resolvedSelectionRef);
                return true;
            }
            state.clearSelection();
            return false;
        }

        @Override
        public boolean dragged(EditorToolContext ctx) {
            DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
            if (stairDragSession != null) {
                if (event == null || !event.isPrimaryButtonDown()) {
                    return false;
                }
                GridTranslation translation = dragTranslation(event.gridCell(), stairDragSession.pressCell());
                if (Objects.equals(translation, stairDragSession.currentDelta())) {
                    return true;
                }
                stairDragSession = stairDragSession.withCurrentDelta(translation);
                DungeonMap preview = previewStairMap(stairDragSession);
                if (preview == null) {
                    state.clearPreview();
                } else {
                    state.showPreview(new EditorPreview.LayoutPreview(preview));
                }
                return true;
            }
            if (doorDragSession != null) {
                if (event == null || !event.isPrimaryButtonDown()) {
                    return false;
                }
                DungeonSelectionRef.RoomBoundaryRef targetBoundaryRef = currentDoorTargetRef(ctx, doorDragSession);
                if (Objects.equals(targetBoundaryRef, doorDragSession.targetBoundaryRef())) {
                    return true;
                }
                doorDragSession = doorDragSession.withTargetBoundaryRef(targetBoundaryRef);
                DungeonMap preview = previewDoorMap(doorDragSession);
                if (preview == null) {
                    state.clearPreview();
                } else {
                    state.showPreview(new EditorPreview.LayoutPreview(preview));
                }
                return true;
            }
            if (corridorNodeDragSession != null) {
                if (event == null || !event.isPrimaryButtonDown()) {
                    return false;
                }
                GridPoint point2x = ctx == null || ctx.probe() == null
                        ? event.gridCell()
                        : ctx.probe().probePoint();
                if (Objects.equals(point2x, corridorNodeDragSession.currentPoint())) {
                    return true;
                }
                corridorNodeDragSession = corridorNodeDragSession.withCurrentPoint(point2x);
                state.showPreview(new EditorPreview.LayoutPreview(previewCorridorMap()));
                return true;
            }
            if (corridorTileDragSession != null) {
                if (event == null || !event.isPrimaryButtonDown()) {
                    return false;
                }
                GridPoint point2x = ctx == null || ctx.probe() == null
                        ? event.gridCell()
                        : ctx.probe().probePoint();
                if (Objects.equals(point2x, corridorTileDragSession.currentPoint())) {
                    return true;
                }
                corridorTileDragSession = corridorTileDragSession.withCurrentPoint(point2x);
                state.showPreview(new EditorPreview.LayoutPreview(previewCorridorTileMap()));
                return true;
            }
            if (dragSession == null || event == null || !event.isPrimaryButtonDown()) {
                return false;
            }
            GridTranslation translation = dragTranslation(event.gridCell(), dragSession.pressCell());
            if (Objects.equals(translation, dragSession.currentDelta())) {
                return true;
            }
            dragSession = dragSession.withCurrentDelta(translation);
            state.showPreview(new EditorPreview.LayoutPreview(previewMap()));
            return true;
        }

        @Override
        public boolean released(EditorToolContext ctx) {
            DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
            if (stairDragSession != null) {
                StairDragSession current = stairDragSession;
                stairDragSession = null;
                state.clearPreview();
                commitStairMove(current);
                return true;
            }
            if (doorDragSession != null) {
                DoorDragSession current = doorDragSession.withTargetBoundaryRef(currentDoorTargetRef(ctx, doorDragSession));
                doorDragSession = null;
                state.clearPreview();
                commitDoorMove(current);
                return true;
            }
            if (corridorNodeDragSession != null) {
                CorridorNodeDragSession current = corridorNodeDragSession;
                corridorNodeDragSession = null;
                state.clearPreview();
                Long mapId = mapState.activeMapId();
                if (!Objects.equals(current.startPoint(), current.currentPoint()) && mapId != null) {
                    loadingService.submitMutation(
                            () -> {
                                corridorApplicationService.moveNode(new DungeonCorridorApplicationService.MoveCorridorNodeRequest(
                                        mapId,
                                        current.corridorId(),
                                        current.nodeId(),
                                        current.currentPoint()));
                                return mapId;
                            },
                            updatedMapId -> updatedMapId,
                            ignored -> state.selectRef(corridorNodeRef(
                                    current.corridorId(),
                                    current.nodeId(),
                                    current.currentPoint())),
                            throwable -> UiErrorReporter.reportBackgroundFailure("SelectionEditorTool.released()", throwable));
                }
                return true;
            }
            if (corridorTileDragSession != null) {
                CorridorTileDragSession current = corridorTileDragSession;
                corridorTileDragSession = null;
                state.clearPreview();
                Long mapId = mapState.activeMapId();
                if (!Objects.equals(current.startPoint(), current.currentPoint()) && mapId != null) {
                    loadingService.submitMutation(
                            () -> {
                                corridorApplicationService.promoteTileNodeAndMove(
                                        new DungeonCorridorApplicationService.PromoteCorridorTileNodeRequest(
                                                mapId,
                                                current.corridorId(),
                                                mapState.activeProjectionLevel(),
                                                current.tileCell(),
                                                current.currentPoint()));
                                return mapId;
                            },
                            updatedMapId -> updatedMapId,
                            ignored -> state.selectRef(new DungeonSelectionRef.CorridorRef(current.corridorId())),
                            throwable -> UiErrorReporter.reportBackgroundFailure("SelectionEditorTool.released()", throwable));
                }
                return true;
            }
            if (dragSession == null || event == null) {
                return false;
            }
            GridTranslation translation = dragSession.currentDelta()
                    .combinedWith(GridTranslation.levels(dragSession.currentLevel() - dragSession.startLevel()));
            Long mapId = dragSession.baseMap().mapId() > 0 ? dragSession.baseMap().mapId() : null;
            Long clusterId = dragSession.clusterId();
            state.clearPreview();
            dragSession = null;
            if (mapId != null && clusterId != null && !translation.isZero()) {
                loadingService.submitMutation(
                        () -> {
                            roomApplicationService.moveCluster(new ClusterMoveRequest(
                                    mapId,
                                    clusterId,
                                    translation));
                            return mapId;
                        },
                        updatedMapId -> updatedMapId,
                        ignored -> {
                        },
                        throwable -> UiErrorReporter.reportBackgroundFailure("SelectionEditorTool.released()", throwable));
            }
            return true;
        }

        @Override
        public List<EditorInteractionCapability> interactionCapabilities(EditorToolContext ctx, EditorToolPhase phase) {
            if (activeTool != DungeonEditorTool.SELECT) {
                return List.of();
            }
            return List.of(
                    EditorCapabilities.part(candidate ->
                            doorDragSession != null
                                    && candidate instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundaryRef
                                    && isValidDoorTarget(roomBoundaryRef, doorDragSession)),
                    EditorCapabilities.owner(ref -> ref instanceof DungeonSelectionRef.StairRef),
                    EditorCapabilities.part(candidate ->
                            candidate instanceof DungeonSelectionRef.CorridorNodeRef
                                    || candidate instanceof DungeonSelectionRef.CorridorTileRef
                                    || candidate instanceof DungeonSelectionRef.DoorRef),
                    EditorCapabilities.owner(SelectionEditorTool::isRelevantRef));
        }

        @Override
        public void levelScrolled(int delta) {
            if (stairDragSession != null && delta != 0) {
                stairDragSession = stairDragSession.withCurrentLevel(stairDragSession.currentLevel() + delta);
                DungeonMap preview = previewStairMap(stairDragSession);
                if (preview == null) {
                    state.clearPreview();
                } else {
                    state.showPreview(new EditorPreview.LayoutPreview(preview));
                }
                return;
            }
            if (dragSession == null || delta == 0) {
                return;
            }
            int nextLevel = dragSession.currentLevel() + delta;
            dragSession = dragSession.withCurrentLevel(nextLevel);
            state.showPreview(new EditorPreview.LayoutPreview(previewMap()));
        }

        @Override
        public Node statePaneContent() {
            if (activeTool != DungeonEditorTool.SELECT) {
                return null;
            }
            if (state.selectedRef() instanceof DungeonSelectionRef.StairRef) {
                return sharedStairPaneContent();
            }
            return statePaneObject;
        }

        @Override
        public void setRefreshCallback(Runnable callback) {
            refreshCallback = callback == null ? () -> { } : callback;
        }

        private void refreshStatePane() {
            refreshCallback.run();
        }

        private void refreshNarrationContext() {
            DungeonSelectionRef selectedRef = state.selectedRef();
            DungeonMap activeMap = mapState.activeMap();
            int projectionLevel = mapState.activeProjectionLevel();
            if (Objects.equals(selectedRef, previousNarrationSelectionRef)
                    && activeMap == previousNarrationMap
                    && projectionLevel == previousNarrationLevel) {
                return;
            }
            previousNarrationSelectionRef = selectedRef;
            previousNarrationMap = activeMap;
            previousNarrationLevel = projectionLevel;
            refreshStatePane();
        }

        private void clear() {
            dragSession = null;
            stairDragSession = null;
            corridorNodeDragSession = null;
            corridorTileDragSession = null;
            doorDragSession = null;
            state.clearPreview();
        }

        private static boolean isRelevantRef(DungeonSelectionRef ref) {
            return ref instanceof DungeonSelectionRef.CorridorNodeRef
                    || ref instanceof DungeonSelectionRef.CorridorTileRef
                    || ref instanceof DungeonSelectionRef.ClusterRef
                    || ref instanceof DungeonSelectionRef.RoomRef
                    || ref instanceof DungeonSelectionRef.RoomBoundaryRef
                    || ref instanceof DungeonSelectionRef.DoorRef
                    || ref instanceof DungeonSelectionRef.CorridorRef
                    || ref instanceof DungeonSelectionRef.StairRef
                    || ref instanceof DungeonSelectionRef.TransitionRef;
        }

        private static DungeonSelectionRef corridorNodeRef(long corridorId, Long nodeId, GridPoint point2x) {
            return new DungeonSelectionRef.CorridorNodeRef(corridorId, nodeId, point2x);
        }

        private void commitDoorMove(DoorDragSession session) {
            if (session == null
                    || session.targetBoundaryRef() == null
                    || Objects.equals(session.sourceBoundarySegment2x(), session.targetBoundaryRef().boundarySegment())) {
                return;
            }
            Long mapId = mapState.activeMapId();
            if (mapId == null) {
                return;
            }
            if (session.clusterId() != null) {
                commitLocalDoorMove(mapId, session);
            } else if (session.corridorId() != null) {
                commitCorridorDoorMove(mapId, session);
            }
        }

        private void commitStairMove(StairDragSession session) {
            if (session == null) {
                return;
            }
            GridTranslation translation = session.currentDelta()
                    .combinedWith(GridTranslation.levels(session.currentLevel() - session.startLevel()));
            Long mapId = session.baseMap().mapId() > 0 ? session.baseMap().mapId() : null;
            DungeonStairApplicationService.StairDraft movedDraft = movedStairDraft(session);
            if (mapId == null
                    || movedDraft == null
                    || translation.isZero()
                    || previewStairMap(session) == null) {
                return;
            }
            loadingService.submitMutation(
                    () -> {
                        stairApplicationService.moveStair(new DungeonStairApplicationService.MoveStairRequest(
                                mapId,
                                session.stairId(),
                                session.baseDraft(),
                                translation));
                        return mapId;
                    },
                    updatedMapId -> updatedMapId,
                    ignored -> {
                        adoptMovedStairDraft(session.stairId(), movedDraft);
                        state.selectRef(new DungeonSelectionRef.StairRef(session.stairId()));
                    },
                    throwable -> UiErrorReporter.reportBackgroundFailure("SelectionEditorTool.commitStairMove()", throwable));
        }

        private DungeonMap previewMap() {
            if (dragSession == null) {
                return null;
            }
            return mapApplicationService.previewMovedCluster(new PreviewMovedClusterRequest(
                    dragSession.baseMap(),
                    dragSession.clusterId(),
                    dragSession.currentDelta()
                            .combinedWith(GridTranslation.levels(dragSession.currentLevel() - dragSession.startLevel()))));
        }

        private DungeonMap previewStairMap(StairDragSession session) {
            if (session == null || session.baseMap() == null || session.baseMap().mapId() <= 0) {
                return null;
            }
            DungeonStairApplicationService.StairDraft movedDraft = movedStairDraft(session);
            if (movedDraft == null) {
                return null;
            }
            try {
                return mapApplicationService.previewReplacedStair(new PreviewReplacedStairRequest(
                                session.baseMap(),
                                StairDraftResolver.resolvePreview(
                                        session.baseMap(),
                                        session.stairId(),
                                        session.baseMap().mapId(),
                                        movedDraft)))
                        .projectedToLevel(session.currentLevel());
            } catch (IllegalArgumentException ignored) {
                return null;
            }
        }

        private DungeonMap previewCorridorMap() {
            if (corridorNodeDragSession == null) {
                return null;
            }
            Corridor corridor = mapState.activeMap().findCorridor(corridorNodeDragSession.corridorId());
            if (corridor == null) {
                return null;
            }
            Corridor updated = mapApplicationService.resolveCorridor(new ResolveCorridorRequest(
                    mapState.activeMap(),
                    CorridorInputEditor.moveNode(
                            corridor.input(),
                            corridorNodeDragSession.nodeId(),
                            corridorNodeDragSession.currentPoint())));
            return mapApplicationService.previewReplacedCorridor(
                            new PreviewReplacedCorridorRequest(mapState.activeMap(), updated))
                    .projectedToLevel(mapState.activeProjectionLevel());
        }

        private DungeonMap previewDoorMap(DoorDragSession session) {
            if (session == null || session.targetBoundaryRef() == null) {
                return null;
            }
            if (session.clusterId() != null) {
                return previewLocalDoorMap(session);
            }
            if (session.corridorId() != null) {
                return previewCorridorDoorMap(session);
            }
            return null;
        }

        private DungeonMap previewCorridorTileMap() {
            if (corridorTileDragSession == null) {
                return null;
            }
            Corridor corridor = mapState.activeMap().findCorridor(corridorTileDragSession.corridorId());
            if (corridor == null) {
                return null;
            }
            Long segmentId = corridor.segmentIdAtCell(corridorTileDragSession.tileCell());
            var insertedInput = CorridorInputEditor.insertNodeOnSegment(
                    corridor.input(),
                    segmentId,
                    corridorTileDragSession.tileCell());
            Long nodeId = insertedInput.nodes().stream()
                    .filter(node -> node != null
                            && !node.isDoorBound()
                            && Objects.equals(node.fixedPoint(), corridorTileDragSession.tileCell()))
                    .map(features.world.dungeon.dungeonmap.corridor.model.CorridorInputNode::nodeId)
                    .findFirst()
                    .orElse(null);
            Corridor updated = mapApplicationService.resolveCorridor(new ResolveCorridorRequest(
                    mapState.activeMap(),
                    CorridorInputEditor.moveNode(
                            insertedInput,
                            nodeId,
                            corridorTileDragSession.currentPoint())));
            return mapApplicationService.previewReplacedCorridor(
                            new PreviewReplacedCorridorRequest(mapState.activeMap(), updated))
                    .projectedToLevel(mapState.activeProjectionLevel());
        }

        private DungeonMap previewLocalDoorMap(DoorDragSession session) {
            if (session == null
                    || session.clusterId() == null
                    || session.targetBoundaryRef() == null
                    || session.baseMap() == null) {
                return null;
            }
            return mapApplicationService.previewMovedLocalDoor(new PreviewMovedLocalDoorRequest(
                            session.baseMap(),
                            session.clusterId(),
                            session.levelZ(),
                            session.sourceBoundarySegment2x(),
                            session.targetBoundaryRef().boundarySegment()))
                    .projectedToLevel(session.levelZ());
        }

        private DungeonMap previewCorridorDoorMap(DoorDragSession session) {
            if (session == null
                    || session.corridorId() == null
                    || session.targetBoundaryRef() == null
                    || session.baseMap() == null) {
                return null;
            }
            Corridor corridor = session.baseMap().findCorridor(session.corridorId());
            DungeonSelectionRef.DoorRef targetDoorRef = session.baseMap().doorSelectionRefAt(
                    session.levelZ(),
                    session.targetBoundaryRef().boundarySegment());
            if (corridor == null
                    || session.baseMap().existingExteriorRoomDoor(
                    session.targetBoundaryRef(),
                    session.levelZ()) == null
                    || targetDoorRef == null) {
                return null;
            }
            try {
                Corridor updated = mapApplicationService.resolveCorridor(new ResolveCorridorRequest(
                        session.baseMap(),
                        CorridorInputEditor.moveDoorAtBoundary(
                                corridor,
                                session.sourceBoundarySegment2x(),
                                new DoorRef(targetDoorRef.doorId()))));
                return mapApplicationService.previewReplacedCorridor(
                                new PreviewReplacedCorridorRequest(session.baseMap(), updated))
                        .projectedToLevel(session.levelZ());
            } catch (IllegalArgumentException ignored) {
                return null;
            }
        }

        private void commitLocalDoorMove(Long mapId, DoorDragSession session) {
            if (session == null || session.clusterId() == null || previewLocalDoorMap(session) == null) {
                return;
            }
            loadingService.submitMutation(
                    () -> {
                        roomApplicationService.moveDoor(new ClusterDoorMoveRequest(
                                mapId,
                                session.clusterId(),
                                session.levelZ(),
                                session.sourceBoundarySegment2x(),
                                session.targetBoundaryRef().boundarySegment()));
                        return mapId;
                    },
                    updatedMapId -> updatedMapId,
                    ignored -> state.selectRef(session.baseMap().doorSelectionRefAt(
                            session.levelZ(),
                            session.targetBoundaryRef().boundarySegment())),
                    throwable -> UiErrorReporter.reportBackgroundFailure("SelectionEditorTool.commitLocalDoorMove()", throwable));
        }

        private void commitCorridorDoorMove(Long mapId, DoorDragSession session) {
            if (session == null || session.corridorId() == null || previewCorridorDoorMap(session) == null) {
                return;
            }
            DungeonSelectionRef.DoorRef targetDoorRef = session.baseMap().doorSelectionRefAt(
                    session.levelZ(),
                    session.targetBoundaryRef().boundarySegment());
            if (session.baseMap().existingExteriorRoomDoor(
                    session.targetBoundaryRef(),
                    session.levelZ()) == null
                    || targetDoorRef == null) {
                return;
            }
            loadingService.submitMutation(
                    () -> {
                        corridorApplicationService.moveDoor(new DungeonCorridorApplicationService.MoveCorridorDoorRequest(
                                mapId,
                                session.corridorId(),
                                session.sourceBoundarySegment2x(),
                                new DoorRef(targetDoorRef.doorId())));
                        return mapId;
                    },
                    updatedMapId -> updatedMapId,
                    ignored -> state.selectRef(session.baseMap().doorSelectionRefAt(
                            session.levelZ(),
                            session.targetBoundaryRef().boundarySegment())),
                    throwable -> UiErrorReporter.reportBackgroundFailure("SelectionEditorTool.commitCorridorDoorMove()", throwable));
        }

        private DungeonStairApplicationService.StairDraft movedStairDraft(StairDragSession session) {
            if (session == null) {
                return null;
            }
            return StairDraftResolver.shiftedDraft(
                    session.baseDraft(),
                    session.currentDelta()
                            .combinedWith(GridTranslation.levels(session.currentLevel() - session.startLevel())));
        }

        private DungeonSelectionRef.RoomBoundaryRef currentDoorTargetRef(
                EditorToolContext ctx,
                DoorDragSession session
        ) {
            if (ctx == null || session == null || !(ctx.hitRef() instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundaryRef)) {
                return null;
            }
            return isValidDoorTarget(roomBoundaryRef, session) ? roomBoundaryRef : null;
        }

        private boolean isValidDoorTarget(
                DungeonSelectionRef.RoomBoundaryRef roomBoundaryRef,
                DoorDragSession session
        ) {
            if (roomBoundaryRef == null || session == null) {
                return false;
            }
            return previewDoorMap(session.withTargetBoundaryRef(roomBoundaryRef)) != null;
        }

        private static GridTranslation dragTranslation(GridPoint currentCell, GridPoint startCell) {
            return GridTranslation.betweenCells(startCell, currentCell);
        }

        private boolean focusSelectedStair(EditorToolContext ctx) {
            Object result = invokeStairToolMethod("focusSelectedStair", new Class<?>[]{EditorToolContext.class}, ctx);
            return result instanceof Boolean value && value;
        }

        private StairDragSourceSnapshot stairDragSource() {
            Object dragSource = invokeStairToolMethod("stairDragSource", new Class<?>[0]);
            if (dragSource == null) {
                return null;
            }
            Object stairIdValue = invokeDeclaredMethod(dragSource, "stairId", new Class<?>[0]);
            Object draftValue = invokeDeclaredMethod(dragSource, "draft", new Class<?>[0]);
            if (!(stairIdValue instanceof Long stairId)
                    || !(draftValue instanceof DungeonStairApplicationService.StairDraft draft)) {
                throw new IllegalStateException("SelectionEditorTool.stairDragSource(): unexpected drag source payload");
            }
            return new StairDragSourceSnapshot(stairId, draft);
        }

        private Node sharedStairPaneContent() {
            Object result = invokeStairToolMethod("sharedStairPaneContent", new Class<?>[0]);
            return result instanceof Node node ? node : null;
        }

        private void adoptMovedStairDraft(long stairId, DungeonStairApplicationService.StairDraft draft) {
            invokeStairToolMethod(
                    "adoptMovedStairDraft",
                    new Class<?>[]{long.class, DungeonStairApplicationService.StairDraft.class},
                    stairId,
                    draft);
        }

        private Object invokeStairToolMethod(String name, Class<?>[] parameterTypes, Object... args) {
            return invokeDeclaredMethod(stairTool, name, parameterTypes, args);
        }

        private static Object invokeDeclaredMethod(Object target, String name, Class<?>[] parameterTypes, Object... args) {
            try {
                Method method = target.getClass().getDeclaredMethod(name, parameterTypes);
                method.setAccessible(true);
                return method.invoke(target, args);
            } catch (ReflectiveOperationException exception) {
                throw new IllegalStateException(
                        "SelectionEditorTool." + name + "(): failed to invoke " + target.getClass().getSimpleName(),
                        exception);
            }
        }

        private record StairDragSourceSnapshot(
                long stairId,
                DungeonStairApplicationService.StairDraft draft
        ) {
        }

        private record ClusterDragSession(
                Long clusterId,
                DungeonMap baseMap,
                GridPoint pressCell,
                GridTranslation currentDelta,
                int startLevel,
                int currentLevel
        ) {
            private ClusterDragSession withCurrentDelta(GridTranslation translation) {
                return new ClusterDragSession(clusterId, baseMap, pressCell, translation, startLevel, currentLevel);
            }

            private ClusterDragSession withCurrentLevel(int nextLevel) {
                return new ClusterDragSession(clusterId, baseMap, pressCell, currentDelta, startLevel, nextLevel);
            }

            private static ClusterDragSession start(
                    Long clusterId,
                    DungeonMap baseMap,
                    GridPoint pressCell,
                    int startLevel
            ) {
                return new ClusterDragSession(clusterId, baseMap, pressCell, GridTranslation.none(), startLevel, startLevel);
            }
        }

        private record StairDragSession(
                long stairId,
                DungeonMap baseMap,
                DungeonStairApplicationService.StairDraft baseDraft,
                GridPoint pressCell,
                GridTranslation currentDelta,
                int startLevel,
                int currentLevel
        ) {
            private StairDragSession withCurrentDelta(GridTranslation translation) {
                return new StairDragSession(stairId, baseMap, baseDraft, pressCell, translation, startLevel, currentLevel);
            }

            private StairDragSession withCurrentLevel(int nextLevel) {
                return new StairDragSession(stairId, baseMap, baseDraft, pressCell, currentDelta, startLevel, nextLevel);
            }

            private static StairDragSession start(
                    long stairId,
                    DungeonMap baseMap,
                    DungeonStairApplicationService.StairDraft baseDraft,
                    GridPoint pressCell,
                    int startLevel
            ) {
                return new StairDragSession(
                        stairId,
                        baseMap,
                        baseDraft,
                        pressCell,
                        GridTranslation.none(),
                        startLevel,
                        startLevel);
            }
        }

        private record CorridorNodeDragSession(
                long corridorId,
                Long nodeId,
                GridPoint startPoint,
                GridPoint currentPoint
        ) {
            private CorridorNodeDragSession withCurrentPoint(GridPoint point) {
                return new CorridorNodeDragSession(corridorId, nodeId, startPoint, point);
            }
        }

        private record CorridorTileDragSession(
                long corridorId,
                GridPoint tileCell,
                GridPoint startPoint,
                GridPoint currentPoint
        ) {
            private CorridorTileDragSession withCurrentPoint(GridPoint point) {
                return new CorridorTileDragSession(corridorId, tileCell, startPoint, point);
            }
        }

        private record DoorDragSession(
                DungeonMap baseMap,
                int levelZ,
                Long clusterId,
                Long corridorId,
                GridSegment sourceBoundarySegment2x,
                DungeonSelectionRef.RoomBoundaryRef targetBoundaryRef
        ) {
            private DoorDragSession withTargetBoundaryRef(DungeonSelectionRef.RoomBoundaryRef roomBoundaryRef) {
                return new DoorDragSession(
                        baseMap,
                        levelZ,
                        clusterId,
                        corridorId,
                        sourceBoundarySegment2x,
                        roomBoundaryRef);
            }

            private static DoorDragSession start(
                    DungeonMap baseMap,
                    int levelZ,
                    DungeonSelectionRef.DoorRef sourceRef
            ) {
                DoorDescription description = baseMap == null || sourceRef == null
                        ? null
                        : baseMap.describeDoor(sourceRef);
                if (description == null
                        || description.levelZ() != levelZ
                        || description.isRoomExterior()) {
                    return null;
                }
                return new DoorDragSession(
                        baseMap,
                        levelZ,
                        description.isRoomLocal() ? description.clusterId() : null,
                        description.isCorridorBoundary() ? description.corridorId() : null,
                        doorAnchorSegment(baseMap, sourceRef),
                        null);
            }
        }

        private static GridSegment doorAnchorSegment(DungeonMap layout, DungeonSelectionRef.DoorRef doorRef) {
            if (layout == null || doorRef == null) {
                return null;
            }
            DoorDescription description = layout.describeDoor(doorRef);
            return description == null ? null : description.anchorSegment();
        }
    }
}
