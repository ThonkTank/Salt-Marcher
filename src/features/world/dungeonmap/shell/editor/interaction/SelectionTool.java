package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.corridor.DungeonCorridorApplicationService;
import features.world.dungeonmap.application.room.DungeonRoomApplicationService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
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
    private final EditorInteractionState state;
    private final RoomNarrationPane roomNarrationPane;

    private ClusterDragSession dragSession;
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
            RoomNarrationPane roomNarrationPane,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.roomApplicationService = Objects.requireNonNull(roomApplicationService, "roomApplicationService");
        this.corridorApplicationService = Objects.requireNonNull(corridorApplicationService, "corridorApplicationService");
        this.roomNarrationPane = Objects.requireNonNull(roomNarrationPane, "roomNarrationPane");
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
        if (hit instanceof DungeonSelectionRef.ConnectionRef connectionHit) {
            state.selectRef(resolvedSelectionRef == null ? connectionHit : resolvedSelectionRef);
            doorDragSession = DoorDragSession.start(
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
        if (hit instanceof DungeonSelectionRef.StairRef) {
            state.selectRef(resolvedSelectionRef);
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
        if (doorDragSession != null) {
            if (event == null || !event.isPrimaryButtonDown()) {
                return false;
            }
            DungeonSelectionRef.RoomBoundaryRef targetBoundaryRef = currentDoorTargetRef(ctx);
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
        if (doorDragSession != null) {
            DoorDragSession current = doorDragSession.withTargetBoundaryRef(currentDoorTargetRef(ctx));
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
    public EditorHitResolution resolveHit(EditorToolContext ctx, EditorToolPhase phase) {
        if (activeTool != DungeonEditorTool.SELECT) {
            return EditorHitResolution.none();
        }
        DungeonSelectionRef ref = resolvedHitRef(ctx == null ? null : ctx.snapshot());
        if (ref == null) {
            return EditorHitResolution.none();
        }
        if (ref instanceof DungeonSelectionRef.CorridorNodeRef
                || ref instanceof DungeonSelectionRef.CorridorTileRef
                || ref instanceof DungeonSelectionRef.ConnectionRef) {
            return EditorHitResolution.part(ref);
        }
        if (doorDragSession != null && ref instanceof DungeonSelectionRef.RoomBoundaryRef) {
            return EditorHitResolution.part(ref);
        }
        return EditorHitResolution.owner(ref);
    }

    @Override
    public void levelScrolled(int delta) {
        if (dragSession == null || delta == 0) {
            return;
        }
        int nextLevel = dragSession.currentLevel() + delta;
        dragSession = dragSession.withCurrentLevel(nextLevel);
        state.showPreview(new EditorPreview.LayoutPreview(previewMap()));
    }

    @Override
    public Node statePaneContent() {
        return activeTool == DungeonEditorTool.SELECT ? roomNarrationPane.content() : null;
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
        corridorNodeDragSession = null;
        corridorTileDragSession = null;
        doorDragSession = null;
        state.clearPreview();
    }

    private static DungeonSelectionRef resolvedHitRef(features.world.dungeonmap.shell.interaction.DungeonHitSnapshot snapshot) {
        if (snapshot == null) {
            return null;
        }
        return snapshot.firstRefMatching(SelectionTool::isRelevantRef);
    }

    private static boolean isRelevantRef(DungeonSelectionRef ref) {
        return ref instanceof DungeonSelectionRef.CorridorNodeRef
                || ref instanceof DungeonSelectionRef.CorridorTileRef
                || ref instanceof DungeonSelectionRef.ClusterRef
                || ref instanceof DungeonSelectionRef.RoomRef
                || ref instanceof DungeonSelectionRef.RoomBoundaryRef
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
        switch (session.connectionKind()) {
            case LOCAL -> commitLocalDoorMove(mapId, session);
            case CORRIDOR -> commitCorridorDoorMove(mapId, session);
            case STAIR, TRANSITION -> {
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
        return switch (session.connectionKind()) {
            case LOCAL -> previewLocalDoorMap(session);
            case CORRIDOR -> previewCorridorDoorMap(session);
            case STAIR, TRANSITION -> null;
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
        RoomCluster projectedCluster = cluster == null ? null : cluster.projectedToLevel(session.levelZ());
        if (projectedCluster == null) {
            return null;
        }
        RoomCluster updatedCluster = projectedCluster.moveDoor(
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
        if (corridor == null || boundary == null) {
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
                ignored -> state.selectRef(new DungeonSelectionRef.ConnectionRef(
                        ConnectionKind.LOCAL,
                        session.clusterId(),
                        null,
                        session.targetBoundaryRef().boundarySegment2x())),
                throwable -> UiErrorReporter.reportBackgroundFailure("SelectionTool.commitLocalDoorMove()", throwable));
    }

    private void commitCorridorDoorMove(Long mapId, DoorDragSession session) {
        if (session == null || session.corridorId() == null || previewCorridorDoorMap(session) == null) {
            return;
        }
        DungeonLayout.RoomBoundaryDescription boundary = session.baseMap().describeRoomBoundary(session.targetBoundaryRef(), session.levelZ());
        Long roomId = boundary == null || boundary.room() == null ? null : boundary.room().roomId();
        if (boundary == null || roomId == null) {
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
                ignored -> state.selectRef(new DungeonSelectionRef.ConnectionRef(
                        ConnectionKind.CORRIDOR,
                        null,
                        session.corridorId(),
                        session.targetBoundaryRef().boundarySegment2x())),
                throwable -> UiErrorReporter.reportBackgroundFailure("SelectionTool.commitCorridorDoorMove()", throwable));
    }

    private static DungeonSelectionRef.RoomBoundaryRef currentDoorTargetRef(EditorToolContext ctx) {
        return ctx != null && ctx.hitRef() instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundaryRef
                ? roomBoundaryRef
                : null;
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
            ConnectionKind connectionKind,
            Long clusterId,
            Long corridorId,
            GridSegment2x sourceBoundarySegment2x,
            DungeonSelectionRef.RoomBoundaryRef targetBoundaryRef
    ) {
        private DoorDragSession withTargetBoundaryRef(DungeonSelectionRef.RoomBoundaryRef targetBoundaryRef) {
            return new DoorDragSession(
                    baseMap,
                    levelZ,
                    connectionKind,
                    clusterId,
                    corridorId,
                    sourceBoundarySegment2x,
                    targetBoundaryRef);
        }

        private static DoorDragSession start(
                DungeonLayout baseMap,
                int levelZ,
                DungeonSelectionRef.ConnectionRef sourceRef
        ) {
            return new DoorDragSession(
                    baseMap,
                    levelZ,
                    sourceRef.connectionKind(),
                    sourceRef.clusterId(),
                    sourceRef.corridorId(),
                    sourceRef.boundarySegment2x(),
                    null);
        }
    }
}
