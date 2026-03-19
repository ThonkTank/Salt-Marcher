package features.world.quarantine.dungeonmap.editor.workspace.wallpath;

import features.world.quarantine.dungeonmap.editor.workspace.wallpath.DungeonWallPathState;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonViewMode;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgePath;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRules;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterVertexRef;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonPaneContext;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;

public final class WallPathInteractionController {

    private final Host host;
    private Consumer<WallPathCommitRequest> onCommitRequested = request -> { };
    private Runnable onStateChanged = () -> { };
    private DungeonClusterVertexRef activeAnchor;
    private List<DungeonClusterEdgeRef> previewPath = List.of();
    private boolean commitPending;
    private DungeonClusterVertexRef pendingAnchor;
    private Set<DungeonClusterEdgeRef> cachedTraversableEdges;
    private long cachedTraversableClusterId = -1;

    public WallPathInteractionController(Host host) {
        this.host = Objects.requireNonNull(host, "host");
    }

    public void setOnCommitRequested(Consumer<WallPathCommitRequest> onCommitRequested) {
        this.onCommitRequested = Objects.requireNonNull(onCommitRequested, "onCommitRequested");
    }

    public void setOnStateChanged(Runnable onStateChanged) {
        this.onStateChanged = Objects.requireNonNull(onStateChanged, "onStateChanged");
    }

    public void reset() {
        activeAnchor = null;
        previewPath = List.of();
        commitPending = false;
        pendingAnchor = null;
        cachedTraversableClusterId = -1;
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
        cachedTraversableClusterId = -1;
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

    public boolean handlePrimaryPress(double screenX, double screenY) {
        if (!isActiveTool()) {
            return false;
        }
        DungeonClusterVertexRef vertexRef = resolveStartVertex(screenX, screenY);
        if (vertexRef == null) {
            return false;
        }
        if (activeAnchor == null) {
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

    public boolean handleSecondaryPress() {
        if (!isActiveTool() || activeAnchor == null) {
            return false;
        }
        reset();
        return true;
    }

    public boolean handleKeyPressed(KeyEvent event) {
        if (event.getCode() != KeyCode.ESCAPE || !isActiveTool() || activeAnchor == null) {
            return false;
        }
        reset();
        event.consume();
        return true;
    }

    public void handlePointerMove(double screenX, double screenY) {
        if (!isActiveTool() || activeAnchor == null || commitPending) {
            clearPreviewIfNeeded();
            return;
        }
        DungeonClusterVertexRef hoveredVertex = resolveContinuationVertex(screenX, screenY);
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

    public DungeonWallPathState snapshotState() {
        if (!hasState()) {
            return null;
        }
        return new DungeonWallPathState(activeAnchor, List.copyOf(previewPath), commitPending, pendingAnchor);
    }

    public void restoreState(DungeonWallPathState state) {
        if (state == null) {
            reset();
            return;
        }
        activeAnchor = state.activeAnchor();
        previewPath = List.copyOf(state.previewPath());
        commitPending = state.commitPending();
        pendingAnchor = state.pendingAnchor();
        cachedTraversableClusterId = -1;
        stateChanged();
    }

    private boolean isActiveTool() {
        return host.editable()
                && host.editorTool().isWallTool()
                && host.viewMode() == DungeonViewMode.GRID;
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
        if (cluster.clusterId() == cachedTraversableClusterId) {
            return cachedTraversableEdges;
        }
        Set<DungeonClusterEdgeRef> traversable = new LinkedHashSet<>();
        for (DungeonRoomCluster.EdgeOverride edge : cluster.edgeOverrides()) {
            if (!DungeonClusterEdgeRules.providesWall(edge.type())) {
                continue;
            }
            traversable.add(new DungeonClusterEdgeRef(
                    cluster.clusterId(),
                    edge.absoluteCell(cluster.center()),
                    edge.direction()));
        }
        cachedTraversableEdges = traversable;
        cachedTraversableClusterId = cluster.clusterId();
        return traversable;
    }

    private void stateChanged() {
        host.render();
        onStateChanged.run();
    }

    private boolean hasState() {
        return activeAnchor != null || !previewPath.isEmpty() || commitPending || pendingAnchor != null;
    }

    private DungeonClusterVertexRef resolveStartVertex(double screenX, double screenY) {
        for (DungeonClusterVertexRef candidate : host.findClusterVerticesNear(screenX, screenY)) {
            DungeonRoomCluster cluster = host.clusterById(candidate.clusterId());
            if (cluster == null) {
                continue;
            }
            if (DungeonClusterEdgePath.isPathVertex(
                    cluster.clusterId(),
                    host.clusterCellsFor(cluster),
                    candidate,
                    traversableEdgesFor(cluster))) {
                return candidate;
            }
        }
        return null;
    }

    private DungeonClusterVertexRef resolveContinuationVertex(double screenX, double screenY) {
        if (activeAnchor == null) {
            return null;
        }
        return host.findClusterVertexNear(activeAnchor.clusterId(), screenX, screenY);
    }

    public interface Host extends DungeonPaneContext {
        boolean editable();
        DungeonEditorTool editorTool();
        DungeonViewMode viewMode();
        List<DungeonClusterVertexRef> findClusterVerticesNear(double screenX, double screenY);
        DungeonClusterVertexRef findClusterVertexNear(long clusterId, double screenX, double screenY);
        DungeonRoomCluster clusterById(long clusterId);
        Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster);
        void render();
    }
}
