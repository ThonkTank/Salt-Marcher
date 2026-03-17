package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.DungeonClusterEdgePath;
import features.world.dungeonmap.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.DungeonClusterVertexRef;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.ui.workspace.DungeonEditorTool;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;

public final class WallPathInteractionController {

    public record StateSnapshot(
            DungeonClusterVertexRef activeAnchor,
            List<DungeonClusterEdgeRef> previewPath,
            boolean commitPending,
            DungeonClusterVertexRef pendingAnchor
    ) {
    }

    private final Host host;
    private Consumer<WallPathCommitRequest> onCommitRequested = request -> { };
    private Runnable onStateChanged = () -> { };
    private DungeonClusterVertexRef activeAnchor;
    private List<DungeonClusterEdgeRef> previewPath = List.of();
    private boolean commitPending;
    private DungeonClusterVertexRef pendingAnchor;

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

    public void applyCommitResult(DungeonClusterVertexRef nextAnchor) {
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
        DungeonClusterVertexRef vertexRef = host.findClusterVertexAt(screenX, screenY);
        if (vertexRef == null) {
            return false;
        }
        if (activeAnchor == null) {
            DungeonRoomCluster cluster = host.clusterById(vertexRef.clusterId());
            if (cluster == null || !DungeonClusterEdgePath.isPathVertex(
                    cluster.clusterId(),
                    host.clusterCellsFor(cluster),
                    vertexRef,
                    traversableEdgesFor(cluster))) {
                return false;
            }
            activeAnchor = vertexRef;
            previewPath = List.of();
            stateChanged();
            return true;
        }
        if (commitPending || activeAnchor.clusterId() != vertexRef.clusterId()) {
            return true;
        }
        DungeonRoomCluster cluster = host.clusterById(vertexRef.clusterId());
        if (cluster == null) {
            reset();
            return true;
        }
        List<DungeonClusterEdgeRef> path = DungeonClusterEdgePath.shortestInternalPath(
                cluster.clusterId(),
                host.clusterCellsFor(cluster),
                activeAnchor,
                vertexRef,
                traversableEdgesFor(cluster));
        if (path.isEmpty()) {
            return true;
        }
        commitPending = true;
        previewPath = List.of();
        pendingAnchor = vertexRef;
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
        DungeonClusterVertexRef hoveredVertex = host.findClusterVertexAt(screenX, screenY);
        if (hoveredVertex == null || hoveredVertex.clusterId() != activeAnchor.clusterId()) {
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
                hoveredVertex,
                traversableEdgesFor(cluster));
        if (!previewPath.equals(nextPreview)) {
            previewPath = nextPreview;
            stateChanged();
        }
    }

    public DungeonClusterVertexRef activeAnchor() {
        return activeAnchor;
    }

    public List<DungeonClusterEdgeRef> previewPath() {
        return previewPath;
    }

    public DungeonClusterVertexRef displayedAnchor() {
        return pendingAnchor != null ? pendingAnchor : activeAnchor;
    }

    public StateSnapshot snapshotState() {
        if (!hasState()) {
            return null;
        }
        return new StateSnapshot(activeAnchor, List.copyOf(previewPath), commitPending, pendingAnchor);
    }

    public void restoreState(StateSnapshot snapshot) {
        if (snapshot == null) {
            reset();
            return;
        }
        activeAnchor = snapshot.activeAnchor();
        previewPath = List.copyOf(snapshot.previewPath());
        commitPending = snapshot.commitPending();
        pendingAnchor = snapshot.pendingAnchor();
        stateChanged();
    }

    private boolean isActiveTool() {
        return host.editable()
                && host.editorTool().isWallTool()
                && host.surface() == AbstractDungeonPane.EditorSurface.GRID;
    }

    private void clearPreviewIfNeeded() {
        if (!previewPath.isEmpty()) {
            previewPath = List.of();
            stateChanged();
        }
    }

    private Set<DungeonClusterEdgeRef> traversableEdgesFor(DungeonRoomCluster cluster) {
        if (cluster == null || host.editorTool() != DungeonEditorTool.CLUSTER_WALL_DELETE) {
            return null;
        }
        Set<DungeonClusterEdgeRef> traversable = new java.util.LinkedHashSet<>();
        for (DungeonRoomCluster.EdgeOverride edge : cluster.edgeOverrides()) {
            if (edge.type() != DungeonRoomCluster.EdgeType.WALL) {
                continue;
            }
            traversable.add(new DungeonClusterEdgeRef(
                    cluster.clusterId(),
                    edge.absoluteCell(cluster.center()),
                    edge.direction()));
        }
        return traversable;
    }

    private void stateChanged() {
        host.render();
        onStateChanged.run();
    }

    private boolean hasState() {
        return activeAnchor != null || !previewPath.isEmpty() || commitPending || pendingAnchor != null;
    }

    interface Host {
        boolean editable();
        DungeonEditorTool editorTool();
        AbstractDungeonPane.EditorSurface surface();
        DungeonClusterVertexRef findClusterVertexAt(double screenX, double screenY);
        DungeonRoomCluster clusterById(long clusterId);
        Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster);
        void render();
    }
}
