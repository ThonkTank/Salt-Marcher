package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.room.DungeonBoundaryEditService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.shell.interaction.DungeonHitCandidate;
import features.world.dungeonmap.shell.interaction.DungeonHitKind;
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.shell.interaction.DungeonSelectionKey;
import features.world.dungeonmap.shell.interaction.DungeonSelectionLookup;
import features.world.dungeonmap.shell.interaction.DungeonSelection;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorDraft;
import features.world.dungeonmap.state.EditorInteractionState;
import features.world.dungeonmap.state.EditorPreview;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class BoundaryTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final DungeonBoundaryEditService boundaryEditService;
    private final EditorInteractionState state;
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
                DungeonEditorTool.CLUSTER_WALL_DELETE);
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
        if (!tool.isWallTool()) {
            clear();
            return false;
        }
        if (event.isSecondaryButton()) {
            return finishDraft();
        }
        if (!event.isPrimaryButton()) {
            return false;
        }
        return handleWallPressed(ctx, tool == DungeonEditorTool.CLUSTER_WALL_DELETE);
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
    public EditorHitResolution resolveHit(EditorToolContext ctx, EditorToolPhase phase) {
        DungeonLayout layout = ctx == null ? null : ctx.activeMap();
        DungeonEditorTool tool = sessionState.selectedTool();
        if (layout == null || tool == null || !tool.isWallTool()) {
            return EditorHitResolution.none();
        }
        Point2i vertex = firstVertex(ctx == null ? null : ctx.selection());
        if (vertex == null) {
            return EditorHitResolution.none();
        }
        boolean deleteMode = tool == DungeonEditorTool.CLUSTER_WALL_DELETE;
        RoomCluster cluster = resolveCluster(ctx, vertex, deleteMode, layout);
        if (cluster == null || !pathPlanner.isEditableVertex(cluster, vertex, deleteMode)) {
            return EditorHitResolution.none();
        }
        return EditorHitResolution.part(new DungeonHitSubject.VertexSubject(vertex));
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

    private boolean handleWallPressed(EditorToolContext ctx, boolean deleteMode) {
        DungeonLayout layout = ctx.activeMap();
        Point2i vertex = selectedVertex(ctx);
        if (layout == null || vertex == null) {
            if (activeBoundaryDraftClusterId() == null) {
                state.clearSelection();
            }
            return false;
        }

        RoomCluster cluster = resolveCluster(ctx, vertex, deleteMode, layout);
        if (cluster == null || cluster.clusterId() == null) {
            if (activeBoundaryDraftClusterId() == null) {
                state.clearSelection();
            }
            return false;
        }
        if (!Objects.equals(
                DungeonSelectionLookup.clusterId(layout, state.selectedKey()),
                cluster.clusterId())) {
            state.selectKey(clusterOwnerKey(cluster.clusterId()));
        }

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
        loadingService.submitReloadingWrite(
                () -> boundaryEditService.apply(mapId, currentDraft.clusterId(), edges, InternalBoundaryType.WALL, currentDraft.deleteMode()),
                mapId,
                null,
                throwable -> UiErrorReporter.reportBackgroundFailure("BoundaryTool.finishDraft()", throwable));
        return true;
    }

    private RoomCluster resolveCluster(
            EditorToolContext ctx,
            Point2i vertex,
            boolean deleteMode,
            DungeonLayout layout
    ) {
        Long draftClusterId = activeBoundaryDraftClusterId();
        if (draftClusterId != null) {
            RoomCluster cluster = clusterOnActiveLevel(draftClusterId, layout);
            if (cluster != null && pathPlanner.isEditableVertex(cluster, vertex, deleteMode)) {
                return cluster;
            }
        }

        RoomCluster selectedCluster = DungeonSelectionLookup.clusterOnLevel(
                layout,
                state.selectedKey(),
                mapState.activeProjectionLevel());
        if (selectedCluster != null && pathPlanner.isEditableVertex(selectedCluster, vertex, deleteMode)) {
            return selectedCluster;
        }

        Long boundaryClusterId = snapshotClusterId(ctx, layout);
        if (boundaryClusterId != null) {
            RoomCluster boundaryCluster = clusterOnActiveLevel(boundaryClusterId, layout);
            if (boundaryCluster != null && pathPlanner.isEditableVertex(boundaryCluster, vertex, deleteMode)) {
                return boundaryCluster;
            }
        }
        return null;
    }

    private Long activeBoundaryDraftClusterId() {
        if (draft != null && draft.clusterId() != null) {
            return draft.clusterId();
        }
        EditorDraft activeDraft = state.activeDraft();
        if (activeDraft instanceof EditorDraft.BoundaryDraft boundaryDraft) {
            return boundaryDraft.clusterId();
        }
        return null;
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

    private static Point2i firstVertex(features.world.dungeonmap.shell.interaction.DungeonSelection selection) {
        DungeonHitSubject subject = selection == null
                ? null
                : selection.firstSubjectMatching(candidate -> candidate instanceof DungeonHitSubject.VertexSubject);
        if (subject instanceof DungeonHitSubject.VertexSubject vertexSubject) {
            return vertexSubject.vertex();
        }
        return null;
    }

    private static Point2i selectedVertex(EditorToolContext ctx) {
        return ctx != null && ctx.resolvedSubject() instanceof DungeonHitSubject.VertexSubject vertexSubject
                ? vertexSubject.vertex()
                : null;
    }

    private static Long snapshotClusterId(EditorToolContext ctx, DungeonLayout layout) {
        if (ctx == null || ctx.snapshot() == null) {
            return null;
        }
        for (DungeonHitCandidate candidate : ctx.snapshot().candidates()) {
            Long clusterId = clusterIdFromBoundarySubject(candidate.descriptor().subject(), layout);
            if (clusterId != null) {
                return clusterId;
            }
        }
        return null;
    }

    private void showDraft(Draft nextDraft) {
        draft = nextDraft;
        state.showDraft(new EditorDraft.BoundaryDraft(nextDraft.clusterId(), nextDraft.statusMessage()));
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
        state.clearDraft();
        state.clearPreview();
        refreshStatePane();
    }

    private static Long clusterIdFromBoundarySubject(DungeonHitSubject subject, DungeonLayout layout) {
        return switch (subject) {
            case DungeonHitSubject.ClusterBoundarySubject clusterBoundarySubject -> clusterBoundarySubject.clusterId();
            case DungeonHitSubject.RoomBoundarySubject roomBoundarySubject -> roomBoundarySubject.clusterId();
            default -> null;
        };
    }

    private static Long clusterIdFromSubject(DungeonHitSubject subject, DungeonLayout layout) {
        if (subject == null) {
            return null;
        }
        return switch (subject) {
            case DungeonHitSubject.ClusterLabelSubject clusterLabelSubject -> clusterLabelSubject.clusterId();
            case DungeonHitSubject.ClusterBoundarySubject clusterBoundarySubject -> clusterBoundarySubject.clusterId();
            case DungeonHitSubject.RoomBoundarySubject roomBoundarySubject -> roomBoundarySubject.clusterId();
            case DungeonHitSubject.RoomSubject roomSubject -> roomSubject.clusterId() != null
                    ? roomSubject.clusterId()
                    : clusterIdFromRoom(layout, roomSubject.roomId());
            default -> null;
        };
    }

    private static Long clusterIdFromRoom(DungeonLayout layout, Long roomId) {
        if (layout == null || roomId == null) {
            return null;
        }
        Room room = layout.findRoom(roomId);
        return room == null ? null : room.clusterId();
    }

    private static DungeonSelectionKey clusterOwnerKey(Long clusterId) {
        if (clusterId == null) {
            return null;
        }
        return new DungeonSelectionKey(
                DungeonHitKind.CLUSTER_LABEL,
                RoomCluster.targetKey(clusterId),
                "");
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
