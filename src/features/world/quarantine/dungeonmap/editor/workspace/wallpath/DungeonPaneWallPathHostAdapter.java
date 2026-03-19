package features.world.quarantine.dungeonmap.editor.workspace.wallpath;

import features.world.quarantine.dungeonmap.editor.workspace.pane.AbstractDungeonPane;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonViewMode;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasCamera;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPaneRenderState;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterVertexRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonPaneWallPathHostAdapter implements WallPathInteractionController.Host {

    private final AbstractDungeonPane pane;
    private final DungeonPaneRenderState renderState;
    private final DungeonPanePreviewModel previewModel;
    private final DungeonPaneWallPathProjection projection;

    public DungeonPaneWallPathHostAdapter(
            AbstractDungeonPane pane,
            DungeonPaneRenderState renderState,
            DungeonPanePreviewModel previewModel,
            DungeonPaneWallPathProjection projection
    ) {
        this.pane = Objects.requireNonNull(pane, "pane");
        this.renderState = Objects.requireNonNull(renderState, "renderState");
        this.previewModel = Objects.requireNonNull(previewModel, "previewModel");
        this.projection = Objects.requireNonNull(projection, "projection");
    }

    @Override
    public DungeonLayout dungeonLayout() {
        return pane.dungeonLayout();
    }

    @Override
    public DungeonLayoutRenderData renderData() {
        return pane.sceneState().renderData();
    }

    @Override
    public DungeonCanvasCamera camera() {
        return pane.camera();
    }

    @Override
    public DungeonSelection selectedTarget() {
        return pane.sceneState().selectedTarget();
    }

    @Override
    public boolean layoutPresent() {
        return pane.layoutPresent();
    }

    @Override
    public features.world.quarantine.dungeonmap.editor.workspace.pane.DungeonPaneSceneState sceneState() {
        return pane.sceneState();
    }

    @Override
    public boolean editable() {
        return renderState.editable();
    }

    @Override
    public DungeonEditorTool editorTool() {
        return renderState.editorTool();
    }

    @Override
    public DungeonViewMode viewMode() {
        return pane.viewMode();
    }

    @Override
    public List<DungeonClusterVertexRef> findClusterVerticesNear(double screenX, double screenY) {
        return projection.findClusterVerticesNear(screenX, screenY);
    }

    @Override
    public DungeonClusterVertexRef findClusterVertexNear(long clusterId, double screenX, double screenY) {
        return projection.findClusterVertexNear(clusterId, screenX, screenY);
    }

    @Override
    public DungeonRoomCluster clusterById(long clusterId) {
        return pane.sceneState().clusterById(clusterId);
    }

    @Override
    public Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster) {
        return previewModel.geometry().clusterCellsFor(cluster);
    }

    @Override
    public void render() {
        pane.render();
    }
}
