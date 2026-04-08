package features.world.dungeon.shell.editor.interaction.state;

import features.world.dungeon.dungeonmap.cluster.application.state.DungeonClusterApplicationService;
import features.world.dungeon.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeon.dungeonmap.application.DungeonMapLoadingService;
import features.world.dungeon.dungeonmap.api.RoomBoundaryDescription;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridSegmentPath;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.shell.editor.state.EditorCards;
import features.world.dungeon.state.DungeonEditorTool;
import features.world.dungeon.state.DungeonEditorSessionState;
import features.world.dungeon.state.EditorHover;
import features.world.dungeon.state.EditorHoverScope;
import features.world.dungeon.dungeonmap.state.DungeonMapState;
import features.world.dungeon.shell.editor.interaction.input.EditorHitResolution;
import features.world.dungeon.shell.editor.interaction.input.EditorInteractionCapability;
import features.world.dungeon.shell.editor.interaction.input.EditorTool;
import features.world.dungeon.shell.editor.interaction.input.EditorToolContext;
import features.world.dungeon.shell.editor.interaction.input.EditorToolPhase;
import features.world.dungeon.shell.editor.interaction.tasks.EditorCapabilities;
import features.world.dungeon.state.EditorInteractionState;
import features.world.dungeon.state.EditorPreview;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import ui.async.UiErrorReporter;

import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Editor tool for drafting room boundary edits.
 *
 * <p>This tool owns wall-path gesture meaning and only publishes preview geometry through shared editor state. Local
 * door removal as part of one boundary path remains part of this tool's draft semantics.</p>
 */
public final class BoundaryTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final DungeonClusterApplicationService roomApplicationService;
    private final EditorInteractionState state;
    private final Label statusLabel = new Label("Kein Wandpfad aktiv");
    private final VBox statusCard = EditorCards.card("Wandpfad", statusLabel);

    private Draft draft;
    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };

    public BoundaryTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            DungeonClusterApplicationService roomApplicationService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.roomApplicationService = Objects.requireNonNull(roomApplicationService, "roomApplicationService");
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
    public List<EditorInteractionCapability> interactionCapabilities(EditorToolContext ctx, EditorToolPhase phase) {
        DungeonEditorTool tool = sessionState.selectedTool();
        if (tool == null || !tool.isWallTool()) {
            return List.of();
        }
        boolean deleteMode = tool == DungeonEditorTool.CLUSTER_WALL_DELETE;
        return List.of(EditorCapabilities.capability(capabilityCtx -> resolveWallCapability(capabilityCtx, deleteMode)));
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
        DungeonMap layout = ctx == null ? null : ctx.activeMap();
        GridPoint vertex = selectedVertex(ctx);
        DungeonSelectionRef resolvedRef = ctx == null ? null : ctx.resolvedRef();
        Cluster cluster = layout == null ? null : layout.clusterOnLevel(resolvedRef, mapState.activeProjectionLevel());
        if (layout == null || vertex == null || cluster == null || cluster.clusterId() == null) {
            if (activeBoundaryDraftClusterId() == null) {
                state.clearSelection();
            }
            return false;
        }
        if (!Objects.equals(state.selectedRef(), resolvedRef)) {
            state.selectRef(resolvedRef);
        }

        if (draft == null || !Objects.equals(draft.clusterId(), cluster.clusterId())) {
            showDraft(new Draft(
                    cluster.clusterId(),
                    deleteMode,
                    vertex,
                    vertex,
                    GridSegmentPath.empty(),
                    deleteMode
                            ? "Start auf Innenwand oder Tür gewählt, nächsten Eckpunkt anklicken"
                            : "Start-Eckpunkt gewählt, nächsten Eckpunkt anklicken"));
            return true;
        }

        if (Objects.equals(draft.currentVertex(), vertex)) {
            return true;
        }

        GridSegmentPath result = deleteMode
                ? cluster.findDeleteWallPath(draft.currentVertex(), vertex)
                : cluster.findCreateWallPath(draft.currentVertex(), vertex);
        if (result.isEmpty()) {
            showDraft(new Draft(
                    draft.clusterId(),
                    draft.deleteMode(),
                    draft.startVertex(),
                    draft.currentVertex(),
                    draft.previewPath(),
                    deleteMode
                            ? "Pfad kann nur entlang bestehender Innenwände oder Türen verlaufen"
                            : "Zwischen diesen Eckpunkten gibt es keinen gültigen Pfad"));
            return true;
        }

        GridSegmentPath nextPreview = GridSegmentPath.concat(draft.previewPath(), result);
        showDraft(new Draft(
                draft.clusterId(),
                draft.deleteMode(),
                draft.startVertex(),
                vertex,
                nextPreview,
                statusMessage(deleteMode, nextPreview)));

        if (!deleteMode && cluster.touchesExistingWall(vertex)) {
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
        GridSegmentPath path = currentDraft.previewPath();
        clear();
        if (mapId == null || path.isEmpty()) {
            return true;
        }
        loadingService.submitMutation(
                () -> {
                    roomApplicationService.editBoundary(new DungeonClusterApplicationService.ClusterBoundaryEditRequest(
                            mapId,
                            currentDraft.clusterId(),
                            mapState.activeProjectionLevel(),
                            path.boundary(),
                            DungeonClusterApplicationService.ClusterBoundaryTarget.WALL,
                            currentDraft.deleteMode()
                                    ? DungeonClusterApplicationService.ClusterBoundaryEditMode.DELETE
                                    : DungeonClusterApplicationService.ClusterBoundaryEditMode.CREATE));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("BoundaryTool.finishDraft()", throwable));
        return true;
    }

    private ResolvedBoundaryVertex resolveBoundaryVertex(EditorToolContext ctx, boolean deleteMode) {
        DungeonMap layout = ctx == null ? null : ctx.activeMap();
        GridPoint vertex = firstVertex(ctx == null ? null : ctx.snapshot());
        if (layout == null || vertex == null) {
            return null;
        }
        Long draftClusterId = activeBoundaryDraftClusterId();
        if (isEditableCluster(draftClusterId, layout, vertex, deleteMode)) {
            return new ResolvedBoundaryVertex(draftClusterId, vertex);
        }

        Cluster selectedCluster = layout.clusterOnLevel(state.selectedRef(), mapState.activeProjectionLevel());
        Long selectedClusterId = selectedCluster == null ? null : selectedCluster.clusterId();
        if (isEditableCluster(selectedClusterId, layout, vertex, deleteMode)) {
            return new ResolvedBoundaryVertex(selectedClusterId, vertex);
        }

        int levelZ = ctx == null || ctx.probe() == null ? mapState.activeProjectionLevel() : ctx.probe().levelZ();
        Long boundaryClusterId = boundaryClusterId(ctx == null ? null : ctx.snapshot(), layout, levelZ);
        if (isEditableCluster(boundaryClusterId, layout, vertex, deleteMode)) {
            return new ResolvedBoundaryVertex(boundaryClusterId, vertex);
        }
        return null;
    }

    private boolean isEditableCluster(Long clusterId, DungeonMap layout, GridPoint vertex, boolean deleteMode) {
        Cluster cluster = clusterOnActiveLevel(clusterId, layout);
        return cluster != null && cluster.isEditableWallVertex(vertex, deleteMode);
    }

    private Long activeBoundaryDraftClusterId() {
        return draft == null ? null : draft.clusterId();
    }

    private Cluster clusterOnActiveLevel(Long clusterId, DungeonMap layout) {
        if (clusterId == null || layout == null) {
            return null;
        }
        Cluster cluster = layout.findCluster(clusterId);
        return cluster == null ? null : cluster.projectedToLevel(mapState.activeProjectionLevel());
    }

    private static GridPoint firstVertex(features.world.dungeon.shell.interaction.DungeonHitSnapshot snapshot) {
        DungeonSelectionRef ref = snapshot == null
                ? null
                : snapshot.firstRefMatching(candidate -> candidate instanceof DungeonSelectionRef.VertexRef);
        if (ref instanceof DungeonSelectionRef.VertexRef vertexRef) {
            return vertexRef.vertex();
        }
        return null;
    }

    private static GridPoint selectedVertex(EditorToolContext ctx) {
        return ctx != null && ctx.hitRef() instanceof DungeonSelectionRef.VertexRef vertexRef
                ? vertexRef.vertex()
                : null;
    }

    private static Long boundaryClusterId(
            features.world.dungeon.shell.interaction.DungeonHitSnapshot snapshot,
            DungeonMap layout,
            int levelZ
    ) {
        if (snapshot == null || layout == null) {
            return null;
        }
        DungeonSelectionRef ref = snapshot.firstRefMatching(candidate -> candidate instanceof DungeonSelectionRef.RoomBoundaryRef);
        if (!(ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundaryRef)) {
            return null;
        }
        RoomBoundaryDescription description = layout.describeRoomBoundary(roomBoundaryRef, levelZ);
        return description == null ? null : description.clusterId();
    }

    private void showDraft(Draft nextDraft) {
        draft = nextDraft;
        state.showPreview(new EditorPreview.BoundaryPreview(
                nextDraft.previewPath(),
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

    private static DungeonSelectionRef clusterOwnerRef(Long clusterId) {
        if (clusterId == null) {
            return null;
        }
        return new DungeonSelectionRef.ClusterRef(clusterId);
    }

    private EditorHitResolution resolveWallCapability(EditorToolContext ctx, boolean deleteMode) {
        ResolvedBoundaryVertex resolved = resolveBoundaryVertex(ctx, deleteMode);
        if (resolved == null) {
            return EditorHitResolution.none();
        }
        DungeonSelectionRef hitRef = new DungeonSelectionRef.VertexRef(resolved.vertex());
        DungeonSelectionRef resolvedRef = clusterOwnerRef(resolved.clusterId());
        return new EditorHitResolution(hitRef, resolvedRef, new EditorHover(hitRef, EditorHoverScope.PART));
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
            return "Eckpunkte auf bestehender Innenwand oder Tür anklicken, Rechtsklick schließt ab";
        }
        return null;
    }

    private static String statusMessage(
            boolean deleteMode,
            GridSegmentPath previewPath
    ) {
        if (deleteMode) {
            return previewPath == null || previewPath.isEmpty()
                    ? "Nur Außenwände getroffen, nichts zu löschen"
                    : "Innenwand-/Türpfad aktiv, Rechtsklick schließt ab";
        }
        if (previewPath != null && !previewPath.isEmpty()) {
            return "Wandpfad aktiv, Rechtsklick oder Klick auf bestehende Wand schließt ab";
        }
        return "Pfad aktiv";
    }

    private record Draft(
            Long clusterId,
            boolean deleteMode,
            GridPoint startVertex,
            GridPoint currentVertex,
            GridSegmentPath previewPath,
            String statusMessage
    ) {
        private Draft {
            previewPath = previewPath == null ? GridSegmentPath.empty() : previewPath;
            statusMessage = statusMessage == null ? "" : statusMessage;
        }
    }

    private record ResolvedBoundaryVertex(
            Long clusterId,
            GridPoint vertex
    ) {
    }
}
