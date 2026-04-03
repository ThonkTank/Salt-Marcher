package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.corridor.DungeonCorridorApplicationService;
import features.world.dungeonmap.application.room.DungeonClusterMoveService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.shell.editor.RoomNarrationPane;
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.state.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
import features.world.dungeonmap.state.EditorPreview;
import javafx.scene.Node;
import ui.async.UiErrorReporter;

import java.util.Objects;
import java.util.Set;

public final class SelectionTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonClusterMoveService clusterMoveService;
    private final DungeonCorridorApplicationService corridorApplicationService;
    private final EditorInteractionState state;
    private final RoomNarrationPane roomNarrationPane;

    private ClusterDragSession dragSession;
    private CorridorNodeDragSession corridorNodeDragSession;
    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };
    private DungeonSelectionRef previousNarrationSelectionRef;
    private DungeonLayout previousNarrationMap;
    private int previousNarrationLevel = Integer.MIN_VALUE;

    public SelectionTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonClusterMoveService clusterMoveService,
            DungeonCorridorApplicationService corridorApplicationService,
            RoomNarrationPane roomNarrationPane,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.clusterMoveService = Objects.requireNonNull(clusterMoveService, "clusterMoveService");
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
        DungeonHitSubject hit = ctx == null ? null : ctx.resolvedSubject();
        DungeonSelectionRef resolvedSelectionRef = ctx == null ? null : ctx.resolvedRef();
        clear();
        if (hit instanceof DungeonHitSubject.CorridorNodeSubject corridorNodeHit
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
        if (hit instanceof DungeonHitSubject.ClusterLabelSubject clusterLabelHit) {
            state.selectRef(resolvedSelectionRef);
            dragSession = ClusterDragSession.start(
                    clusterLabelHit.clusterId(),
                    mapState.activeMap(),
                    event.gridCell(),
                    mapState.activeProjectionLevel());
            return true;
        }
        if (hit instanceof DungeonHitSubject.StairSubject) {
            state.selectRef(resolvedSelectionRef);
            return true;
        }
        if (hit instanceof DungeonHitSubject.TransitionSubject) {
            state.selectRef(resolvedSelectionRef);
            return true;
        }
        if (hit != null && hit.ownerRef() != null) {
            state.selectRef(resolvedSelectionRef);
            return true;
        }
        state.clearSelection();
        return false;
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
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
        if (corridorNodeDragSession != null) {
            CorridorNodeDragSession current = corridorNodeDragSession;
            corridorNodeDragSession = null;
            state.clearPreview();
            Long mapId = mapState.activeMapId();
            if (!Objects.equals(current.startPoint(), current.currentPoint()) && mapId != null) {
                loadingService.submitMutation(
                        () -> {
                            corridorApplicationService.moveNode(mapId, current.corridorId(), current.nodeId(), current.currentPoint());
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
                        clusterMoveService.move(mapId, clusterId, delta, levelDelta);
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
        DungeonHitSubject subject = resolvedSubject(ctx == null ? null : ctx.snapshot());
        if (subject == null) {
            return EditorHitResolution.none();
        }
        if (subject instanceof DungeonHitSubject.CorridorNodeSubject) {
            return EditorHitResolution.part(subject);
        }
        return EditorHitResolution.owner(subject);
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
        state.clearPreview();
    }

    private static DungeonHitSubject resolvedSubject(features.world.dungeonmap.shell.interaction.DungeonHitSnapshot snapshot) {
        if (snapshot == null) {
            return null;
        }
        return snapshot.firstSubjectMatching(SelectionTool::isRelevantSubject);
    }

    private static boolean isRelevantSubject(DungeonHitSubject subject) {
        return subject instanceof DungeonHitSubject.CorridorNodeSubject
                || subject instanceof DungeonHitSubject.ClusterLabelSubject
                || subject instanceof DungeonHitSubject.RoomSubject
                || subject instanceof DungeonHitSubject.RoomBoundarySubject
                || subject instanceof DungeonHitSubject.ConnectionSubject
                || subject instanceof DungeonHitSubject.CorridorSubject
                || subject instanceof DungeonHitSubject.StairSubject
                || subject instanceof DungeonHitSubject.TransitionSubject;
    }

    private static DungeonSelectionRef corridorNodeRef(long corridorId, Long nodeId, GridPoint2x point2x) {
        return new DungeonSelectionRef.CorridorNodeRef(corridorId, nodeId, point2x);
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
}
