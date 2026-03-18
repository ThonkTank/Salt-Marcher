package features.world.dungeonmap.editor.workspace.ui.corridor;

import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPreviewState;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPreviewTopologySession;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;

import java.util.List;
import java.util.Objects;

public final class DungeonPaneCorridorInteractionSupport {

    private final Host host;

    public DungeonPaneCorridorInteractionSupport(Host host) {
        this.host = Objects.requireNonNull(host, "host");
    }

    public CorridorDoorHit corridorDoorHit(DoorSegment door, Long fallbackCorridorId) {
        if (door == null) {
            return null;
        }
        DungeonLayoutRenderData corridorRenderData = corridorRenderDataForDisplay();
        List<Long> corridorIds = corridorRenderData == null
                ? List.of()
                : corridorRenderData.corridorIdsForDoorFromRoom(door);
        CorridorDoorHit hit = DungeonCorridorDoorHitResolver.resolve(corridorIds, fallbackCorridorId, door.roomId());
        return hit.isEmpty() ? null : hit;
    }

    public CorridorDoorHandle findCorridorDoorHandleAt(double screenX, double screenY) {
        if (host.hasClusterDragPreview()) {
            return null;
        }
        DungeonCorridorProjectionSupport.CorridorSelectionContext context = host.selectedCorridorContext();
        if (context == null) {
            return null;
        }
        CorridorDoorHandle best = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DoorSegment door : context.geometry().doors()) {
            double distance = host.selectedCorridorDoorHandleDistance(screenX, screenY, context, door);
            if (!Double.isFinite(distance) || distance >= bestDistance) {
                continue;
            }
            bestDistance = distance;
            best = host.corridorDoorHandleForRoom(door.roomId());
        }
        return best;
    }

    public CorridorWaypointHandle findCorridorWaypointHandleAt(double screenX, double screenY) {
        DungeonCorridorProjectionSupport.CorridorSelectionContext context = host.selectedCorridorContext();
        if (context == null) {
            return null;
        }
        CorridorWaypointHandle best = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (int index = 0; index < context.geometry().waypointCells().size(); index++) {
            Point2i waypoint = context.geometry().waypointCells().get(index);
            double distance = host.selectedCorridorWaypointHandleDistance(screenX, screenY, context, waypoint);
            if (!Double.isFinite(distance) || distance >= bestDistance) {
                continue;
            }
            bestDistance = distance;
            best = new CorridorWaypointHandle(context.corridor().corridorId(), index);
        }
        return best;
    }

    public CorridorWaypointHandle findCorridorWaypointRemoveHandleAt(double screenX, double screenY) {
        DungeonCorridorProjectionSupport.CorridorSelectionContext context = host.selectedCorridorContext();
        if (context == null || context.geometry().segments().size() <= 1 || context.geometry().waypointCells().isEmpty()) {
            return null;
        }
        int segmentIndex = host.corridorSegmentIndexAt(screenX, screenY);
        CorridorWaypointHandle waypointHandle = findCorridorWaypointHandleAt(screenX, screenY);
        if (waypointHandle != null) {
            return waypointHandle;
        }
        return host.waypointHandleForSegmentRemoval(context, screenX, screenY, segmentIndex);
    }

    public CorridorEditInteractionController.SegmentInsertHit findCorridorSegmentInsertHitAt(double screenX, double screenY) {
        DungeonCorridorProjectionSupport.CorridorSelectionContext context = host.selectedCorridorContext();
        if (context == null || context.geometry().segments().isEmpty()) {
            return null;
        }
        int segmentIndex = host.corridorSegmentIndexAt(screenX, screenY);
        if (segmentIndex < 0) {
            return null;
        }
        return new CorridorEditInteractionController.SegmentInsertHit(
                context.corridor().corridorId(),
                host.insertIndexForSegment(context.corridor().corridorId(), context.geometry(), segmentIndex),
                host.worldPointAt(screenX, screenY));
    }

    public CorridorGeometry corridorGeometryForSelection(DungeonCorridor corridor) {
        return corridorGeometryForDisplay(corridor);
    }

    public CorridorGeometry corridorGeometryForDisplay(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null) {
            return null;
        }
        CorridorGeometry previewGeometry = host.previewTopologySession().corridorGeometryOverride(corridor.corridorId());
        if (previewGeometry != null) {
            return previewGeometry;
        }
        DungeonLayoutRenderData corridorRenderData = corridorRenderDataForDisplay();
        return corridorRenderData == null ? null : corridorRenderData.corridorGeometry(corridor.corridorId());
    }

    public CorridorDoorHit findNearestCorridorDoorHit(double screenX, double screenY) {
        if (host.dungeonLayout() == null || corridorRenderDataForDisplay() == null) {
            return null;
        }
        CorridorDoorHit bestHit = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonCorridor corridor : host.dungeonLayout().corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            for (DoorSegment door : geometry.doors()) {
                double distance = host.corridorDoorHitDistance(screenX, screenY, corridor, geometry, door);
                if (!Double.isFinite(distance) || distance >= bestDistance) {
                    continue;
                }
                bestDistance = distance;
                bestHit = corridorDoorHit(door, corridor.corridorId());
            }
        }
        return bestHit;
    }

    public boolean isSelected(CorridorDoorHandle handle) {
        return handle != null && handle.equals(host.previewState().selectedCorridorDoorHandle());
    }

    private DungeonLayoutRenderData corridorRenderDataForDisplay() {
        return host.renderData();
    }

    public interface Host extends features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneReadContext {
        DungeonPreviewState previewState();
        DungeonPreviewTopologySession previewTopologySession();
        boolean hasClusterDragPreview();
        DungeonCorridorProjectionSupport.CorridorSelectionContext selectedCorridorContext();
        CorridorDoorHandle corridorDoorHandleForRoom(long roomId);
        double selectedCorridorDoorHandleDistance(
                double screenX,
                double screenY,
                DungeonCorridorProjectionSupport.CorridorSelectionContext context,
                DoorSegment door
        );
        double selectedCorridorWaypointHandleDistance(
                double screenX,
                double screenY,
                DungeonCorridorProjectionSupport.CorridorSelectionContext context,
                Point2i waypoint
        );
        CorridorWaypointHandle waypointHandleForSegmentRemoval(
                DungeonCorridorProjectionSupport.CorridorSelectionContext context,
                double screenX,
                double screenY,
                int segmentIndex
        );
        int insertIndexForSegment(long corridorId, CorridorGeometry geometry, int segmentIndex);
        int corridorSegmentIndexAt(double screenX, double screenY);
        Point2i worldPointAt(double screenX, double screenY);
        double corridorDoorHitDistance(
                double screenX,
                double screenY,
                DungeonCorridor corridor,
                CorridorGeometry geometry,
                DoorSegment door
        );
    }
}
