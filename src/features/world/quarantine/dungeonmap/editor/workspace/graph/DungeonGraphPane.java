package features.world.quarantine.dungeonmap.editor.workspace.graph;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorEditInteractionController;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonCorridorDoorProjector;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonViewMode;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorDoorHit;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterVertexRef;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.editor.workspace.contract.DungeonPaneInteractionSink;
import features.world.quarantine.dungeonmap.editor.workspace.pane.AbstractDungeonPane;
import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPaneHitTestProjection;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPaneSelectionAreaProjection;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.DungeonPaneWallPathProjection;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasCamera;
import features.world.quarantine.dungeonmap.canvas.DungeonCanvasTheme;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;
import java.util.Set;
import java.util.List;

public final class DungeonGraphPane extends AbstractDungeonPane {

    private final DungeonGraphNodeSupport nodeSupport;
    private final DungeonGraphCorridorLayoutSupport corridorLayoutSupport;
    private final DungeonGraphCorridorGeometrySupport corridorGeometrySupport;
    private final DungeonGraphCorridorRenderSupport corridorRenderSupport;
    private final DungeonGraphHitTestDelegate hitTestDelegate;

    public DungeonGraphPane(DungeonCanvasCamera camera, DungeonPaneInteractionSink interactionSink) {
        super(camera);
        initInteractions(DungeonPaneSelectionAreaProjection.UNSUPPORTED, DungeonPaneWallPathProjection.UNSUPPORTED, interactionSink);
        // Keep graph-pane construction behind the same interaction initialization boundary as grid-pane.
        this.nodeSupport = new DungeonGraphNodeSupport(
                this, interactions().previewModel(), interactions().corridorWorkspace());
        this.corridorLayoutSupport = new DungeonGraphCorridorLayoutSupport(
                this, interactions().previewModel(), interactions().corridorWorkspace());
        this.corridorGeometrySupport = new DungeonGraphCorridorGeometrySupport(
                this, interactions().previewModel(), interactions().corridorWorkspace(), corridorLayoutSupport);
        this.corridorRenderSupport = new DungeonGraphCorridorRenderSupport(
                this, interactions().previewModel(), interactions().corridorWorkspace(),
                interactions().renderState(), corridorLayoutSupport, corridorGeometrySupport);
        this.hitTestDelegate = new DungeonGraphHitTestDelegate(
                nodeSupport, corridorGeometrySupport, interactions().corridorWorkspace(), camera);
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
    public DungeonPaneHitTestProjection hitTestDelegate() {
        return hitTestDelegate;
    }

    @Override
    public DungeonViewMode viewMode() {
        return DungeonViewMode.GRAPH;
    }

    @Override
    public boolean canCreateGraphRoomAt(Point2i world) {
        return nodeSupport.canCreateGraphRoomAt(world);
    }

    public CorridorGeometry corridorGeometryForSelection(DungeonCorridor corridor) {
        return interactions().corridorWorkspace().corridorInteractionSupport().corridorGeometryForSelection(corridor);
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
