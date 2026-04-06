package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.corridor.DungeonCorridorApplicationService;
import features.world.dungeonmap.application.room.DungeonRoomApplicationService;
import features.world.dungeonmap.application.stair.DungeonStairApplicationService;
import features.world.dungeonmap.application.stair.StairDraftResolver;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.objects.DoorOwnerType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.shell.editor.RoomNarrationPane;
import features.world.dungeonmap.state.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
import features.world.dungeonmap.state.EditorPreview;
import javafx.scene.Node;
import ui.async.UiErrorReporter;

import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class SelectionTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonRoomApplicationService roomApplicationService;
    private final DungeonCorridorApplicationService corridorApplicationService;
    private final DungeonStairApplicationService stairApplicationService;
    private final EditorInteractionState state;
    private final RoomNarrationPane roomNarrationPane;
    private final StairTool stairTool;

    private ClusterDragSession dragSession;
    private StairDragSession stairDragSession;
    private CorridorNodeDragSession corridorNodeDragSession;
    private CorridorTileDragSession corridorTileDragSession;
    private DoorDragSession doorDragSession;
    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };
    private DungeonSelectionRef previousNarrationSelectionRef;
    private DungeonLayout previousNarrationMap;
    private int previousNarrationLevel = Integer.MIN_VALUE;

    public SelectionTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonRoomApplicationService roomApplicationService,
            DungeonCorridorApplicationService corridorApplicationService,
            DungeonStairApplicationService stairApplicationService,
            RoomNarrationPane roomNarrationPane,
            StairTool stairTool,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.roomApplicationService = Objects.requireNonNull(roomApplicationService, "roomApplicationService");
        this.corridorApplicationService = Objects.requireNonNull(corridorApplicationService, "corridorApplicationService");
        this.stairApplicationService = Objects.requireNonNull(stairApplicationService, "stairApplicationService");
        this.roomNarrationPane = Objects.requireNonNull(roomNarrationPane, "roomNarrationPane");
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
            stairTool.focusSelectedStair(ctx);
            StairTool.StairDragSource stairDragSource = stairTool.stairDragSource();
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
                    corridorNodeHit.point2x(),
                    corridorNodeHit.point2x());
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorTileRef corridorTileHit
                && corridorTileHit.corridorId() != null) {
            state.selectRef(resolvedSelectionRef);
            corridorTileDragSession = new CorridorTileDragSession(
                    corridorTileHit.corridorId(),
                    corridorTileHit.cell().projectedCell(),
                    corridorTileHit.point2x(),
                    corridorTileHit.point2x());
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
        if (hit instanceof DungeonSelectionRef.ConnectionRef connectionHit) {
            state.selectRef(resolvedSelectionRef == null ? connectionHit : resolvedSelectionRef);
            doorDragSession = DoorDragSession.startLegacy(
                    mapState.activeMap(),
                    mapState.activeProjectionLevel(),
                    connectionHit);
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
        if (resolvedSelectionRef != null && resolvedSelectionRef.ownerRef() != null) {
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
            CellCoord delta = event.gridCell().subtract(stairDragSession.pressCell());
            if (Objects.equals(delta, stairDragSession.currentDelta())) {
                return true;
            }
            stairDragSession = stairDragSession.withCurrentDelta(delta);
            DungeonLayout preview = previewStairMap(stairDragSession);
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
            DungeonLayout preview = previewDoorMap(doorDragSession);
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
            GridPoint2x point2x = ctx == null || ctx.probe() == null
                    ? GridPoint2x.cell(event.gridCell())
                    : ctx.probe().probePoint2x();
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
            GridPoint2x point2x = ctx == null || ctx.probe() == null
                    ? GridPoint2x.cell(event.gridCell())
                    : ctx.probe().probePoint2x();
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
        CellCoord delta = event.gridCell().subtract(dragSession.pressCell());
        if (Objects.equals(delta, dragSession.currentDelta())) {
            return true;
        }
        dragSession = dragSession.withCurrentDelta(delta);
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
                        throwable -> UiErrorReporter.reportBackgroundFailure("SelectionTool.released()", throwable));
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
                        throwable -> UiErrorReporter.reportBackgroundFailure("SelectionTool.released()", throwable));
            }
            return true;
        }
        if (dragSession == null || event == null) {
            return false;
        }
        CellCoord delta = event.gridCell().subtract(dragSession.pressCell());
        int levelDelta = dragSession.currentLevel() - dragSession.startLevel();
        Long mapId = dragSession.baseMap().mapId() > 0 ? dragSession.baseMap().mapId() : null;
        Long clusterId = dragSession.clusterId();
        state.clearPreview();
        dragSession = null;
        if (mapId != null && clusterId != null && (delta.x() != 0 || delta.y() != 0 || levelDelta != 0)) {
            loadingService.submitMutation(
                    () -> {
                        roomApplicationService.move(mapId, clusterId, delta, levelDelta);
                        return mapId;
                    },
                    updatedMapId -> updatedMapId,
                    ignored -> {
                    },
                    throwable -> UiErrorReporter.reportBackgroundFailure("SelectionTool.released()", throwable));
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
                                || candidate instanceof DungeonSelectionRef.DoorRef
                                || candidate instanceof DungeonSelectionRef.ConnectionRef),
                EditorCapabilities.owner(SelectionTool::isRelevantRef));
    }

    @Override
    public void levelScrolled(int delta) {
        if (stairDragSession != null && delta != 0) {
            stairDragSession = stairDragSession.withCurrentLevel(stairDragSession.currentLevel() + delta);
            DungeonLayout preview = previewStairMap(stairDragSession);
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
            return stairTool.sharedStairPaneContent();
        }
        return roomNarrationPane.content();
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
        DungeonLayout activeMap = mapState.activeMap();
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
                || ref instanceof DungeonSelectionRef.ConnectionRef
                || ref instanceof DungeonSelectionRef.CorridorRef
                || ref instanceof DungeonSelectionRef.StairRef
                || ref instanceof DungeonSelectionRef.TransitionRef;
    }

    private static DungeonSelectionRef corridorNodeRef(long corridorId, Long nodeId, GridPoint2x point2x) {
        return new DungeonSelectionRef.CorridorNodeRef(corridorId, nodeId, point2x);
    }

    private void commitDoorMove(DoorDragSession session) {
        if (session == null
                || session.targetBoundaryRef() == null
                || Objects.equals(session.sourceBoundarySegment2x(), session.targetBoundaryRef().boundarySegment2x())) {
            return;
        }
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        switch (session.ownerType()) {
            case CLUSTER -> commitLocalDoorMove(mapId, session);
            case CORRIDOR -> commitCorridorDoorMove(mapId, session);
            case ROOM -> {
            }
        }
    }

    private DungeonLayout previewMap() {
        if (dragSession == null) {
            return null;
        }
        return dragSession.baseMap().withMovedCluster(
                dragSession.clusterId(),
                dragSession.currentDelta(),
                dragSession.currentLevel() - dragSession.startLevel());
    }

    private DungeonLayout previewStairMap(StairDragSession session) {
        if (session == null || session.baseMap() == null || session.baseMap().mapId() <= 0) {
            return null;
        }
        DungeonStairApplicationService.StairDraft movedDraft = movedStairDraft(session);
        if (movedDraft == null) {
            return null;
        }
        try {
            return session.baseMap()
                    .withUpdatedStair(StairDraftResolver.resolvePreview(
                            session.baseMap(),
                            session.stairId(),
                            session.baseMap().mapId(),
                            movedDraft))
                    .projectedToLevel(session.currentLevel());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private DungeonLayout previewCorridorMap() {
        if (corridorNodeDragSession == null) {
            return null;
        }
        Corridor corridor = mapState.activeMap().findCorridor(corridorNodeDragSession.corridorId());
        if (corridor == null) {
            return null;
        }
        Corridor updated = corridor.movedNode(mapState.activeMap(), corridorNodeDragSession.nodeId(), corridorNodeDragSession.currentPoint());
        return mapState.activeMap()
                .withUpdatedCorridor(updated)
                .projectedToLevel(mapState.activeProjectionLevel());
    }

    private DungeonLayout previewDoorMap(DoorDragSession session) {
        if (session == null || session.targetBoundaryRef() == null) {
            return null;
        }
        return switch (session.ownerType()) {
            case CLUSTER -> previewLocalDoorMap(session);
            case CORRIDOR -> previewCorridorDoorMap(session);
            case ROOM -> null;
        };
    }

    private DungeonLayout previewCorridorTileMap() {
        if (corridorTileDragSession == null) {
            return null;
        }
        Corridor corridor = mapState.activeMap().findCorridor(corridorTileDragSession.corridorId());
        if (corridor == null) {
            return null;
        }
        Corridor updated = corridor.promotedTileNodeAndMoved(
                mapState.activeMap(),
                corridorTileDragSession.tileCell(),
                corridorTileDragSession.currentPoint());
        return mapState.activeMap()
                .withUpdatedCorridor(updated)
                .projectedToLevel(mapState.activeProjectionLevel());
    }

    private DungeonLayout previewLocalDoorMap(DoorDragSession session) {
        if (session == null || session.clusterId() == null || session.targetBoundaryRef() == null || session.baseMap() == null) {
            return null;
        }
        RoomCluster cluster = session.baseMap().findCluster(session.clusterId());
        if (cluster == null) {
            return null;
        }
        RoomCluster updatedCluster = cluster.moveDoor(
                session.levelZ(),
                session.sourceBoundarySegment2x(),
                session.targetBoundaryRef().boundarySegment2x());
        if (updatedCluster == null) {
            return null;
        }
        return session.baseMap()
                .withReplacedClusters(List.of(cluster), List.of(updatedCluster))
                .projectedToLevel(session.levelZ());
    }

    private DungeonLayout previewCorridorDoorMap(DoorDragSession session) {
        if (session == null || session.corridorId() == null || session.targetBoundaryRef() == null || session.baseMap() == null) {
            return null;
        }
        Corridor corridor = session.baseMap().findCorridor(session.corridorId());
        DungeonLayout.RoomBoundaryDescription boundary = session.baseMap().describeRoomBoundary(session.targetBoundaryRef(), session.levelZ());
        if (corridor == null
                || boundary == null
                || !ConnectionSurfaceSupport.isExistingExteriorRoomDoor(
                session.baseMap(),
                session.targetBoundaryRef(),
                session.levelZ())) {
            return null;
        }
        try {
            Corridor updated = corridor.movedDoor(
                    session.baseMap(),
                    session.sourceBoundarySegment2x(),
                    corridorDoorNode(boundary));
            return session.baseMap()
                    .withUpdatedCorridor(updated)
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
                    roomApplicationService.moveDoor(new DungeonRoomApplicationService.MoveDoorRequest(
                            mapId,
                            session.clusterId(),
                            session.levelZ(),
                            session.sourceBoundarySegment2x(),
                            session.targetBoundaryRef().boundarySegment2x()));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.selectRef(new DungeonSelectionRef.DoorRef(
                        DoorOwnerType.CLUSTER,
                        session.clusterId(),
                        session.levelZ(),
                        session.targetBoundaryRef().boundarySegment2x())),
                throwable -> UiErrorReporter.reportBackgroundFailure("SelectionTool.commitLocalDoorMove()", throwable));
    }

    private void commitCorridorDoorMove(Long mapId, DoorDragSession session) {
        if (session == null || session.corridorId() == null || previewCorridorDoorMap(session) == null) {
            return;
        }
        DungeonLayout.RoomBoundaryDescription boundary = session.baseMap().describeRoomBoundary(session.targetBoundaryRef(), session.levelZ());
        Long roomId = boundary == null || boundary.room() == null ? null : boundary.room().roomId();
        if (boundary == null
                || roomId == null
                || !ConnectionSurfaceSupport.isExistingExteriorRoomDoor(
                session.baseMap(),
                session.targetBoundaryRef(),
                session.levelZ())) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.moveDoor(new DungeonCorridorApplicationService.MoveCorridorDoorRequest(
                            mapId,
                            session.corridorId(),
                            session.sourceBoundarySegment2x(),
                            new DungeonCorridorApplicationService.CorridorDoorEndpoint(
                                    roomId,
                                    boundary.roomCell(),
                                    boundary.outwardDirection())));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.selectRef(new DungeonSelectionRef.DoorRef(
                        DoorOwnerType.CORRIDOR,
                        session.corridorId(),
                        session.levelZ(),
                        session.targetBoundaryRef().boundarySegment2x())),
                throwable -> UiErrorReporter.reportBackgroundFailure("SelectionTool.commitCorridorDoorMove()", throwable));
    }

    private void commitStairMove(StairDragSession session) {
        if (session == null) {
            return;
        }
        CellCoord delta = session.currentDelta();
        int levelDelta = session.currentLevel() - session.startLevel();
        Long mapId = session.baseMap().mapId() > 0 ? session.baseMap().mapId() : null;
        DungeonStairApplicationService.StairDraft movedDraft = movedStairDraft(session);
        if (mapId == null
                || movedDraft == null
                || (delta.x() == 0 && delta.y() == 0 && levelDelta == 0)
                || previewStairMap(session) == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    stairApplicationService.moveStair(new DungeonStairApplicationService.MoveStairRequest(
                            mapId,
                            session.stairId(),
                            session.baseDraft(),
                            delta,
                            levelDelta));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                    stairTool.adoptMovedStairDraft(session.stairId(), movedDraft);
                    state.selectRef(new DungeonSelectionRef.StairRef(session.stairId()));
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("SelectionTool.commitStairMove()", throwable));
    }

    private static DungeonStairApplicationService.StairDraft movedStairDraft(StairDragSession session) {
        if (session == null) {
            return null;
        }
        return StairDraftResolver.shiftedDraft(
                session.baseDraft(),
                session.currentDelta(),
                session.currentLevel() - session.startLevel());
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

    private static CorridorNode corridorDoorNode(DungeonLayout.RoomBoundaryDescription boundary) {
        if (boundary == null || boundary.room() == null || boundary.room().roomId() == null) {
            return null;
        }
        return new CorridorNode(
                -1L,
                GridPoint2x.edgeCenter(boundary.roomCell(), boundary.outwardDirection()),
                boundary.room().roomId(),
                boundary.roomCell(),
                boundary.outwardDirection());
    }

    private record ClusterDragSession(
            Long clusterId,
            DungeonLayout baseMap,
            CellCoord pressCell,
            CellCoord currentDelta,
            int startLevel,
            int currentLevel
    ) {
        private ClusterDragSession withCurrentDelta(CellCoord delta) {
            return new ClusterDragSession(clusterId, baseMap, pressCell, delta, startLevel, currentLevel);
        }

        private ClusterDragSession withCurrentLevel(int nextLevel) {
            return new ClusterDragSession(clusterId, baseMap, pressCell, currentDelta, startLevel, nextLevel);
        }

        private static ClusterDragSession start(
                Long clusterId,
                DungeonLayout baseMap,
                CellCoord pressCell,
                int startLevel
        ) {
                return new ClusterDragSession(clusterId, baseMap, pressCell, new CellCoord(0, 0), startLevel, startLevel);
        }
    }

    private record StairDragSession(
            long stairId,
            DungeonLayout baseMap,
            DungeonStairApplicationService.StairDraft baseDraft,
            CellCoord pressCell,
            CellCoord currentDelta,
            int startLevel,
            int currentLevel
    ) {
        private StairDragSession withCurrentDelta(CellCoord delta) {
            return new StairDragSession(stairId, baseMap, baseDraft, pressCell, delta, startLevel, currentLevel);
        }

        private StairDragSession withCurrentLevel(int nextLevel) {
            return new StairDragSession(stairId, baseMap, baseDraft, pressCell, currentDelta, startLevel, nextLevel);
        }

        private static StairDragSession start(
                long stairId,
                DungeonLayout baseMap,
                DungeonStairApplicationService.StairDraft baseDraft,
                CellCoord pressCell,
                int startLevel
        ) {
            return new StairDragSession(
                    stairId,
                    baseMap,
                    baseDraft,
                    pressCell,
                    new CellCoord(0, 0),
                    startLevel,
                    startLevel);
        }
    }

    private record CorridorNodeDragSession(
            long corridorId,
            Long nodeId,
            GridPoint2x startPoint,
            GridPoint2x currentPoint
    ) {
        private CorridorNodeDragSession withCurrentPoint(GridPoint2x currentPoint) {
            return new CorridorNodeDragSession(corridorId, nodeId, startPoint, currentPoint);
        }
    }

    private record CorridorTileDragSession(
            long corridorId,
            CellCoord tileCell,
            GridPoint2x startPoint,
            GridPoint2x currentPoint
    ) {
        private CorridorTileDragSession withCurrentPoint(GridPoint2x currentPoint) {
            return new CorridorTileDragSession(corridorId, tileCell, startPoint, currentPoint);
        }
    }

    private record DoorDragSession(
            DungeonLayout baseMap,
            int levelZ,
            DoorOwnerType ownerType,
            Long ownerId,
            GridSegment2x sourceBoundarySegment2x,
            DungeonSelectionRef.RoomBoundaryRef targetBoundaryRef
    ) {
        private Long clusterId() {
            return ownerType == DoorOwnerType.CLUSTER ? ownerId : null;
        }

        private Long corridorId() {
            return ownerType == DoorOwnerType.CORRIDOR ? ownerId : null;
        }

        private DoorDragSession withTargetBoundaryRef(DungeonSelectionRef.RoomBoundaryRef targetBoundaryRef) {
            return new DoorDragSession(
                    baseMap,
                    levelZ,
                    ownerType,
                    ownerId,
                    sourceBoundarySegment2x,
                    targetBoundaryRef);
        }

        private static DoorDragSession start(
                DungeonLayout baseMap,
                int levelZ,
                DungeonSelectionRef.DoorRef sourceRef
        ) {
            if (sourceRef == null || sourceRef.ownerType() == DoorOwnerType.ROOM) {
                return null;
            }
            return new DoorDragSession(
                    baseMap,
                    levelZ,
                    sourceRef.ownerType(),
                    sourceRef.ownerId(),
                    sourceRef.anchorSegment2x(),
                    null);
        }

        private static DoorDragSession startLegacy(
                DungeonLayout baseMap,
                int levelZ,
                DungeonSelectionRef.ConnectionRef sourceRef
        ) {
            if (sourceRef == null) {
                return null;
            }
            DoorOwnerType ownerType = switch (sourceRef.connectionKind()) {
                case LOCAL -> DoorOwnerType.CLUSTER;
                case CORRIDOR -> DoorOwnerType.CORRIDOR;
                case STAIR, TRANSITION -> null;
            };
            if (ownerType == null) {
                return null;
            }
            return new DoorDragSession(
                    baseMap,
                    levelZ,
                    ownerType,
                    sourceRef.ownerId(),
                    sourceRef.boundarySegment2x(),
                    null);
        }
    }
}
