package features.world.dungeonmap.editor.workspace.ui.graph;

import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorEditInteractionController;
import features.world.dungeonmap.editor.workspace.ui.corridor.DungeonCorridorProjectionSupport;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorSurface;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorDoorHit;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.rooms.model.DungeonClusterVertexRef;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.editor.workspace.ui.base.AbstractDungeonPane;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneGraphCreationProjection;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneGridPointerProjection;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPaneSelectionAreaProjection;
import features.world.dungeonmap.editor.workspace.ui.wallpath.DungeonPaneWallPathProjection;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasTheme;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;
import java.util.Set;
import java.util.List;

public final class DungeonGraphPane extends AbstractDungeonPane implements DungeonPaneGraphCreationProjection {

    private final DungeonGraphNodeSupport nodeSupport = new DungeonGraphNodeSupport(
            this, interactions().previewModel(), interactions().corridorWorkspace());
    private final DungeonGraphCorridorLayoutSupport corridorLayoutSupport = new DungeonGraphCorridorLayoutSupport(
            this, interactions().previewModel(), interactions().corridorWorkspace());
    private final DungeonGraphCorridorGeometrySupport corridorGeometrySupport =
            new DungeonGraphCorridorGeometrySupport(
                    this, interactions().previewModel(), interactions().corridorWorkspace(), corridorLayoutSupport);
    private final DungeonGraphCorridorRenderSupport corridorRenderSupport =
            new DungeonGraphCorridorRenderSupport(
                    this, interactions().previewModel(), interactions().corridorWorkspace(),
                    interactions().renderState(), corridorLayoutSupport, corridorGeometrySupport);

    public DungeonGraphPane(DungeonCanvasCamera camera) {
        super(camera);
        initInteractions(DungeonPaneGridPointerProjection.UNSUPPORTED, this, DungeonPaneSelectionAreaProjection.UNSUPPORTED, DungeonPaneWallPathProjection.UNSUPPORTED);
    }

    @Override
    protected void renderContent(GraphicsContext gc) {
        nodeSupport.renderBackdrop(gc);
        corridorRenderSupport.renderCorridors(gc);
        nodeSupport.renderClusterNodes(gc);
    }

    @Override
    public Point2i worldPointAt(double screenX, double screenY) {
        return new Point2i(
                (int) Math.round(camera.toWorldX(screenX)),
                (int) Math.round(camera.toWorldY(screenY)));
    }

    @Override
    public DungeonRoomCluster findClusterAt(double screenX, double screenY) {
        return nodeSupport.findClusterAt(screenX, screenY);
    }

    @Override
    public DungeonRoom findRoomAt(double screenX, double screenY) {
        return nodeSupport.findRoomAt(screenX, screenY);
    }

    @Override
    public DungeonCorridor findCorridorAt(double screenX, double screenY) {
        return corridorGeometrySupport.findCorridorAt(screenX, screenY);
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
        return corridorGeometrySupport.corridorDoorHitDistance(screenX, screenY, corridor, door);
    }

    @Override
    public double selectedCorridorDoorHandleDistance(
            double screenX,
            double screenY,
            DungeonCorridorProjectionSupport.CorridorSelectionContext context,
            DoorSegment door
    ) {
        return corridorGeometrySupport.selectedCorridorDoorHandleDistance(screenX, screenY, context, door);
    }

    @Override
    public double selectedCorridorWaypointHandleDistance(
            double screenX,
            double screenY,
            DungeonCorridorProjectionSupport.CorridorSelectionContext context,
            Point2i waypoint
    ) {
        double centerX = camera.toScreenX(waypoint.x() + 0.5);
        double centerY = camera.toScreenY(waypoint.y() + 0.5);
        double distance = Math.hypot(screenX - centerX, screenY - centerY);
        return distance <= DungeonCanvasTheme.CORRIDOR_LINK_HIT_RADIUS_PX ? distance : Double.POSITIVE_INFINITY;
    }

    @Override
    public int corridorSegmentIndexAt(double screenX, double screenY) {
        return corridorGeometrySupport.corridorSegmentIndexAt(screenX, screenY);
    }

    @Override
    public DungeonEditorSurface surface() {
        return DungeonEditorSurface.GRAPH;
    }

    @Override
    public boolean canCreateGraphRoomAt(Point2i world) {
        return nodeSupport.canCreateGraphRoomAt(world);
    }

    public CorridorGeometry corridorGeometryForSelection(DungeonCorridor corridor) {
        return interactions().corridorWorkspace().corridorGeometryForSelection(corridor);
    }

    enum CorridorPressMode {
        DEFAULT,
        REMOVE_WAYPOINT,
        INSERT_WAYPOINT;

        static CorridorPressMode from(CorridorEditInteractionController.PressMode mode) {
            if (mode == CorridorEditInteractionController.PressMode.REMOVE_WAYPOINT) {
                return REMOVE_WAYPOINT;
            }
            if (mode == CorridorEditInteractionController.PressMode.INSERT_WAYPOINT) {
                return INSERT_WAYPOINT;
            }
            return DEFAULT;
        }
    }

    static Color graphGroupColorFor(long corridorId) {
        return DungeonCanvasTheme.graphGroupColorFor(corridorId);
    }
}
