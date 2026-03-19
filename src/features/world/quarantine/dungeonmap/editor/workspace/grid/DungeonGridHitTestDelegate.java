package features.world.quarantine.dungeonmap.editor.workspace.grid;

import features.world.quarantine.dungeonmap.canvas.DungeonCanvasTheme;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonBaseGridHitTester;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonGridScreenMath;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.primitives.GridSegment;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPaneHitTestProjection;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorDoorHit;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonCorridorDoorProjector;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonPaneCorridorWorkspace;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;

public final class DungeonGridHitTestDelegate implements DungeonPaneHitTestProjection {

    private final DungeonBaseGridHitTester.LookupContext lookupContext;
    private final DungeonPanePreviewModel previewModel;
    private final DungeonPaneCorridorWorkspace corridorWorkspace;
    private final DungeonGridScreenMath.ScreenPointResolver screenResolver;

    public DungeonGridHitTestDelegate(
            DungeonBaseGridHitTester.LookupContext lookupContext,
            DungeonPanePreviewModel previewModel,
            DungeonPaneCorridorWorkspace corridorWorkspace,
            DungeonGridScreenMath.ScreenPointResolver screenResolver
    ) {
        this.lookupContext = lookupContext;
        this.previewModel = previewModel;
        this.corridorWorkspace = corridorWorkspace;
        this.screenResolver = screenResolver;
    }

    @Override
    public DungeonRoomCluster findClusterAt(ScreenPoint screen) {
        return DungeonBaseGridHitTester.findClusterAt(lookupContext, screen.x(), screen.y());
    }

    @Override
    public DungeonRoom findRoomAt(ScreenPoint screen) {
        return DungeonBaseGridHitTester.findRoomAt(lookupContext, screen.x(), screen.y());
    }

    @Override
    public DungeonCorridor findCorridorAt(ScreenPoint screen) {
        return DungeonBaseGridHitTester.findCorridorAt(lookupContext, screen.x(), screen.y());
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
        double doorDistance = previewModel.geometry().distanceToDoor(screen, door);
        if (doorDistance > DungeonCanvasTheme.HitTest.DOOR_HIT_RADIUS_PX) {
            return Double.POSITIVE_INFINITY;
        }
        double roomDistance = DungeonGridScreenMath.distanceToRoomCell(screen, door.roomCell(), screenResolver);
        return doorDistance * 10 + roomDistance;
    }

    @Override
    public double selectedCorridorDoorHandleDistance(
            ScreenPoint screen,
            DungeonCorridorDoorProjector.CorridorSelectionContext context,
            DoorSegment door
    ) {
        double distance = previewModel.geometry().distanceToDoor(screen, door);
        return distance <= DungeonCanvasTheme.HitTest.WAYPOINT_HIT_RADIUS_PX ? distance : Double.POSITIVE_INFINITY;
    }

    @Override
    public double selectedCorridorWaypointHandleDistance(
            ScreenPoint screen,
            DungeonCorridorDoorProjector.CorridorSelectionContext context,
            Point2i waypoint
    ) {
        double distance = DungeonGridScreenMath.distanceToRoomCell(screen, waypoint, screenResolver);
        return distance <= DungeonCanvasTheme.HitTest.WAYPOINT_HIT_RADIUS_PX ? distance : Double.POSITIVE_INFINITY;
    }

    @Override
    public int corridorSegmentIndexAt(ScreenPoint screen) {
        DungeonCorridorDoorProjector.CorridorSelectionContext context =
                corridorWorkspace.corridorProjectionSupport().selectedCorridorContext();
        if (context == null || context.geometry().segments().isEmpty()) {
            return -1;
        }
        int bestSegmentIndex = -1;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (int index = 0; index < context.geometry().segments().size(); index++) {
            GridSegment segment = context.geometry().segments().get(index);
            double distance = DungeonGridScreenMath.distanceToSegment(screen, segment.from(), segment.to(), screenResolver);
            if (distance <= DungeonCanvasTheme.HitTest.CORRIDOR_LINK_HIT_RADIUS_PX && distance < bestDistance) {
                bestDistance = distance;
                bestSegmentIndex = index;
            }
        }
        return bestSegmentIndex;
    }
}
