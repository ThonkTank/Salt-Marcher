package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.room.DungeonBoundaryEditService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.shell.interaction.DungeonHitKind;
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.shell.interaction.DungeonSelectionKey;
import features.world.dungeonmap.shell.interaction.DungeonSelectionLookup;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorDraft;
import features.world.dungeonmap.state.EditorInteractionState;
import features.world.dungeonmap.state.EditorPreview;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
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
        DungeonEditorTool tool = sessionState.selectedTool();
        if (tool == null || !tool.isWallTool()) {
            return EditorHitResolution.none();
        }
        ResolvedBoundaryVertex resolved = resolveBoundaryVertex(ctx, tool == DungeonEditorTool.CLUSTER_WALL_DELETE);
        if (resolved == null) {
            return EditorHitResolution.none();
        }
        return EditorHitResolution.part(
                new DungeonHitSubject.VertexSubject(resolved.vertex2x()),
                clusterOwnerKey(resolved.clusterId()));
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
        DungeonLayout layout = ctx == null ? null : ctx.activeMap();
        GridPoint2x vertex = selectedVertex(ctx);
        DungeonSelectionKey resolvedKey = ctx == null ? null : ctx.resolvedSelectionKey();
        RoomCluster cluster = DungeonSelectionLookup.clusterOnLevel(
                layout,
                resolvedKey,
                mapState.activeProjectionLevel());
        if (layout == null || vertex == null || cluster == null || cluster.clusterId() == null) {
            if (activeBoundaryDraftClusterId() == null) {
                state.clearSelection();
            }
            return false;
        }
        if (!Objects.equals(state.selectedKey(), resolvedKey)) {
            state.selectKey(resolvedKey);
        }

        if (draft == null || !Objects.equals(draft.clusterId(), cluster.clusterId())) {
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

        Set<GridSegment2x> nextPreview = new LinkedHashSet<>(draft.previewEdges());
        nextPreview.addAll(result.committedEdges());
        Set<GridSegment2x> nextSkipped = new LinkedHashSet<>(draft.skippedConnectionEdges());
        nextSkipped.addAll(result.skippedConnectionEdges());
        showDraft(new Draft(
                draft.clusterId(),
                draft.deleteMode(),
                draft.startVertex(),
                vertex,
                nextPreview,
                nextSkipped,
                statusMessage(deleteMode, nextPreview, nextSkipped)));

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
        Set<GridSegment2x> edges = currentDraft.previewEdges();
        clear();
        if (mapId == null || edges.isEmpty()) {
            return true;
        }
        loadingService.submitMutation(
                () -> {
                    boundaryEditService.apply(
                        mapId,
                        currentDraft.clusterId(),
                        mapState.activeProjectionLevel(),
                        edges,
                        InternalBoundaryType.WALL,
                        currentDraft.deleteMode());
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("BoundaryTool.finishDraft()", throwable));
        return true;
    }

    private ResolvedBoundaryVertex resolveBoundaryVertex(EditorToolContext ctx, boolean deleteMode) {
        DungeonLayout layout = ctx == null ? null : ctx.activeMap();
        GridPoint2x vertex = firstVertex(ctx == null ? null : ctx.selection());
        if (layout == null || vertex == null) {
            return null;
        }
        Long draftClusterId = activeBoundaryDraftClusterId();
        if (isEditableCluster(draftClusterId, layout, vertex, deleteMode)) {
            return new ResolvedBoundaryVertex(draftClusterId, vertex);
        }

        Long selectedClusterId = DungeonSelectionLookup.clusterId(layout, state.selectedKey());
        if (isEditableCluster(selectedClusterId, layout, vertex, deleteMode)) {
            return new ResolvedBoundaryVertex(selectedClusterId, vertex);
        }

        Long boundaryClusterId = boundaryClusterId(ctx == null ? null : ctx.selection());
        if (isEditableCluster(boundaryClusterId, layout, vertex, deleteMode)) {
            return new ResolvedBoundaryVertex(boundaryClusterId, vertex);
        }
        return null;
    }

    private boolean isEditableCluster(Long clusterId, DungeonLayout layout, GridPoint2x vertex, boolean deleteMode) {
        RoomCluster cluster = clusterOnActiveLevel(clusterId, layout);
        return cluster != null && pathPlanner.isEditableVertex(cluster, vertex, deleteMode);
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

    private static GridPoint2x firstVertex(features.world.dungeonmap.shell.interaction.DungeonSelection selection) {
        DungeonHitSubject subject = selection == null
                ? null
                : selection.firstSubjectMatching(candidate -> candidate instanceof DungeonHitSubject.VertexSubject);
        if (subject instanceof DungeonHitSubject.VertexSubject vertexSubject) {
            return vertexSubject.vertex2x();
        }
        return null;
    }

    private static GridPoint2x selectedVertex(EditorToolContext ctx) {
        return ctx != null && ctx.resolvedSubject() instanceof DungeonHitSubject.VertexSubject vertexSubject
                ? vertexSubject.vertex2x()
                : null;
    }

    private static Long boundaryClusterId(features.world.dungeonmap.shell.interaction.DungeonSelection selection) {
        if (selection == null) {
            return null;
        }
        DungeonHitSubject subject = selection.firstSubjectMatching(candidate ->
                candidate instanceof DungeonHitSubject.ClusterBoundarySubject
                        || candidate instanceof DungeonHitSubject.RoomBoundarySubject);
        return clusterIdFromBoundarySubject(subject);
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

    private static Long clusterIdFromBoundarySubject(DungeonHitSubject subject) {
        return switch (subject) {
            case DungeonHitSubject.ClusterBoundarySubject clusterBoundarySubject -> clusterBoundarySubject.clusterId();
            case DungeonHitSubject.RoomBoundarySubject roomBoundarySubject -> roomBoundarySubject.clusterId();
            default -> null;
        };
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
            boolean deleteMode,
            Set<GridSegment2x> previewEdges,
            Set<GridSegment2x> skippedConnectionEdges
    ) {
        if (deleteMode) {
            return previewEdges.isEmpty()
                    ? "Nur Außenwände getroffen, nichts zu löschen"
                    : "Innenwandpfad aktiv, Rechtsklick schließt ab";
        }
        if (!skippedConnectionEdges.isEmpty()) {
            return "Pfad aktiv, Türen bleiben erhalten, Rechtsklick schließt ab";
        }
        if (!previewEdges.isEmpty()) {
            return "Wandpfad aktiv, Rechtsklick oder Klick auf bestehende Wand schließt ab";
        }
        return "Pfad aktiv";
    }

    private record Draft(
            Long clusterId,
            boolean deleteMode,
            GridPoint2x startVertex,
            GridPoint2x currentVertex,
            Set<GridSegment2x> previewEdges,
            Set<GridSegment2x> skippedConnectionEdges,
            String statusMessage
    ) {
        private Draft {
            previewEdges = previewEdges == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(previewEdges));
            skippedConnectionEdges = skippedConnectionEdges == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(skippedConnectionEdges));
            statusMessage = statusMessage == null ? "" : statusMessage;
        }
    }

    private record ResolvedBoundaryVertex(
            Long clusterId,
            GridPoint2x vertex2x
    ) {
    }
}
