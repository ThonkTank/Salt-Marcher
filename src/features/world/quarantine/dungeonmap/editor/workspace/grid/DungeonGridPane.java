package features.world.quarantine.dungeonmap.editor.workspace.grid;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonViewMode;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorEditInteractionController;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonCorridorDoorProjector;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.DungeonWallPathSessionState;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.WallPathInteractionController;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRules;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterVertexRef;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterGeometry;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.corridors.model.primitives.GridSegment;
import features.world.quarantine.dungeonmap.canvas.state.ClusterAnchorLayout;
import features.world.quarantine.dungeonmap.canvas.state.CorridorRenderKeys;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonBaseGridHitTester;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonBaseGridRenderer;
import features.world.quarantine.dungeonmap.editor.workspace.contract.DungeonPaneInteractionSink;
import features.world.quarantine.dungeonmap.editor.workspace.pane.AbstractDungeonPane;
import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPaneHitTestProjection;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPaneSelectionAreaProjection;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.DungeonPaneWallPathProjection;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasCamera;
import features.world.quarantine.dungeonmap.canvas.DungeonCanvasTheme;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonGridScreenMath;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonGridRenderer;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorDoorHit;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;
import javafx.scene.canvas.GraphicsContext;

import java.util.List;
import java.util.Set;

public final class DungeonGridPane extends AbstractDungeonPane implements
        DungeonPaneSelectionAreaProjection,
        DungeonPaneWallPathProjection {

    private final DungeonWallPathSessionState wallPathState;
    private final DungeonGridWallPathSupport wallPathSupport;
    private final DungeonBaseGridHitTester.LookupContext lookupContext;
    private final DungeonGridScreenMath.ScreenPointResolver screenResolver = new DungeonGridScreenMath.ScreenPointResolver() {
        @Override
        public double screenX(double worldX) {
            return camera.toScreenX(worldX);
        }

        @Override
        public double screenY(double worldY) {
            return camera.toScreenY(worldY);
        }
    };
    private final DungeonGridHitTestDelegate hitTestDelegate;
    private final DungeonGridVertexSupport vertexSupport;
    private final DungeonGridVisualSupport visualSupport;
    private final DungeonBaseGridRenderer.RenderContext renderContext;

    public DungeonGridPane(DungeonCanvasCamera camera, DungeonPaneInteractionSink interactionSink) {
        super(camera);
        initInteractions(this, this, interactionSink);
        // Interaction-backed helpers must be created after initInteractions() wires the controllers.
        this.lookupContext = new DungeonGridLookupContext(this);
        this.wallPathState = new DungeonWallPathSessionState(interactions().wallPathController());
        this.wallPathSupport = new DungeonGridWallPathSupport(
                this, interactions().renderState(), interactions().wallPathController());
        this.hitTestDelegate = new DungeonGridHitTestDelegate(
                lookupContext, interactions().previewModel(), interactions().corridorWorkspace(), screenResolver);
        this.vertexSupport = new DungeonGridVertexSupport(
                this, interactions().previewModel(), (x, y) -> hitTestDelegate.findClusterAt(new ScreenPoint(x, y)));
        this.visualSupport = new DungeonGridVisualSupport(
                this, interactions().previewModel(), interactions().corridorWorkspace(), interactions().renderState());
        this.renderContext = new DungeonGridRenderContext(this, visualSupport);
    }

    public DungeonWallPathSessionState wallPathState() {
        return wallPathState;
    }

    public DungeonEditorTool activeEditorTool() {
        return interactions().renderState().editorTool();
    }

    @Override
    protected void renderContent(GraphicsContext gc) {
        DungeonBaseGridRenderer.renderBaseGrid(gc, renderContext);
        wallPathSupport.drawWallPathPreview(gc);
        visualSupport.drawCorridorEditHandles(gc);
        visualSupport.drawSelectionPreview(gc);
        visualSupport.drawPaintPreview(gc);
    }

    void drawGrid(GraphicsContext gc) {
        DungeonGridRenderer.drawGrid(
                gc,
                camera.visibleMinWorldX(),
                camera.visibleMaxWorldX(),
                camera.visibleMinWorldY(),
                camera.visibleMaxWorldY(),
                canvas().getWidth(),
                canvas().getHeight(),
                screenResolver);
    }

    @Override
    public DungeonPaneHitTestProjection hitTestDelegate() {
        return hitTestDelegate;
    }

    @Override
    public Point2i worldPointAt(double screenX, double screenY) {
        int x = (int) Math.floor(camera.toWorldX(screenX));
        int y = (int) Math.floor(camera.toWorldY(screenY));
        return new Point2i(x, y);
    }

    @Override
    public DungeonViewMode viewMode() {
        return DungeonViewMode.GRID;
    }

    @Override
    public DungeonClusterEdgeRef findClusterEdgeAt(double screenX, double screenY) {
        return vertexSupport.findClusterEdgeAt(screenX, screenY);
    }

    public DungeonClusterVertexRef findClusterVertexAt(double screenX, double screenY) {
        return vertexSupport.findClusterVertexAt(screenX, screenY);
    }

    @Override
    public List<DungeonClusterVertexRef> findClusterVerticesNear(double screenX, double screenY) {
        return vertexSupport.findClusterVerticesNear(screenX, screenY);
    }

    @Override
    public DungeonClusterVertexRef findClusterVertexNear(long clusterId, double screenX, double screenY) {
        return vertexSupport.findClusterVertexNear(clusterId, screenX, screenY);
    }

    @Override
    public DungeonRoomCluster findClusterInSelection(Point2i startInclusive, Point2i endInclusive) {
        return vertexSupport.findClusterInSelection(startInclusive, endInclusive);
    }

}
