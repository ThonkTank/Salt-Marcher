package features.world.quarantine.dungeonmap.editor.workspace.graph;

import features.world.quarantine.dungeonmap.canvas.DungeonCanvasTheme;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasCamera;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPaneHitTestProjection;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorDoorHit;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonCorridorDoorProjector;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonPaneCorridorWorkspace;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;

public final class DungeonGraphHitTestDelegate implements DungeonPaneHitTestProjection {

    private final DungeonGraphNodeSupport nodeSupport;
    private final DungeonGraphCorridorGeometrySupport corridorGeometrySupport;
    private final DungeonPaneCorridorWorkspace corridorWorkspace;
    private final DungeonCanvasCamera camera;

    public DungeonGraphHitTestDelegate(
            DungeonGraphNodeSupport nodeSupport,
            DungeonGraphCorridorGeometrySupport corridorGeometrySupport,
            DungeonPaneCorridorWorkspace corridorWorkspace,
            DungeonCanvasCamera camera
    ) {
        this.nodeSupport = nodeSupport;
        this.corridorGeometrySupport = corridorGeometrySupport;
        this.corridorWorkspace = corridorWorkspace;
        this.camera = camera;
    }

    @Override
    public DungeonRoomCluster findClusterAt(ScreenPoint screen) {
        return nodeSupport.findClusterAt(screen.x(), screen.y());
    }

    @Override
    public DungeonRoom findRoomAt(ScreenPoint screen) {
        return nodeSupport.findRoomAt(screen.x(), screen.y());
    }

    @Override
    public DungeonCorridor findCorridorAt(ScreenPoint screen) {
        return corridorGeometrySupport.findCorridorAt(screen);
    }

    @Override
    public CorridorDoorHit findCorridorDoorHitAt(ScreenPoint screen) {
        return corridorWorkspace.corridorInteractionSupport().findNearestCorridorDoorHit(screen.x(), screen.y());
    }

    @Override
    public double corridorDoorHitDistance(
            ScreenPoint screen,
            DungeonCorridor corridor,
            CorridorGeometry geometry,
            DoorSegment door
    ) {
        return corridorGeometrySupport.corridorDoorHitDistance(screen, corridor, door);
    }

    @Override
    public double selectedCorridorDoorHandleDistance(
            ScreenPoint screen,
            DungeonCorridorDoorProjector.CorridorSelectionContext context,
            DoorSegment door
    ) {
        return corridorGeometrySupport.selectedCorridorDoorHandleDistance(screen, context, door);
    }

    @Override
    public double selectedCorridorWaypointHandleDistance(
            ScreenPoint screen,
            DungeonCorridorDoorProjector.CorridorSelectionContext context,
            Point2i waypoint
    ) {
        double centerX = camera.toScreenX(waypoint.x() + 0.5);
        double centerY = camera.toScreenY(waypoint.y() + 0.5);
        double distance = Math.hypot(screen.x() - centerX, screen.y() - centerY);
        return distance <= DungeonCanvasTheme.HitTest.CORRIDOR_LINK_HIT_RADIUS_PX ? distance : Double.POSITIVE_INFINITY;
    }

    @Override
    public int corridorSegmentIndexAt(ScreenPoint screen) {
        return corridorGeometrySupport.corridorSegmentIndexAt(screen);
    }
}
