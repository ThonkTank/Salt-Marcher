package features.world.quarantine.dungeonmap.editor.workspace.corridor;

import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPaneHitTestProjection;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;

import java.util.Objects;

public final class DungeonCorridorHitResolver {

    private final DungeonPaneHitTestProjection pane;
    private final DungeonPaneCorridorHitResolver corridorInteractionSupport;

    public DungeonCorridorHitResolver(
            DungeonPaneHitTestProjection pane,
            DungeonPaneCorridorHitResolver corridorInteractionSupport
    ) {
        this.pane = Objects.requireNonNull(pane, "pane");
        this.corridorInteractionSupport = Objects.requireNonNull(corridorInteractionSupport, "corridorInteractionSupport");
    }

    public CorridorDoorHit findNearestCorridorDoorHit(double screenX, double screenY) {
        return corridorInteractionSupport.findNearestCorridorDoorHit(screenX, screenY);
    }

    public CorridorDoorHandle findCorridorDoorHandleAt(double screenX, double screenY) {
        return corridorInteractionSupport.findCorridorDoorHandleAt(screenX, screenY);
    }

    public CorridorWaypointHandle findCorridorWaypointHandleAt(double screenX, double screenY) {
        return corridorInteractionSupport.findCorridorWaypointHandleAt(screenX, screenY);
    }

    public CorridorWaypointHandle findCorridorWaypointRemoveHandleAt(double screenX, double screenY) {
        return corridorInteractionSupport.findCorridorWaypointRemoveHandleAt(screenX, screenY);
    }

    public CorridorEditInteractionController.SegmentInsertHit findCorridorSegmentInsertHitAt(double screenX, double screenY) {
        return corridorInteractionSupport.findCorridorSegmentInsertHitAt(screenX, screenY);
    }

    public double corridorDoorHitDistance(
            double screenX,
            double screenY,
            DungeonCorridor corridor,
            CorridorGeometry geometry,
            DoorSegment door
    ) {
        return pane.corridorDoorHitDistance(new ScreenPoint(screenX, screenY), corridor, geometry, door);
    }

    public double selectedCorridorDoorHandleDistance(
            double screenX,
            double screenY,
            DungeonCorridorDoorProjector.CorridorSelectionContext context,
            DoorSegment door
    ) {
        return pane.selectedCorridorDoorHandleDistance(new ScreenPoint(screenX, screenY), context, door);
    }

    public double selectedCorridorWaypointHandleDistance(
            double screenX,
            double screenY,
            DungeonCorridorDoorProjector.CorridorSelectionContext context,
            Point2i waypoint
    ) {
        return pane.selectedCorridorWaypointHandleDistance(new ScreenPoint(screenX, screenY), context, waypoint);
    }
}
