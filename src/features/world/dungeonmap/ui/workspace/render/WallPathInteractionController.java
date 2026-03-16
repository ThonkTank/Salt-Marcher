package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.DungeonClusterEdgePath;
import features.world.dungeonmap.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.ui.workspace.DungeonEditorTool;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;

public final class WallPathInteractionController {

    private final Host host;
    private Consumer<WallPathCommitRequest> onCommitRequested = request -> { };
    private Runnable onStateChanged = () -> { };
    private DungeonClusterEdgeRef activeAnchor;
    private List<DungeonClusterEdgeRef> previewPath = List.of();
    private boolean commitPending;
    private DungeonClusterEdgeRef pendingAnchor;

    WallPathInteractionController(Host host) {
        this.host = Objects.requireNonNull(host, "host");
    }

    public void setOnCommitRequested(Consumer<WallPathCommitRequest> onCommitRequested) {
        this.onCommitRequested = Objects.requireNonNull(onCommitRequested, "onCommitRequested");
    }

    public void setOnStateChanged(Runnable onStateChanged) {
        this.onStateChanged = Objects.requireNonNull(onStateChanged, "onStateChanged");
    }

    void reset() {
        activeAnchor = null;
        previewPath = List.of();
        commitPending = false;
        pendingAnchor = null;
        stateChanged();
    }

    public void cancel() {
        if (!hasState()) {
            return;
        }
        reset();
    }

    public void applyCommitResult(DungeonClusterEdgeRef nextAnchor) {
        activeAnchor = nextAnchor;
        previewPath = List.of();
        commitPending = false;
        pendingAnchor = null;
        stateChanged();
    }

    public void revertPendingCommit() {
        if (!commitPending && pendingAnchor == null) {
            return;
        }
        commitPending = false;
        pendingAnchor = null;
        stateChanged();
    }

    boolean handlePrimaryPress(double screenX, double screenY) {
        if (!isActiveTool()) {
            return false;
        }
        DungeonClusterEdgeRef edgeRef = host.findClusterEdgeAt(screenX, screenY);
        if (edgeRef == null) {
            return false;
        }
        if (activeAnchor == null) {
            activeAnchor = edgeRef;
            previewPath = List.of();
            stateChanged();
            return true;
        }
        if (commitPending || activeAnchor.clusterId() != edgeRef.clusterId()) {
            return true;
        }
        DungeonRoomCluster cluster = host.clusterById(edgeRef.clusterId());
        if (cluster == null) {
            reset();
            return true;
        }
        List<DungeonClusterEdgeRef> path = DungeonClusterEdgePath.shortestInternalPath(
                cluster.clusterId(),
                host.clusterCellsFor(cluster),
                activeAnchor,
                edgeRef);
        if (path.isEmpty()) {
            if (isExistingWall(edgeRef)) {
                reset();
            }
            return true;
        }
        commitPending = true;
        previewPath = List.of();
        pendingAnchor = isExistingWall(edgeRef) ? null : edgeRef;
        stateChanged();
        onCommitRequested.accept(new WallPathCommitRequest(Set.copyOf(path), pendingAnchor));
        return true;
    }

    boolean handleSecondaryPress() {
        if (!isActiveTool() || activeAnchor == null) {
            return false;
        }
        reset();
        return true;
    }

    boolean handleKeyPressed(KeyEvent event) {
        if (event.getCode() != KeyCode.ESCAPE || !isActiveTool() || activeAnchor == null) {
            return false;
        }
        reset();
        event.consume();
        return true;
    }

    void handlePointerMove(double screenX, double screenY) {
        if (!isActiveTool() || activeAnchor == null || commitPending) {
            clearPreviewIfNeeded();
            return;
        }
        DungeonClusterEdgeRef hoveredEdge = host.findClusterEdgeAt(screenX, screenY);
        if (hoveredEdge == null || hoveredEdge.clusterId() != activeAnchor.clusterId()) {
            clearPreviewIfNeeded();
            return;
        }
        DungeonRoomCluster cluster = host.clusterById(activeAnchor.clusterId());
        if (cluster == null) {
            reset();
            return;
        }
        List<DungeonClusterEdgeRef> nextPreview = DungeonClusterEdgePath.shortestInternalPath(
                cluster.clusterId(),
                host.clusterCellsFor(cluster),
                activeAnchor,
                hoveredEdge);
        if (!previewPath.equals(nextPreview)) {
            previewPath = nextPreview;
            stateChanged();
        }
    }

    public DungeonClusterEdgeRef activeAnchor() {
        return activeAnchor;
    }

    public List<DungeonClusterEdgeRef> previewPath() {
        return previewPath;
    }

    public DungeonClusterEdgeRef displayedAnchor() {
        return pendingAnchor != null ? pendingAnchor : activeAnchor;
    }

    private boolean isActiveTool() {
        return host.editable()
                && host.editorTool() == DungeonEditorTool.CLUSTER_WALL
                && host.surface() == AbstractDungeonPane.EditorSurface.GRID;
    }

    private boolean isExistingWall(DungeonClusterEdgeRef edgeRef) {
        DungeonRoomCluster cluster = host.clusterById(edgeRef.clusterId());
        if (cluster == null) {
            return false;
        }
        Set<Point2i> clusterCells = host.clusterCellsFor(cluster);
        if (isOuterEdge(clusterCells, edgeRef)) {
            return true;
        }
        if (!isInternalEdge(clusterCells, edgeRef)) {
            return false;
        }
        DungeonRoomCluster.EdgeOverride canonical = DungeonRoomCluster.EdgeOverride.of(
                edgeRef.cell(),
                edgeRef.direction(),
                DungeonRoomCluster.EdgeType.WALL);
        return cluster.edgeOverrides().stream().anyMatch(edge ->
                edge.type() == DungeonRoomCluster.EdgeType.WALL
                        && edge.cell().equals(canonical.cell())
                        && edge.direction() == canonical.direction());
    }

    private void clearPreviewIfNeeded() {
        if (!previewPath.isEmpty()) {
            previewPath = List.of();
            stateChanged();
        }
    }

    private void stateChanged() {
        host.render();
        onStateChanged.run();
    }

    private static boolean isInternalEdge(Set<Point2i> clusterCells, DungeonClusterEdgeRef edgeRef) {
        if (edgeRef == null || edgeRef.cell() == null || edgeRef.direction() == null || clusterCells == null) {
            return false;
        }
        Point2i neighbor = edgeRef.cell().add(edgeRef.direction().delta());
        return clusterCells.contains(edgeRef.cell()) && clusterCells.contains(neighbor);
    }

    private static boolean isOuterEdge(Set<Point2i> clusterCells, DungeonClusterEdgeRef edgeRef) {
        if (edgeRef == null || edgeRef.cell() == null || edgeRef.direction() == null || clusterCells == null) {
            return false;
        }
        Point2i neighbor = edgeRef.cell().add(edgeRef.direction().delta());
        return clusterCells.contains(edgeRef.cell()) && !clusterCells.contains(neighbor);
    }

    private boolean hasState() {
        return activeAnchor != null || !previewPath.isEmpty() || commitPending || pendingAnchor != null;
    }

    interface Host {
        boolean editable();
        DungeonEditorTool editorTool();
        AbstractDungeonPane.EditorSurface surface();
        DungeonClusterEdgeRef findClusterEdgeAt(double screenX, double screenY);
        DungeonRoomCluster clusterById(long clusterId);
        Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster);
        void render();
    }
}
