package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.room.DungeonBoundaryEditService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
import features.world.dungeonmap.state.EditorPreview;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

public final class BoundaryTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final DungeonBoundaryEditService boundaryEditService;
    private final EditorInteractionState state;
    private final DungeonGridBoundaryHitTester boundaryHitTester = new DungeonGridBoundaryHitTester();
    private final DungeonGridVertexHitTester vertexHitTester = new DungeonGridVertexHitTester();
    private final DungeonBoundaryPathPlanner pathPlanner = new DungeonBoundaryPathPlanner();
    private final Label statusLabel = new Label("Kein Wandpfad aktiv");
    private final VBox statusCard = EditorCards.card("Wandpfad", statusLabel);

    private Draft draft;
    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };

    public BoundaryTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            DungeonBoundaryEditService boundaryEditService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.boundaryEditService = Objects.requireNonNull(boundaryEditService, "boundaryEditService");
        this.state = Objects.requireNonNull(state, "state");
        this.statusLabel.setWrapText(true);
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(
                DungeonEditorTool.CLUSTER_WALL,
                DungeonEditorTool.CLUSTER_WALL_DELETE,
                DungeonEditorTool.CLUSTER_DOOR,
                DungeonEditorTool.CLUSTER_DOOR_DELETE);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
        refreshStatePane();
    }

    @Override
    public void deactivate() {
        activeTool = null;
        clear();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null) {
            return false;
        }
        DungeonEditorTool tool = sessionState.selectedTool();
        if (!tool.isWallTool() && !tool.isDoorTool()) {
            clear();
            return false;
        }
        if (tool.isDoorTool()) {
            return handleDoorPressed(ctx, event);
        }
        if (event.isSecondaryButton()) {
            return finishDraft();
        }
        if (!event.isPrimaryButton()) {
            return false;
        }
        return handleWallPressed(ctx, event, tool == DungeonEditorTool.CLUSTER_WALL_DELETE);
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        return false;
    }

    @Override
    public Node statePaneContent() {
        String statusText = boundaryStatusText();
        if (statusText == null || statusText.isBlank()) {
            statusLabel.setText("Kein Wandpfad aktiv");
            return null;
        }
        statusLabel.setText(statusText);
        return statusCard;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback == null ? () -> { } : callback;
    }

    private boolean handleDoorPressed(EditorToolContext ctx, DungeonCanvasPointerEvent event) {
        if (!event.isPrimaryButton()) {
            return false;
        }
        DungeonLayout layout = ctx.projectedLayout();
        DungeonEditorBoundaryHitTarget hit = boundaryHitTester.hitBoundary(layout, event.canvasPoint(), event.camera());
        if (!isEditableDoorBoundary(hit, layout)) {
            state.clearSelection();
            return false;
        }
        state.selectTarget(hit.targetKey());
        Long mapId = mapState.activeMapId();
        Long clusterId = hit.clusterId();
        if (mapId == null || clusterId == null) {
            return true;
        }
        boolean deleteBoundary = sessionState.selectedTool() == DungeonEditorTool.CLUSTER_DOOR_DELETE;
        UiAsyncTasks.submitVoid(
                () -> boundaryEditService.apply(mapId, clusterId, hit.edge(), InternalBoundaryType.DOOR, deleteBoundary),
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("BoundaryTool.handleDoorPressed()", throwable));
        return true;
    }

    private boolean handleWallPressed(EditorToolContext ctx, DungeonCanvasPointerEvent event, boolean deleteMode) {
        DungeonLayout layout = ctx.projectedLayout();
        Point2i vertex = vertexHitTester.hitTest(event.canvasPoint(), event.camera());
        if (layout == null || vertex == null) {
            if (draft == null) {
                state.clearSelection();
            }
            return false;
        }

        RoomCluster cluster = resolveCluster(event, vertex, deleteMode, layout);
        if (cluster == null || cluster.clusterId() == null) {
            if (draft == null) {
                state.clearSelection();
            }
            return false;
        }
        state.selectTarget(cluster.targetKey());

        if (draft == null || !Objects.equals(draft.clusterId(), cluster.clusterId())) {
            if (!pathPlanner.isEditableVertex(cluster, vertex, deleteMode)) {
                return false;
            }
            showDraft(new Draft(
                    cluster.clusterId(),
                    deleteMode,
                    vertex,
                    vertex,
                    Set.of(),
                    Set.of(),
                    deleteMode
                            ? "Start auf Innenwand gewählt, nächsten Eckpunkt anklicken"
                            : "Start-Eckpunkt gewählt, nächsten Eckpunkt anklicken"));
            return true;
        }

        if (Objects.equals(draft.currentVertex(), vertex)) {
            return true;
        }

        DungeonBoundaryPathPlanner.PathResult result = deleteMode
                ? pathPlanner.findDeletePath(cluster, draft.currentVertex(), vertex)
                : pathPlanner.findCreatePath(cluster, draft.currentVertex(), vertex);
        if (!result.hasRoute()) {
            showDraft(new Draft(
                    draft.clusterId(),
                    draft.deleteMode(),
                    draft.startVertex(),
                    draft.currentVertex(),
                    draft.previewEdges(),
                    draft.skippedConnectionEdges(),
                    deleteMode
                            ? "Pfad kann nur entlang bestehender Innenwände verlaufen"
                            : "Zwischen diesen Eckpunkten gibt es keinen gültigen Pfad"));
            return true;
        }

        Set<VertexEdge> nextPreview = new LinkedHashSet<>(draft.previewEdges());
        nextPreview.addAll(result.committedEdges());
        Set<VertexEdge> nextSkipped = new LinkedHashSet<>(draft.skippedConnectionEdges());
        nextSkipped.addAll(result.skippedConnectionEdges());
        showDraft(new Draft(
                draft.clusterId(),
                draft.deleteMode(),
                draft.startVertex(),
                vertex,
                nextPreview,
                nextSkipped,
                statusMessage(cluster, deleteMode, nextPreview, nextSkipped)));

        if (!deleteMode && pathPlanner.touchesExistingWall(cluster, vertex)) {
            return finishDraft();
        }
        return true;
    }

    private boolean finishDraft() {
        Draft currentDraft = draft;
        if (currentDraft == null) {
            return false;
        }
        Long mapId = mapState.activeMapId();
        Set<VertexEdge> edges = currentDraft.previewEdges();
        clear();
        if (mapId == null || edges.isEmpty()) {
            return true;
        }
        UiAsyncTasks.submitVoid(
                () -> boundaryEditService.apply(mapId, currentDraft.clusterId(), edges, InternalBoundaryType.WALL, currentDraft.deleteMode()),
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("BoundaryTool.finishDraft()", throwable));
        return true;
    }

    private RoomCluster resolveCluster(
            DungeonCanvasPointerEvent event,
            Point2i vertex,
            boolean deleteMode,
            DungeonLayout layout
    ) {
        if (draft != null && draft.clusterId() != null) {
            RoomCluster cluster = clusterOnActiveLevel(draft.clusterId(), layout);
            if (cluster != null && pathPlanner.isEditableVertex(cluster, vertex, deleteMode)) {
                return cluster;
            }
        }

        RoomCluster selectedCluster = selectedCluster(layout);
        if (selectedCluster != null && pathPlanner.isEditableVertex(selectedCluster, vertex, deleteMode)) {
            return selectedCluster;
        }

        DungeonEditorBoundaryHitTarget boundaryHit = boundaryHitTester.hitBoundary(layout, event.canvasPoint(), event.camera());
        if (boundaryHit != null && boundaryHit.clusterId() != null) {
            RoomCluster boundaryCluster = clusterOnActiveLevel(boundaryHit.clusterId(), layout);
            if (boundaryCluster != null && pathPlanner.isEditableVertex(boundaryCluster, vertex, deleteMode)) {
                return boundaryCluster;
            }
        }

        return layout.clusters().stream()
                .filter(Objects::nonNull)
                .filter(cluster -> layout.levelForCluster(cluster.clusterId()) == mapState.activeProjectionLevel())
                .filter(cluster -> pathPlanner.isEditableVertex(cluster, vertex, deleteMode))
                .sorted(java.util.Comparator
                        .comparing((RoomCluster cluster) -> cluster.center().distanceTo(vertex))
                        .thenComparing(RoomCluster::clusterId, java.util.Comparator.nullsLast(Long::compareTo)))
                .findFirst()
                .orElse(null);
    }

    private RoomCluster selectedCluster(DungeonLayout layout) {
        String targetKey = state.selectedTargetKey();
        if (RoomCluster.isTargetKey(targetKey)) {
            return clusterOnActiveLevel(RoomCluster.clusterIdFromKey(targetKey), layout);
        }
        if (!Room.isTargetKey(targetKey) || layout == null) {
            return null;
        }
        Room room = layout.findRoom(Room.roomIdFromKey(targetKey));
        return room == null ? null : clusterOnActiveLevel(room.clusterId(), layout);
    }

    private RoomCluster clusterOnActiveLevel(Long clusterId, DungeonLayout layout) {
        if (clusterId == null || layout == null) {
            return null;
        }
        RoomCluster cluster = layout.findCluster(clusterId);
        if (cluster == null || layout.levelForCluster(clusterId) != mapState.activeProjectionLevel()) {
            return null;
        }
        return cluster;
    }

    private boolean isEditableDoorBoundary(DungeonEditorBoundaryHitTarget hit, DungeonLayout layout) {
        if (hit == null || layout == null || hit.clusterId() == null) {
            return false;
        }
        RoomCluster cluster = clusterOnActiveLevel(hit.clusterId(), layout);
        if (cluster == null) {
            return false;
        }
        boolean deleteMode = sessionState.selectedTool() == DungeonEditorTool.CLUSTER_DOOR_DELETE;
        if (deleteMode) {
            return hit.boundaryType() == InternalBoundaryType.DOOR;
        }
        if (hit.boundaryType() == InternalBoundaryType.DOOR) {
            return false;
        }
        java.util.List<Point2i> touchingCells = hit.edge().touchingCells().stream()
                .sorted(Point2i.POINT_ORDER)
                .toList();
        if (touchingCells.size() != 2) {
            return false;
        }
        Room leftRoom = cluster.roomAt(touchingCells.getFirst());
        Room rightRoom = cluster.roomAt(touchingCells.getLast());
        return leftRoom != null
                && rightRoom != null
                && leftRoom.roomId() != null
                && rightRoom.roomId() != null
                && !leftRoom.roomId().equals(rightRoom.roomId());
    }

    private void showDraft(Draft nextDraft) {
        draft = nextDraft;
        state.showPreview(new EditorPreview.BoundaryPreview(
                nextDraft.previewEdges(),
                nextDraft.skippedConnectionEdges(),
                nextDraft.startVertex(),
                nextDraft.currentVertex(),
                nextDraft.deleteMode()));
        refreshStatePane();
    }

    private void clear() {
        draft = null;
        state.clearPreview();
        refreshStatePane();
    }

    private void refreshStatePane() {
        if (activeTool != null) {
            refreshCallback.run();
        }
    }

    private String boundaryStatusText() {
        if (activeTool == null) {
            return null;
        }
        if (draft != null) {
            return draft.statusMessage();
        }
        if (activeTool == DungeonEditorTool.CLUSTER_WALL) {
            return "Eckpunkte anklicken, Rechtsklick schließt ab";
        }
        if (activeTool == DungeonEditorTool.CLUSTER_WALL_DELETE) {
            return "Eckpunkte auf bestehender Innenwand anklicken, Rechtsklick schließt ab";
        }
        return null;
    }

    private static String statusMessage(
            RoomCluster cluster,
            boolean deleteMode,
            Set<VertexEdge> previewEdges,
            Set<VertexEdge> skippedConnectionEdges
    ) {
        if (deleteMode) {
            return previewEdges.isEmpty()
                    ? "Nur Außenwände getroffen, nichts zu löschen"
                    : "Innenwandpfad aktiv, Rechtsklick schließt ab";
        }
        if (!skippedConnectionEdges.isEmpty()) {
            return "Pfad aktiv, Türen bleiben erhalten, Rechtsklick schließt ab";
        }
        if (cluster != null && !previewEdges.isEmpty()) {
            return "Wandpfad aktiv, Rechtsklick oder Klick auf bestehende Wand schließt ab";
        }
        return "Pfad aktiv";
    }

    private record Draft(
            Long clusterId,
            boolean deleteMode,
            Point2i startVertex,
            Point2i currentVertex,
            Set<VertexEdge> previewEdges,
            Set<VertexEdge> skippedConnectionEdges,
            String statusMessage
    ) {
        private Draft {
            previewEdges = previewEdges == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(previewEdges));
            skippedConnectionEdges = skippedConnectionEdges == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(skippedConnectionEdges));
            statusMessage = statusMessage == null ? "" : statusMessage;
        }
    }
}
