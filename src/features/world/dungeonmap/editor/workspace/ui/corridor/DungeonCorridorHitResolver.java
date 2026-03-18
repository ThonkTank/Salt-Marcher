package features.world.dungeonmap.editor.workspace.ui.corridor;

import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.editor.workspace.ui.base.AbstractDungeonPane;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.foundation.geometry.Point2i;

import java.util.Objects;

public final class DungeonCorridorHitResolver {

    private final AbstractDungeonPane pane;
    private final DungeonPaneCorridorInteractionSupport corridorInteractionSupport;

    public DungeonCorridorHitResolver(
            AbstractDungeonPane pane,
            DungeonPaneCorridorInteractionSupport corridorInteractionSupport
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
        return pane.corridorDoorHitDistance(screenX, screenY, corridor, geometry, door);
    }

    public double selectedCorridorDoorHandleDistance(
            double screenX,
            double screenY,
            DungeonCorridorProjectionSupport.CorridorSelectionContext context,
            DoorSegment door
    ) {
        return pane.selectedCorridorDoorHandleDistance(screenX, screenY, context, door);
    }

    public double selectedCorridorWaypointHandleDistance(
            double screenX,
            double screenY,
            DungeonCorridorProjectionSupport.CorridorSelectionContext context,
            Point2i waypoint
    ) {
        return pane.selectedCorridorWaypointHandleDistance(screenX, screenY, context, waypoint);
    }
}
