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
import features.world.dungeonmap.state.DungeonBoundaryDraftState;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorSelectionState;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

public final class BoundaryInteractionController {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final EditorSelectionState selectionState;
    private final DungeonBoundaryDraftState draftState;
    private final DungeonBoundaryEditService boundaryEditService;
    private final DungeonGridBoundaryHitTester boundaryHitTester = new DungeonGridBoundaryHitTester();
    private final DungeonGridVertexHitTester vertexHitTester = new DungeonGridVertexHitTester();
    private final DungeonBoundaryPathPlanner pathPlanner = new DungeonBoundaryPathPlanner();

    public BoundaryInteractionController(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            EditorSelectionState selectionState,
            DungeonBoundaryDraftState draftState,
            DungeonBoundaryEditService boundaryEditService
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.selectionState = Objects.requireNonNull(selectionState, "selectionState");
        this.draftState = Objects.requireNonNull(draftState, "draftState");
        this.boundaryEditService = Objects.requireNonNull(boundaryEditService, "boundaryEditService");
    }

    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        if (event == null) {
            return false;
        }
        DungeonEditorTool tool = sessionState.selectedTool();
        if (!tool.isWallTool() && !tool.isDoorTool()) {
            clear();
            return false;
        }
        if (tool.isDoorTool()) {
            return handleDoorPressed(event);
        }
        if (event.isSecondaryButton()) {
            return finishDraft();
        }
        if (!event.isPrimaryButton()) {
            return false;
        }
        return handleWallPressed(event, tool == DungeonEditorTool.CLUSTER_WALL_DELETE);
    }

    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        return false;
    }

    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        return false;
    }

    public void clear() {
        draftState.clear();
    }

    private boolean handleDoorPressed(DungeonCanvasPointerEvent event) {
        if (!event.isPrimaryButton()) {
            return false;
        }
        DungeonEditorBoundaryHitTarget hit = boundaryHitTester.hitTest(mapState.activeMap(), event.canvasPoint(), event.camera());
        if (hit == null || hit.clusterId() == null) {
            selectionState.clearSelection();
            return false;
        }
        selectionState.selectTarget(hit.targetKey());
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return true;
        }
        boolean deleteBoundary = sessionState.selectedTool() == DungeonEditorTool.CLUSTER_DOOR_DELETE;
        UiAsyncTasks.submitVoid(
                () -> boundaryEditService.apply(mapId, hit.clusterId(), hit.edge(), InternalBoundaryType.DOOR, deleteBoundary),
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("BoundaryInteractionController.handleDoorPressed()", throwable));
        return true;
    }

    private boolean handleWallPressed(DungeonCanvasPointerEvent event, boolean deleteMode) {
        DungeonLayout layout = mapState.activeMap();
        Point2i vertex = vertexHitTester.hitTest(event.canvasPoint(), event.camera());
        if (layout == null || vertex == null) {
            if (!draftState.hasDraft()) {
                selectionState.clearSelection();
            }
            return false;
        }

        RoomCluster cluster = resolveCluster(event, vertex, deleteMode, layout);
        if (cluster == null || cluster.clusterId() == null) {
            if (!draftState.hasDraft()) {
                selectionState.clearSelection();
            }
            return false;
        }
        selectionState.selectTarget(cluster.targetKey());

        DungeonBoundaryDraftState.Draft currentDraft = draftState.draft();
        if (currentDraft == null || !Objects.equals(currentDraft.clusterId(), cluster.clusterId())) {
            if (!pathPlanner.isEditableVertex(cluster, vertex, deleteMode)) {
                return false;
            }
            draftState.showDraft(new DungeonBoundaryDraftState.Draft(
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

        if (Objects.equals(currentDraft.currentVertex(), vertex)) {
            return true;
        }

        DungeonBoundaryPathPlanner.PathResult result = deleteMode
                ? pathPlanner.findDeletePath(cluster, currentDraft.currentVertex(), vertex)
                : pathPlanner.findCreatePath(cluster, currentDraft.currentVertex(), vertex);
        if (!result.hasRoute()) {
            draftState.showDraft(new DungeonBoundaryDraftState.Draft(
                    currentDraft.clusterId(),
                    currentDraft.deleteMode(),
                    currentDraft.startVertex(),
                    currentDraft.currentVertex(),
                    currentDraft.previewEdges(),
                    currentDraft.skippedDoorEdges(),
                    deleteMode
                            ? "Pfad kann nur entlang bestehender Innenwände verlaufen"
                            : "Zwischen diesen Eckpunkten gibt es keinen gültigen Pfad"));
            return true;
        }

        Set<VertexEdge> nextPreview = new LinkedHashSet<>(currentDraft.previewEdges());
        nextPreview.addAll(result.committedEdges());
        Set<VertexEdge> nextSkipped = new LinkedHashSet<>(currentDraft.skippedDoorEdges());
        nextSkipped.addAll(result.skippedDoorEdges());
        draftState.showDraft(new DungeonBoundaryDraftState.Draft(
                currentDraft.clusterId(),
                currentDraft.deleteMode(),
                currentDraft.startVertex(),
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
        DungeonBoundaryDraftState.Draft draft = draftState.draft();
        if (draft == null) {
            return false;
        }
        Long mapId = mapState.activeMapId();
        Set<VertexEdge> edges = draft.previewEdges();
        draftState.clear();
        if (mapId == null || edges.isEmpty()) {
            return true;
        }
        UiAsyncTasks.submitVoid(
                () -> boundaryEditService.apply(mapId, draft.clusterId(), edges, InternalBoundaryType.WALL, draft.deleteMode()),
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("BoundaryInteractionController.finishDraft()", throwable));
        return true;
    }

    private RoomCluster resolveCluster(
            DungeonCanvasPointerEvent event,
            Point2i vertex,
            boolean deleteMode,
            DungeonLayout layout
    ) {
        DungeonBoundaryDraftState.Draft activeDraft = draftState.draft();
        if (activeDraft != null && activeDraft.clusterId() != null) {
            RoomCluster cluster = clusterOnActiveLevel(activeDraft.clusterId(), layout);
            if (cluster != null && pathPlanner.isEditableVertex(cluster, vertex, deleteMode)) {
                return cluster;
            }
        }

        RoomCluster selectedCluster = selectedCluster(layout);
        if (selectedCluster != null && pathPlanner.isEditableVertex(selectedCluster, vertex, deleteMode)) {
            return selectedCluster;
        }

        DungeonEditorBoundaryHitTarget boundaryHit = boundaryHitTester.hitTest(layout, event.canvasPoint(), event.camera());
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
        String targetKey = selectionState.selectedTargetKey();
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

    private static String statusMessage(
            RoomCluster cluster,
            boolean deleteMode,
            Set<VertexEdge> previewEdges,
            Set<VertexEdge> skippedDoorEdges
    ) {
        if (deleteMode) {
            return previewEdges.isEmpty()
                    ? "Nur Außenwände getroffen, nichts zu löschen"
                    : "Innenwandpfad aktiv, Rechtsklick schließt ab";
        }
        if (!skippedDoorEdges.isEmpty()) {
            return "Pfad aktiv, Türen bleiben erhalten, Rechtsklick schließt ab";
        }
        if (cluster != null && !previewEdges.isEmpty()) {
            return "Wandpfad aktiv, Rechtsklick oder Klick auf bestehende Wand schließt ab";
        }
        return "Pfad aktiv";
    }
}
