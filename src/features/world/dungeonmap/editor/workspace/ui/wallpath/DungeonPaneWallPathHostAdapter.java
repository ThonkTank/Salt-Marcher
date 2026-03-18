package features.world.dungeonmap.editor.workspace.ui.wallpath;

import features.world.dungeonmap.editor.workspace.ui.base.AbstractDungeonPane;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorSurface;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.view.model.DungeonSelection;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPanePreviewModel;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPaneRenderState;
import features.world.dungeonmap.rooms.model.DungeonClusterVertexRef;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;

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
    public boolean editable() {
        return renderState.editable();
    }

    @Override
    public DungeonEditorTool editorTool() {
        return renderState.editorTool();
    }

    @Override
    public DungeonEditorSurface surface() {
        return pane.surface();
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
        return pane.clusterById(clusterId);
    }

    @Override
    public Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster) {
        return previewModel.clusterCellsFor(cluster);
    }

    @Override
    public void render() {
        pane.render();
    }
}
