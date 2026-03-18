package features.world.dungeonmap.editor.workspace.ui.grid;

import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorSurface;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorEditInteractionController;
import features.world.dungeonmap.editor.workspace.ui.corridor.DungeonCorridorProjectionSupport;
import features.world.dungeonmap.editor.workspace.ui.wallpath.DungeonWallPathSessionState;
import features.world.dungeonmap.editor.workspace.ui.wallpath.WallPathInteractionController;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.rooms.model.DungeonClusterEdgeRules;
import features.world.dungeonmap.rooms.model.DungeonClusterVertexRef;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.rooms.model.DungeonClusterGeometry;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.corridors.model.GridSegment;
import features.world.dungeonmap.canvas.rendering.ClusterAnchorLayout;
import features.world.dungeonmap.canvas.rendering.CorridorRenderKeys;
import features.world.dungeonmap.canvas.rendering.DungeonBaseGridHitTester;
import features.world.dungeonmap.canvas.rendering.DungeonBaseGridRenderer;
import features.world.dungeonmap.editor.workspace.ui.base.AbstractDungeonPane;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneGraphCreationProjection;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneGridPointerProjection;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPaneSelectionAreaProjection;
import features.world.dungeonmap.editor.workspace.ui.wallpath.DungeonPaneWallPathProjection;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasTheme;
import features.world.dungeonmap.canvas.rendering.DungeonGridScreenMath;
import features.world.dungeonmap.canvas.rendering.DungeonGridRenderSupport;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorDoorHit;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import javafx.scene.canvas.GraphicsContext;

import java.util.List;
import java.util.Set;

public final class DungeonGridPane extends AbstractDungeonPane implements
        DungeonPaneGridPointerProjection,
        DungeonPaneSelectionAreaProjection,
        DungeonPaneWallPathProjection {

    private final DungeonWallPathSessionState wallPathState = new DungeonWallPathSessionState(
            interactions().wallPathController());
    private final DungeonGridWallPathSupport wallPathSupport = new DungeonGridWallPathSupport(
            this, interactions().renderState(), interactions().wallPathController());
    private final DungeonGridVertexSupport vertexSupport = new DungeonGridVertexSupport(
            this, interactions().previewModel(), this::findClusterAt);
    private final DungeonGridVisualSupport visualSupport = new DungeonGridVisualSupport(
            this, interactions().previewModel(), interactions().corridorWorkspace(), interactions().renderState());
    private final DungeonBaseGridRenderer.RenderContext renderContext = new DungeonGridRenderContext(this, visualSupport);
    private final DungeonBaseGridHitTester.LookupContext lookupContext = new DungeonGridLookupContext(this);
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

    public DungeonGridPane(DungeonCanvasCamera camera) {
        super(camera);
        initInteractions(this, DungeonPaneGraphCreationProjection.UNSUPPORTED, this, this);
    }

    public DungeonWallPathSessionState wallPathState() {
        return wallPathState;
    }

    public DungeonEditorTool activeEditorTool() {
        return editorTool();
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
        DungeonGridRenderSupport.drawGrid(
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
    public DungeonRoomCluster findClusterAt(double screenX, double screenY) {
        return DungeonBaseGridHitTester.findClusterAt(lookupContext, screenX, screenY);
    }

    @Override
    public DungeonRoom findRoomAt(double screenX, double screenY) {
        return DungeonBaseGridHitTester.findRoomAt(lookupContext, screenX, screenY);
    }

    @Override
    public DungeonCorridor findCorridorAt(double screenX, double screenY) {
        return DungeonBaseGridHitTester.findCorridorAt(lookupContext, screenX, screenY);
    }

    @Override
    public CorridorDoorHit findCorridorDoorHitAt(double screenX, double screenY) {
        return interactions().corridorWorkspace().findNearestCorridorDoorHit(screenX, screenY);
    }

    @Override
    public double corridorDoorHitDistance(
            double screenX,
            double screenY,
            DungeonCorridor corridor,
            CorridorGeometry geometry,
            DoorSegment door
    ) {
        double doorDistance = interactions().previewModel().distanceToDoor(screenX, screenY, door);
        if (doorDistance > DungeonCanvasTheme.DOOR_HIT_RADIUS_PX) {
            return Double.POSITIVE_INFINITY;
        }
        double roomDistance = DungeonGridScreenMath.distanceToRoomCell(screenX, screenY, door.roomCell(), screenResolver);
        return doorDistance * 10 + roomDistance;
    }

    @Override
    public double selectedCorridorDoorHandleDistance(
            double screenX,
            double screenY,
            DungeonCorridorProjectionSupport.CorridorSelectionContext context,
            DoorSegment door
    ) {
        double distance = interactions().previewModel().distanceToDoor(screenX, screenY, door);
        return distance <= DungeonCanvasTheme.WAYPOINT_HIT_RADIUS_PX ? distance : Double.POSITIVE_INFINITY;
    }

    @Override
    public double selectedCorridorWaypointHandleDistance(
            double screenX,
            double screenY,
            DungeonCorridorProjectionSupport.CorridorSelectionContext context,
            Point2i waypoint
    ) {
        double distance = DungeonGridScreenMath.distanceToRoomCell(screenX, screenY, waypoint, screenResolver);
        return distance <= DungeonCanvasTheme.WAYPOINT_HIT_RADIUS_PX ? distance : Double.POSITIVE_INFINITY;
    }

    @Override
    public int corridorSegmentIndexAt(double screenX, double screenY) {
        DungeonCorridorProjectionSupport.CorridorSelectionContext context = interactions().corridorWorkspace().selectedCorridorContext();
        if (context == null || context.geometry().segments().isEmpty()) {
            return -1;
        }
        int bestSegmentIndex = -1;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (int index = 0; index < context.geometry().segments().size(); index++) {
            GridSegment segment = context.geometry().segments().get(index);
            double distance = DungeonGridScreenMath.distanceToSegment(screenX, screenY, segment.from(), segment.to(), screenResolver);
            if (distance <= DungeonCanvasTheme.CORRIDOR_LINK_HIT_RADIUS_PX && distance < bestDistance) {
                bestDistance = distance;
                bestSegmentIndex = index;
            }
        }
        return bestSegmentIndex;
    }

    @Override
    public Point2i worldPointAt(double screenX, double screenY) {
        int x = (int) Math.floor(camera.toWorldX(screenX));
        int y = (int) Math.floor(camera.toWorldY(screenY));
        return new Point2i(x, y);
    }

    @Override
    public DungeonEditorSurface surface() {
        return DungeonEditorSurface.GRID;
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
